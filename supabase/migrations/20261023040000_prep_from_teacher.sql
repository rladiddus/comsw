-- 선생님이 '내 커리큘럼 > 등록하기'에 적은 준비물을 승인 때 '수업별 준비물'(course_prep_items, 분류 '준비물')에도 넣는다
-- (사용자 요청 2026-10-23). 쉼표·줄바꿈으로 나눈 항목 중 그 과목 준비물 목록(분류 무관)에 없는 것만
-- (띄어쓰기·대소문자 무시) 맨 뒤에 붙인다. 과목 값(subjects.tools/supplies)에 합치는 것은 예전 그대로.
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
