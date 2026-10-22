-- 내 프로필 > 수업 설정: 선생님이 본인 강사 정보의 학과·담당 과목을 직접 정한다.
-- 관리 화면 '강사'의 학과·담당 과목과 같은 표이고, 공개 사이트 학과 강사소개에는 '적용' 후 나온다.
create policy teacher_read_own on public.instructor_departments for select to authenticated
  using (public.comsw_role() = 'teacher' and instructor_id in (select public.comsw_my_instructor_ids()));
create policy teacher_read_own on public.instructor_subjects for select to authenticated
  using (public.comsw_role() = 'teacher' and instructor_id in (select public.comsw_my_instructor_ids()));

-- 과목은 고른 학과에 속한 것만 받는다. 남는 과목은 예전 순서를 지키고 새 과목은 뒤에 붙인다.
create function public.comsw_set_my_classes(p_department_ids uuid[], p_subject_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare u text := comsw_private.member_uid(); i uuid;
begin
  perform pg_advisory_xact_lock(hashtext('comsw-account'), hashtext(u));
  select id into i from public.instructors where account_uid = u;
  if i is null then raise exception '먼저 강사 정보를 연결해주세요'; end if;
  p_department_ids := coalesce(p_department_ids, '{}');
  p_subject_ids := coalesce(p_subject_ids, '{}');
  if exists(select 1 from unnest(p_department_ids) d
            where not exists(select 1 from public.departments x where x.id = d and x.is_active)) then
    raise exception '학과를 다시 선택해주세요';
  end if;
  if exists(select 1 from unnest(p_subject_ids) s
            where not exists(select 1 from public.subject_departments x
                             where x.subject_id = s and x.department_id = any(p_department_ids))) then
    raise exception '고른 학과의 과목만 선택할 수 있습니다';
  end if;
  delete from public.instructor_departments where instructor_id = i and department_id <> all(p_department_ids);
  insert into public.instructor_departments(instructor_id, department_id)
    select i, d from unnest(p_department_ids) d on conflict do nothing;
  delete from public.instructor_subjects where instructor_id = i and subject_id <> all(p_subject_ids);
  insert into public.instructor_subjects(instructor_id, subject_id, sort_order)
    select i, s, (select coalesce(max(sort_order), 0) from public.instructor_subjects where instructor_id = i) + n
    from unnest(p_subject_ids) with ordinality t(s, n)
    where not exists(select 1 from public.instructor_subjects x where x.instructor_id = i and x.subject_id = s);
end $$;
revoke all on function public.comsw_set_my_classes(uuid[], uuid[]) from public, anon;
grant execute on function public.comsw_set_my_classes(uuid[], uuid[]) to authenticated;
