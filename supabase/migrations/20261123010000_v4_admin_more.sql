-- V4 관리 기능 더하기(2026-11-23 사용자 요청). 운영 DB에는 사용자가 직접 실행한다. 20261120070000 다음.
-- 1) 학과 순서·공개: comsw_v4_save_departments([{id, sort_order, is_active}])
-- 2) 과목 이름 바꾸기: comsw_v4_rename_subject(id, name) — 같은 종류(일반/방학 특강) 안에서만 이름이 겹치지 않게
-- 3) 하단 메뉴 켜기·끄기까지: comsw_v4_save_menus([{id, label, side, sort_order, is_active}])
-- 4) 학과장·관리자가 강사를 직접 추가·수정: comsw_v4_save_instructor(id 또는 null, {name, career, message, photo_url, gender, is_listed, departments[], subjects[]})
-- 모두 v4_guard(학과장·관리자, 다른 미반영 변경 없음) → 바꾸고 → 바로 공개.

create function public.comsw_v4_save_departments(p_items jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform comsw_private.v4_guard();
  if jsonb_typeof(coalesce(p_items, 'null'::jsonb)) <> 'array' or exists(
    select 1 from jsonb_array_elements(p_items) x
    where not exists(select 1 from public.departments d where d.id = (x->>'id')::uuid)
       or jsonb_typeof(x->'is_active') <> 'boolean' or (x->>'sort_order') !~ '^\d+$') then
    raise exception '학과 순서·공개를 확인해주세요' using errcode = 'P0001';
  end if;
  update public.departments d set sort_order = (x->>'sort_order')::int, is_active = (x->>'is_active')::boolean
    from jsonb_array_elements(p_items) x where d.id = (x->>'id')::uuid;
  perform comsw_private.v4_publish();
end $$;

create function public.comsw_v4_rename_subject(p_id uuid, p_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare n text := btrim(coalesce(p_name, '')); s public.subjects;
begin
  perform comsw_private.v4_guard();
  select * into s from public.subjects where id = p_id and deleted_at is null;
  if not found then raise exception '과목이 없거나 삭제되었습니다' using errcode = 'P0001'; end if;
  if length(n) not between 1 and 60 then raise exception '과목 이름을 확인해주세요(1~60자)' using errcode = 'P0001'; end if;
  if exists(select 1 from public.subjects where name = n and is_vacation = s.is_vacation and id <> p_id) then
    raise exception '같은 이름의 과목이 이미 있습니다' using errcode = 'P0001';
  end if;
  update public.subjects set name = n where id = p_id;
  perform comsw_private.v4_publish();
end $$;

create function public.comsw_v4_save_menus(p_items jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform comsw_private.v4_guard();
  if jsonb_typeof(coalesce(p_items, 'null'::jsonb)) <> 'array' or exists(
    select 1 from jsonb_array_elements(p_items) x
    where not exists(select 1 from public.menus m where m.id = (x->>'id')::uuid)
       or coalesce(x->>'side', '') not in ('left', 'right') or (x->>'sort_order') !~ '^\d+$'
       or jsonb_typeof(x->'is_active') <> 'boolean' or length(coalesce(x->>'label', '')) > 40) then
    raise exception '메뉴 위치·순서·이름을 확인해주세요' using errcode = 'P0001';
  end if;
  update public.menus m set label = nullif(btrim(x->>'label'), ''), side = x->>'side',
      sort_order = (x->>'sort_order')::int, is_active = (x->>'is_active')::boolean
    from jsonb_array_elements(p_items) x where m.id = (x->>'id')::uuid;
  perform comsw_private.v4_publish();
end $$;

create function public.comsw_v4_save_instructor(p_id uuid, p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare i uuid := p_id; n text := btrim(coalesce(p->>'name', ''));
begin
  perform comsw_private.v4_guard();
  if length(n) not between 1 and 30 then raise exception '강사 이름을 확인해주세요(1~30자)' using errcode = 'P0001'; end if;
  if length(coalesce(p->>'career', '')) > 10000 or length(coalesce(p->>'message', '')) > 2000 then
    raise exception '경력·한마디 길이를 확인해주세요' using errcode = 'P0001';
  end if;
  if coalesce(p->>'photo_url', '') <> '' and (p->>'photo_url' !~* '^https?://' or length(p->>'photo_url') > 2000) then
    raise exception '사진 주소를 확인해주세요' using errcode = 'P0001';
  end if;
  if exists(select 1 from jsonb_array_elements_text(coalesce(p->'departments', '[]'::jsonb)) d
            where not exists(select 1 from public.departments where id = d::uuid))
     or exists(select 1 from jsonb_array_elements_text(coalesce(p->'subjects', '[]'::jsonb)) s
               where not exists(select 1 from public.subjects where id = s::uuid and deleted_at is null)) then
    raise exception '학과·과목을 다시 골라주세요' using errcode = 'P0001';
  end if;
  if i is null then
    insert into public.instructors(name, career, message, photo_url, gender, is_listed, sort_order)
      values (n, nullif(btrim(p->>'career'), ''), nullif(btrim(p->>'message'), ''), nullif(btrim(p->>'photo_url'), ''),
              nullif(btrim(p->>'gender'), ''), coalesce((p->>'is_listed')::boolean, false),
              (select coalesce(max(sort_order), -1) + 1 from public.instructors))
      returning id into i;
  else
    update public.instructors set name = n, career = nullif(btrim(p->>'career'), ''), message = nullif(btrim(p->>'message'), ''),
        photo_url = nullif(btrim(p->>'photo_url'), ''), gender = nullif(btrim(p->>'gender'), ''),
        is_listed = coalesce((p->>'is_listed')::boolean, is_listed)
      where id = i;
    if not found then raise exception '강사가 없습니다' using errcode = 'P0001'; end if;
  end if;
  -- 학과·담당 과목은 고른 그대로(메인 학과는 남은 학과 안에서만)
  delete from public.instructor_departments where instructor_id = i;
  insert into public.instructor_departments(instructor_id, department_id)
    select i, d::uuid from jsonb_array_elements_text(coalesce(p->'departments', '[]'::jsonb)) d on conflict do nothing;
  update public.instructors set main_department_ids = array(
      select x from unnest(main_department_ids) x where x in (select department_id from public.instructor_departments where instructor_id = i))
    where id = i;
  delete from public.instructor_subjects where instructor_id = i;
  insert into public.instructor_subjects(instructor_id, subject_id, sort_order)
    select i, s::uuid, k from jsonb_array_elements_text(coalesce(p->'subjects', '[]'::jsonb)) with ordinality e(s, k) on conflict do nothing;
  perform comsw_private.v4_publish();
  return i;
end $$;

revoke all on function public.comsw_v4_save_departments(jsonb), public.comsw_v4_rename_subject(uuid, text),
  public.comsw_v4_save_menus(jsonb), public.comsw_v4_save_instructor(uuid, jsonb) from public, anon;
grant execute on function public.comsw_v4_save_departments(jsonb), public.comsw_v4_rename_subject(uuid, text),
  public.comsw_v4_save_menus(jsonb), public.comsw_v4_save_instructor(uuid, jsonb) to authenticated;
