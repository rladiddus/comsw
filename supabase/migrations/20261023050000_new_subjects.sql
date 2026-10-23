-- 과목·단계 메뉴를 커리큘럼 관리로 옮기며(사용자 결정 2026-10-23):
-- ① '신규 과목 추가'로 만든 과목(학과 연결 있음, 전체수업 순서 없음)은 선생님 커리큘럼이 처음 승인될 때
--    전체수업 맨 뒤에 들어간다 → 그때부터 학과 커리큘럼·로드맵 과목 목록·사이트 '전체 수업'에 나온다.
-- ② 과목을 마지막 학과에서까지 빼면 전체수업 순서를 지워 '기타 과목'으로 보낸다(어느 화면에서 빼든 같게).
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

create function comsw_private.subject_unlinked() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.subjects set sort_order = null
    where id = old.subject_id
      and not exists(select 1 from public.subject_departments where subject_id = old.subject_id);
  return null;
end $$;
create trigger subject_unlinked after delete on public.subject_departments
  for each row execute function comsw_private.subject_unlinked();
