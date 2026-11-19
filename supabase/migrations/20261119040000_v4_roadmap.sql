-- V4 로드맵(2026-11-19, 사용자 결정 A안 + 합치기): 홈페이지 로드맵 = 학과 구성 순서. 앞뒤 과목 사이 [+]를 켜면 한 단계에 함께.
-- 운영 DB에는 사용자가 직접 실행한다. 20261119030000(v4_common) 다음.
-- - comsw_v4_save_roadmap(학과, 단계 묶음): 묶음을 이어 붙인 과목 목록이 그 학과의 학과 구성 순서와 같아야 저장(순서를 따로 바꿀 수 없음).
--   그 학과 로드맵 줄의 단계를 묶음대로 다시 만들고 바로 공개. 예전 단계는 v4_roadmap_archive에 보관.
-- - 공개 이름: 한 단계의 과목이 이름 끝 숫자만 다르면 'AI웹툰 1~6'·'캐드 1~2', 다르면 지금처럼 줄바꿈(쉼표로 이어 두면 로드맵 페이지가 줄을 나눔).

create table public.v4_roadmap_archive (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null,
  rows jsonb not null,
  archived_at timestamptz not null default now(),
  archived_by text
);
grant select on public.v4_roadmap_archive to authenticated;
alter table public.v4_roadmap_archive enable row level security;
create policy staff_read on public.v4_roadmap_archive for select to authenticated using (public.comsw_role() in ('admin', 'head'));

-- '캐드1, 캐드2' → '캐드 1~2'. 이름 끝 숫자만 다른 과목이 둘 이상일 때만, 아니면 그대로.
create function comsw_private.v4_roadmap_label(cell text) returns text
language sql immutable set search_path = '' as $$
  with p as (
    select regexp_match(btrim(x), '^(.*?)\s*(\d+)$') m
    from unnest(string_to_array(coalesce(cell, ''), ', ')) x where btrim(x) <> ''
  )
  select case when count(*) >= 2 and count(m) = count(*) and count(distinct btrim(m[1])) = 1 and min(btrim(m[1])) <> ''
    then min(btrim(m[1])) || ' ' || min(m[2]::int) || '~' || max(m[2]::int)
    else cell end
  from p
$$;

create temp table v4_was_clean as select not comsw_private.v4_differs() as clean;

alter function public.comsw_build_rows() rename to comsw_build_rows_before_v4_roadmap;
create function public.comsw_build_rows() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(
    case when r ->> 'sheet_name' = '로드맵' and ((r ->> 'row_number')::int - 2) % 3 = 0 then
      jsonb_set(r, '{data,values}', (
        select jsonb_agg(case when i = 1 then v else to_jsonb(comsw_private.v4_roadmap_label(v #>> '{}')) end order by i)
        from jsonb_array_elements(r #> '{data,values}') with ordinality a(v, i)))
    else r end order by o), '[]'::jsonb)
  from jsonb_array_elements(comsw_build_rows_before_v4_roadmap()) with ordinality e(r, o)
$$;
revoke execute on function public.comsw_build_rows() from public, anon, authenticated;
revoke execute on function public.comsw_build_rows_before_v4_roadmap() from public, anon, authenticated;

-- p_groups = [{subjects: [과목 id…], summary}] 앞에서부터 단계 순서.
create function public.comsw_v4_save_roadmap(p_department uuid, p_groups jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare t uuid; d public.departments; flat uuid[]; layout uuid[]; old jsonb;
begin
  perform comsw_private.v4_guard();
  select * into d from public.departments where id = p_department;
  if not found then raise exception '학과가 없습니다' using errcode = 'P0001'; end if;
  select coalesce(array_agg((s #>> '{}')::uuid order by g, k), '{}') into flat
    from jsonb_array_elements(coalesce(p_groups, '[]'::jsonb)) with ordinality x(e, g),
         jsonb_array_elements(e->'subjects') with ordinality y(s, k);
  select coalesce(array_agg(sd.subject_id order by sd.sort_order nulls last, sj.name), '{}') into layout
    from public.subject_departments sd join public.subjects sj on sj.id = sd.subject_id
    where sd.department_id = p_department and sj.deleted_at is null;
  if flat is distinct from layout then
    raise exception '학과 구성 순서와 다릅니다. 학과 구성을 먼저 저장하거나 새로 불러와 주세요' using errcode = 'P0001';
  end if;
  if exists(select 1 from jsonb_array_elements(p_groups) e where jsonb_array_length(coalesce(e->'subjects', '[]'::jsonb)) = 0
            or length(coalesce(e->>'summary', '')) > 500) then
    raise exception '로드맵 단계를 확인해주세요' using errcode = 'P0001';
  end if;
  select array_agg(id) into layout from public.roadmap_tracks where department_id = p_department;
  if coalesce(array_length(layout, 1), 0) > 1 then
    raise exception '이 학과의 로드맵 줄이 여러 개입니다. 관리자에게 알려주세요' using errcode = 'P0001';
  end if;
  t := layout[1];
  if t is null then
    insert into public.roadmap_tracks(name, department_id, sort_order) values (d.name, d.id, d.sort_order) returning id into t;
  end if;
  select jsonb_agg(jsonb_build_object('position', st.position, 'summary', st.summary, 'source_text', st.source_text,
           'subjects', (select jsonb_agg(rs.subject_id order by rs.sort_order nulls last) from public.roadmap_step_subjects rs where rs.step_id = st.id))
         order by st.position) into old
    from public.roadmap_steps st where st.track_id = t;
  if old is not null then
    insert into public.v4_roadmap_archive(department_id, rows, archived_by) values (p_department, old, auth.jwt() ->> 'sub');
    delete from public.roadmap_steps where track_id = t;
  end if;
  insert into public.roadmap_steps(track_id, position, summary)
    select t, g, nullif(btrim(e->>'summary'), '') from jsonb_array_elements(p_groups) with ordinality x(e, g);
  insert into public.roadmap_step_subjects(step_id, subject_id, sort_order)
    select st.id, (s #>> '{}')::uuid, k
    from jsonb_array_elements(p_groups) with ordinality x(e, g)
    join public.roadmap_steps st on st.track_id = t and st.position = g
    cross join jsonb_array_elements(e->'subjects') with ordinality y(s, k);
  perform comsw_private.v4_publish();
end $$;

revoke all on function comsw_private.v4_roadmap_label(text) from public, anon, authenticated;
revoke all on function public.comsw_v4_save_roadmap(uuid, jsonb) from public, anon;
grant execute on function public.comsw_v4_save_roadmap(uuid, jsonb) to authenticated;

do $$
begin
  if (select clean from v4_was_clean) and exists(select 1 from public.site_snapshots) then
    insert into public.site_snapshots(published_by, rows) values ('v4-migration', public.comsw_build_rows());
  else
    raise notice '반영하지 않은 다른 변경이 있어 바로 공개하지 않았습니다. 기존 관리 화면에서 사이트에 반영해주세요';
  end if;
end $$;
drop table v4_was_clean;
