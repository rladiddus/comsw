-- V4 4단계(2026-11-19): 공통 4단계 정리 확정, 공통 준비물(기준 과목 단위) 확정, 학과 구성·순서 저장. 모두 그 건만 바로 공개.
-- 운영 DB에는 사용자가 직접 실행한다. 20261119020000(v4_review) 다음.
-- - 공통 4단계: 학과장이 고른 '검수 완료' 강사 자료(일반 수업)만 근거로, 대표 이미지는 그 자료의 이미지 중에서만(서버가 다시 확인).
--   예전 단계(6단계 등)는 지우기 전에 v4_common_archive에 보관. 참고한 강사 자료 버전은 v4_common_meta에 기록.
-- - 공통 준비물: 기준 과목(이름 끝 숫자를 뺀 이름, 캐드1·캐드2 → 캐드)의 모든 과목에 같은 목록(사용자 결정 2026-11-19).
-- - 학과 구성: 학과마다 과목과 순서(subject_departments.sort_order). 공개 자료 전체수업 행 26번째 칸(인덱스 25)에
--   {"학과 이름에서 '학과'를 뺀 것": 순서}를 넣고, 학과별 커리큘럼·학과 전체 커리큘럼 페이지가 이 순서로 보여 준다.

create table public.v4_common_archive (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null,
  rows jsonb not null,
  archived_at timestamptz not null default now(),
  archived_by text
);
create table public.v4_common_meta (
  subject_id uuid primary key references public.subjects on delete cascade,
  sources jsonb not null,
  confirmed_at timestamptz not null default now(),
  confirmed_by text
);
grant select on public.v4_common_archive, public.v4_common_meta to authenticated;
alter table public.v4_common_archive enable row level security;
alter table public.v4_common_meta enable row level security;
create policy staff_read on public.v4_common_archive for select to authenticated using (public.comsw_role() in ('admin', 'head'));
create policy staff_read on public.v4_common_meta for select to authenticated using (public.comsw_role() in ('admin', 'head'));

create function comsw_private.v4_base(n text) returns text
language sql immutable set search_path = '' as $$
  select coalesce(nullif(btrim(regexp_replace(btrim(coalesce(n, '')), '\s*\d+$', '')), ''), btrim(coalesce(n, '')))
$$;

-- 공개 자료에 학과별 순서 칸을 더하기 전에, 지금 공개 상태가 깨끗했는지 기억해 둔다(끝에서 바로 공개할지).
create temp table v4_was_clean as select not comsw_private.v4_differs() as clean;

alter function public.comsw_build_rows() rename to comsw_build_rows_before_v4_order;
create function public.comsw_build_rows() returns jsonb
language sql stable security definer set search_path = public as $$
  with ord as (
    select s.name, jsonb_object_agg(regexp_replace(d.name, '학과$', ''), sd.sort_order) m
    from subject_departments sd join subjects s on s.id = sd.subject_id join departments d on d.id = sd.department_id
    where sd.sort_order is not null
    group by s.name
  )
  select coalesce(jsonb_agg(
    case when r ->> 'sheet_name' = '컴수원_전체수업' then
      jsonb_set(r, '{data,values}', (r #> '{data,values}') || to_jsonb(coalesce(
        (select ord.m::text from ord where ord.name = r #>> '{data,values,2}'), '')))
    else r end order by o), '[]'::jsonb)
  from jsonb_array_elements(comsw_build_rows_before_v4_order()) with ordinality e(r, o)
$$;
revoke execute on function public.comsw_build_rows() from public, anon, authenticated;
revoke execute on function public.comsw_build_rows_before_v4_order() from public, anon, authenticated;

-- 공통 4단계 확정. p_sources = [{id, updated_at}] 고른 강사 자료(검수 완료 줄), p_steps = [{summary, image_url}] 4개.
create function public.comsw_v4_confirm_common(p_subject uuid, p_sources jsonb, p_steps jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare old jsonb;
begin
  perform comsw_private.v4_guard();
  if not exists(select 1 from public.subjects where id = p_subject and deleted_at is null) then
    raise exception '과목이 없거나 삭제되었습니다' using errcode = 'P0001';
  end if;
  if jsonb_array_length(coalesce(p_sources, '[]'::jsonb)) = 0 then
    raise exception '참고할 강사 자료를 골라주세요' using errcode = 'P0001';
  end if;
  if exists(select 1 from jsonb_array_elements(p_sources) x
            where not exists(select 1 from public.instructor_curricula c join public.curriculum_sets cs on cs.id = c.set_id
                             where c.id = (x->>'id')::uuid and c.subject_id = p_subject and c.status = 'approved'
                               and not cs.is_vacation and c.updated_at = (x->>'updated_at')::timestamptz)) then
    raise exception '고른 강사 자료가 검수 완료본이 아니거나 그사이 바뀌었습니다. 새로 불러온 뒤 다시 해주세요' using errcode = 'P0001';
  end if;
  if jsonb_array_length(coalesce(p_steps, '[]'::jsonb)) <> 4
     or exists(select 1 from jsonb_array_elements(p_steps) x where btrim(coalesce(x->>'summary', '')) = '' or length(x->>'summary') > 2000) then
    raise exception '4단계 문구를 모두 채워주세요' using errcode = 'P0001';
  end if;
  if exists(select 1 from jsonb_array_elements(p_steps) x
            where coalesce(x->>'image_url', '') <> ''
              and not exists(select 1 from public.instructor_curricula c join jsonb_array_elements(p_sources) s on c.id = (s->>'id')::uuid
                             where c.media_url = x->>'image_url')) then
    raise exception '대표 이미지는 고른 강사 자료의 이미지 중에서 골라주세요' using errcode = 'P0001';
  end if;
  select jsonb_agg(to_jsonb(w) order by w.sort_order nulls last) into old from public.subject_weeks w where w.subject_id = p_subject;
  if old is not null then
    insert into public.v4_common_archive(subject_id, rows, archived_by) values (p_subject, old, auth.jwt() ->> 'sub');
    delete from public.subject_weeks where subject_id = p_subject;
  end if;
  insert into public.subject_weeks(subject_id, week_label, summary, image_url, sort_order)
    select p_subject, n || '단계', btrim(x->>'summary'), nullif(x->>'image_url', ''), n
    from jsonb_array_elements(p_steps) with ordinality e(x, n);
  insert into public.v4_common_meta(subject_id, sources, confirmed_by) values (p_subject, p_sources, auth.jwt() ->> 'sub')
    on conflict (subject_id) do update set sources = excluded.sources, confirmed_at = now(), confirmed_by = excluded.confirmed_by;
  perform comsw_private.v4_publish();
end $$;

-- 공통 준비물 확정(기준 과목 단위). p_items = [{category: textbook|supply|ai, content, link_url?, department_id?}]
create function public.comsw_v4_confirm_prep(p_base text, p_items jsonb)
returns int language plpgsql security definer set search_path = '' as $$
declare members uuid[];
begin
  perform comsw_private.v4_guard();
  select array_agg(id) into members from public.subjects
    where deleted_at is null and comsw_private.v4_base(name) = btrim(coalesce(p_base, ''));
  if members is null then raise exception '과목이 없습니다' using errcode = 'P0001'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) x
            where coalesce(x->>'category', '') not in ('textbook', 'supply', 'ai')
               or btrim(coalesce(x->>'content', '')) = '' or length(x->>'content') > 500
               or (coalesce(x->>'link_url', '') <> '' and (x->>'link_url' !~* '^https?://' or length(x->>'link_url') > 2000))) then
    raise exception '준비물 칸(분류·내용·링크는 http(s))을 확인해주세요' using errcode = 'P0001';
  end if;
  delete from public.course_prep_items where subject_id = any(members);
  insert into public.course_prep_items(subject_id, category, content, link_url, department_id, sort_order)
    select m, x->>'category', btrim(x->>'content'), nullif(x->>'link_url', ''), nullif(x->>'department_id', '')::uuid, n
    from unnest(members) m cross join jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality e(x, n);
  perform comsw_private.v4_publish();
  return array_length(members, 1);
end $$;

-- 학과 구성 저장: 이 학과의 과목과 순서를 이 목록 그대로(빠진 과목은 이 학과에서만 빠짐). 다른 학과 순서는 그대로.
create function public.comsw_v4_save_department_layout(p_department uuid, p_subjects uuid[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform comsw_private.v4_guard();
  if not exists(select 1 from public.departments where id = p_department) then
    raise exception '학과가 없습니다' using errcode = 'P0001';
  end if;
  if (select count(distinct x) from unnest(coalesce(p_subjects, '{}')) x) <> coalesce(array_length(p_subjects, 1), 0) then
    raise exception '같은 과목이 두 번 들어 있습니다' using errcode = 'P0001';
  end if;
  if exists(select 1 from unnest(coalesce(p_subjects, '{}')) x
            where not exists(select 1 from public.subjects where id = x and deleted_at is null)) then
    raise exception '없거나 삭제된 과목이 있습니다' using errcode = 'P0001';
  end if;
  delete from public.subject_departments where department_id = p_department and subject_id <> all(coalesce(p_subjects, '{}'));
  insert into public.subject_departments(subject_id, department_id)
    select x, p_department from unnest(coalesce(p_subjects, '{}')) x on conflict do nothing;
  update public.subject_departments set sort_order = array_position(p_subjects, subject_id) - 1
    where department_id = p_department;
  -- 어느 학과에도 없던 과목(순서 없음)은 전체수업에 나오도록 맨 뒤 순서를 준다.
  update public.subjects set sort_order = (select coalesce(max(sort_order), -1) + 1 from public.subjects)
    where id = any(coalesce(p_subjects, '{}')) and sort_order is null;
  perform comsw_private.v4_publish();
end $$;

revoke all on function comsw_private.v4_base(text) from public, anon, authenticated;
revoke all on function public.comsw_v4_confirm_common(uuid, jsonb, jsonb), public.comsw_v4_confirm_prep(text, jsonb),
  public.comsw_v4_save_department_layout(uuid, uuid[]) from public, anon;
grant execute on function public.comsw_v4_confirm_common(uuid, jsonb, jsonb), public.comsw_v4_confirm_prep(text, jsonb),
  public.comsw_v4_save_department_layout(uuid, uuid[]) to authenticated;

-- 학과별 순서 칸이 새로 생겨 공개 자료 모양이 바뀌었다. 실행 전 깨끗했으면 바로 다시 공개(안 그러면 V4 확정이 멈춤).
do $$
begin
  if (select clean from v4_was_clean) and exists(select 1 from public.site_snapshots) then
    insert into public.site_snapshots(published_by, rows) values ('v4-migration', public.comsw_build_rows());
  else
    raise notice '반영하지 않은 다른 변경이 있어 바로 공개하지 않았습니다. 기존 관리 화면에서 사이트에 반영해주세요';
  end if;
end $$;
drop table v4_was_clean;
