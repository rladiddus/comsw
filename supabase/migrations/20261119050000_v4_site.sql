-- V4 5단계(2026-11-19): 방학 특강 구성, 특강·세미나 정보, 사이트 편집(메인·학과 대표·로딩·하단 메뉴). 모두 저장 = 그 건만 바로 공개.
-- 운영 DB에는 사용자가 직접 실행한다. 20261119040000(v4_roadmap) 다음. 공개 자료 모양은 바뀌지 않는다.
-- - 방학 특강: 만들기·이름, 과목 구성(빼기 = 이 특강 연결만 해제), 홈페이지에 보일 특강(site_settings.vacation_set_id).
-- - 특강·세미나: 공개 정보만(신청자 정보·신청 기능은 그대로).
-- - 사이트 편집: 탭마다 따로. 메인·로딩은 여러 개 모두(빠진 것만 지움), 메뉴는 보이는 이름·좌우·순서만(이동용 이름 name은 그대로).

create function comsw_private.v4_https(u text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(u, '') = '' or (u ~* '^https?://' and length(u) <= 2000)
$$;

-- 방학 특강. p_id가 없으면 새로 만든다. p_subjects = 이 특강 과목 전체(순서 없음). p_show면 홈페이지 방학 특강으로.
create function public.comsw_v4_save_vacation(p_id uuid, p_name text, p_subjects uuid[], p_show boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v uuid := p_id;
begin
  perform comsw_private.v4_guard();
  if length(btrim(coalesce(p_name, ''))) not between 1 and 80 then raise exception '특강 이름을 확인해주세요' using errcode = 'P0001'; end if;
  if v is null then
    insert into public.curriculum_sets(name, is_vacation, sort_order)
      values (btrim(p_name), true, (select coalesce(max(sort_order), -1) + 1 from public.curriculum_sets)) returning id into v;
  else
    update public.curriculum_sets set name = btrim(p_name) where id = v and is_vacation;
    if not found then raise exception '방학 특강이 없습니다' using errcode = 'P0001'; end if;
  end if;
  if exists(select 1 from unnest(coalesce(p_subjects, '{}')) x where not exists(select 1 from public.subjects where id = x and deleted_at is null)) then
    raise exception '없거나 삭제된 과목이 있습니다' using errcode = 'P0001';
  end if;
  delete from public.vacation_set_subjects where set_id = v and subject_id <> all(coalesce(p_subjects, '{}'));
  insert into public.vacation_set_subjects(set_id, subject_id) select v, x from unnest(coalesce(p_subjects, '{}')) x on conflict do nothing;
  if p_show then
    insert into public.site_settings(key, value) values ('vacation_set_id', v::text)
      on conflict (key) do update set value = excluded.value;
  end if;
  perform comsw_private.v4_publish();
  return v;
end $$;

-- 특강·세미나 공개 정보. p_id가 없으면 새로 만든다. p = {title, subtitle, datetime_text, instructor, place, capacity, poster_url, is_listed}
create function public.comsw_v4_save_seminar(p_id uuid, p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v uuid := p_id;
begin
  perform comsw_private.v4_guard();
  if length(btrim(coalesce(p->>'title', ''))) not between 1 and 200 then raise exception '특강 제목을 확인해주세요' using errcode = 'P0001'; end if;
  if not comsw_private.v4_https(p->>'poster_url') then raise exception '포스터는 http(s) 주소여야 합니다' using errcode = 'P0001'; end if;
  if coalesce(p->>'capacity', '') !~ '^\d{0,5}$' then raise exception '정원은 숫자로 적어주세요' using errcode = 'P0001'; end if;
  if v is null then
    insert into public.seminars(title, sort_order) values (btrim(p->>'title'), (select coalesce(max(sort_order), -1) + 1 from public.seminars)) returning id into v;
  end if;
  update public.seminars set title = btrim(p->>'title'), subtitle = nullif(btrim(p->>'subtitle'), ''),
    datetime_text = nullif(btrim(p->>'datetime_text'), ''), instructor = nullif(btrim(p->>'instructor'), ''),
    place = nullif(btrim(p->>'place'), ''), capacity = nullif(p->>'capacity', '')::int,
    poster_url = nullif(p->>'poster_url', ''), is_listed = coalesce((p->>'is_listed')::boolean, true)
  where id = v;
  if not found then raise exception '특강이 없습니다' using errcode = 'P0001'; end if;
  perform comsw_private.v4_publish();
  return v;
end $$;

-- 사이트 편집 한 탭. p_tab: main | loading | dept | menu
create function public.comsw_v4_save_site(p_tab text, p jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare x jsonb; n int := 0; keep uuid[] := '{}'; nid uuid;
begin
  perform comsw_private.v4_guard();
  if p_tab = 'main' then
    for x in select * from jsonb_array_elements(coalesce(p->'items', '[]'::jsonb)) loop
      if not comsw_private.v4_https(x->>'url') or coalesce(x->>'url', '') = '' then raise exception '메인 이미지·영상 주소(http(s))를 확인해주세요' using errcode = 'P0001'; end if;
      if nullif(x->>'id', '') is null then
        insert into public.main_media(url, caption, is_active, sort_order) values (x->>'url', x->>'caption', coalesce((x->>'is_active')::boolean, true), n) returning id into nid;
        keep := keep || nid;
      else
        update public.main_media set url = x->>'url', caption = x->>'caption', is_active = coalesce((x->>'is_active')::boolean, true), sort_order = n
          where id = (x->>'id')::uuid;
        keep := keep || (x->>'id')::uuid;
      end if;
      n := n + 1;
    end loop;
    delete from public.main_media where id <> all(keep);
  elsif p_tab = 'loading' then
    for x in select * from jsonb_array_elements(coalesce(p->'items', '[]'::jsonb)) loop
      if not comsw_private.v4_https(x->>'image_url') or coalesce(x->>'image_url', '') = '' then raise exception '로딩 이미지 주소(http(s))를 확인해주세요' using errcode = 'P0001'; end if;
      if nullif(x->>'id', '') is null then
        insert into public.loading_items(image_url, text, is_active, font_family, font_size, font_weight, sort_order)
          values (x->>'image_url', x->>'text', coalesce((x->>'is_active')::boolean, true), x->>'font_family', x->>'font_size', x->>'font_weight', n) returning id into nid;
        keep := keep || nid;
      else
        update public.loading_items set image_url = x->>'image_url', text = x->>'text', is_active = coalesce((x->>'is_active')::boolean, true),
          font_family = x->>'font_family', font_size = x->>'font_size', font_weight = x->>'font_weight', sort_order = n
          where id = (x->>'id')::uuid;
        keep := keep || (x->>'id')::uuid;
      end if;
      n := n + 1;
    end loop;
    delete from public.loading_items where id <> all(keep);
  elsif p_tab = 'dept' then
    if not comsw_private.v4_https(p->>'image_url') then raise exception '학과 대표 이미지는 http(s) 주소여야 합니다' using errcode = 'P0001'; end if;
    update public.departments set image_url = nullif(p->>'image_url', ''), description = p->>'description', name_en = nullif(btrim(p->>'name_en'), '')
      where id = (p->>'id')::uuid;
    if not found then raise exception '학과가 없습니다' using errcode = 'P0001'; end if;
  elsif p_tab = 'menu' then
    for x in select * from jsonb_array_elements(coalesce(p->'items', '[]'::jsonb)) loop
      if coalesce(x->>'side', '') not in ('left', 'right') then raise exception '메뉴 위치를 확인해주세요' using errcode = 'P0001'; end if;
      update public.menus set label = nullif(btrim(x->>'label'), ''), side = x->>'side', sort_order = (x->>'sort_order')::int
        where id = (x->>'id')::uuid;
    end loop;
  else
    raise exception '알 수 없는 탭입니다' using errcode = 'P0001';
  end if;
  perform comsw_private.v4_publish();
end $$;

revoke all on function comsw_private.v4_https(text) from public, anon, authenticated;
revoke all on function public.comsw_v4_save_vacation(uuid, text, uuid[], boolean), public.comsw_v4_save_seminar(uuid, jsonb),
  public.comsw_v4_save_site(text, jsonb) from public, anon;
grant execute on function public.comsw_v4_save_vacation(uuid, text, uuid[], boolean), public.comsw_v4_save_seminar(uuid, jsonb),
  public.comsw_v4_save_site(text, jsonb) to authenticated;
