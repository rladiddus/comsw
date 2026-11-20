-- V4 로드맵 순서 따로 정하기(2026-11-20 사용자 요청). 운영 DB에는 사용자가 직접 실행한다. 20261120010000 다음.
-- - 기본은 학과 구성 순서를 따라감(custom_order = false). 로드맵에서 끌어서 순서를 바꿔 저장하면 custom_order = true.
-- - p_custom = false: 지금처럼 학과 구성 순서와 같아야 저장. p_custom = true: 같은 과목들(빠짐·더함 없음)이면 순서는 자유.
alter table public.roadmap_tracks add column custom_order boolean not null default false;

drop function public.comsw_v4_save_roadmap(uuid, jsonb);
create function public.comsw_v4_save_roadmap(p_department uuid, p_groups jsonb, p_custom boolean default false)
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
  if coalesce(p_custom, false) then
    if cardinality(flat) <> cardinality(layout)
       or (select count(distinct x) from unnest(flat) x) <> cardinality(flat)
       or exists(select 1 from unnest(flat) x where x <> all(layout)) then
      raise exception '학과 구성의 과목과 다릅니다(빠지거나 더해진 과목). 새로 불러와 주세요' using errcode = 'P0001';
    end if;
  elsif flat is distinct from layout then
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
  update public.roadmap_tracks set custom_order = coalesce(p_custom, false) where id = t;
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
revoke all on function public.comsw_v4_save_roadmap(uuid, jsonb, boolean) from public, anon;
grant execute on function public.comsw_v4_save_roadmap(uuid, jsonb, boolean) to authenticated;
