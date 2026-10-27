-- 다음 달 과목이 다른 학과에 이미 있을 때 지금 학과에 연결되지 않던 문제(Codex 리뷰 ③, 2026-10-27).
-- 과목을 만드는 함수에서 붙이면 선생님이 승인 없이 공개 과목을 다른 학과에 넣을 수 있으므로, 학과장이 승인할 때 붙인다:
-- 이미 어느 학과에든 연결된 과목이면, 커리큘럼을 낸 학과 탭(curriculum_sets.department_id)에도 연결한다.
-- 학과가 하나도 없는 '기타 과목'은 그대로 둔다(승인만으로 전체수업에 올라가지 않게).
create or replace function public.comsw_approve_curriculum(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.instructor_curricula; m public.instructor_subject_materials;
begin
  if coalesce(public.comsw_role(), '') not in ('admin','head') then raise exception '승인 권한이 없습니다' using errcode='42501'; end if;
  select * into c from public.instructor_curricula where id=p_id for update;
  if not found then raise exception '커리큘럼을 찾을 수 없습니다'; end if;
  perform pg_advisory_xact_lock(hashtext('comsw-approve'),hashtext(c.instructor_id::text||c.set_id::text||c.subject_id::text||c.step_label));
  delete from public.instructor_curricula where id<>c.id and status='approved' and set_id=c.set_id and instructor_id=c.instructor_id and subject_id=c.subject_id and step_label=c.step_label;
  update public.instructor_curricula set status='approved',updated_at=clock_timestamp() where id=c.id;
  insert into public.instructor_subjects(instructor_id,subject_id)
    values(c.instructor_id,c.subject_id) on conflict do nothing;
  insert into public.instructor_departments(instructor_id,department_id)
    select c.instructor_id,department_id from public.curriculum_sets where id=c.set_id and department_id is not null on conflict do nothing;
  -- 학과에 연결된 과목이면 이 학과 탭의 학과에도 연결(예: 아트웍학과에만 있던 웹툰2를 자격증학과 탭으로 승인).
  insert into public.subject_departments(subject_id, department_id)
    select c.subject_id, cs.department_id from public.curriculum_sets cs
    where cs.id = c.set_id and cs.department_id is not null
      and exists(select 1 from public.subject_departments where subject_id = c.subject_id)
  on conflict do nothing;
  -- 신규 과목(학과 연결 있음, 순서 없음)은 첫 승인 때 전체수업 맨 뒤에 넣는다.
  update public.subjects
    set sort_order = (select coalesce(max(sort_order), -1) + 1 from public.subjects)
    where id = c.subject_id and sort_order is null
      and exists(select 1 from public.subject_departments where subject_id = c.subject_id);
  -- 이 강사가 이 과목에 적은 프로그램·준비물을 과목 값에 합친다.
  select * into m from public.instructor_subject_materials where instructor_id=c.instructor_id and subject_id=c.subject_id;
  if found then
    update public.subjects
      set tools = comsw_private.merge_items(tools, m.tools),
          supplies = comsw_private.merge_items(supplies, m.supplies)
      where id = c.subject_id;
    insert into public.course_prep_items(subject_id, category, content, sort_order)
      select c.subject_id, 'supply', a.item,
             (select coalesce(max(sort_order), -1) from public.course_prep_items where subject_id = c.subject_id)
               + row_number() over (order by a.n)
      from (
        select btrim(x) item, min(n) n
        from regexp_split_to_table(coalesce(m.supplies, ''), '[,\n\r]+') with ordinality t(x, n)
        where btrim(x) <> ''
        group by btrim(x)
      ) a
      where lower(regexp_replace(a.item, '\s', '', 'g')) not in (
        select lower(regexp_replace(coalesce(p.content, ''), '\s', '', 'g'))
        from public.course_prep_items p where p.subject_id = c.subject_id
      );
  end if;
end $$;
