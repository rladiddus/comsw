-- 선생님이 낸 커리큘럼(대기)을 승인: 같은 세트·강사·과목·주차의 예전 승인 줄을 지우고 이 줄을 승인한다(한 트랜잭션).
create function public.comsw_approve_curriculum(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c instructor_curricula;
begin
  if coalesce(comsw_role(), '') not in ('admin', 'head') then
    raise exception '승인 권한이 없습니다';
  end if;
  select * into c from instructor_curricula where id = p_id for update;
  if not found then raise exception '커리큘럼을 찾을 수 없습니다'; end if;
  delete from instructor_curricula
  where id <> c.id and status = 'approved' and set_id = c.set_id and instructor_id = c.instructor_id
    and subject_id = c.subject_id and step_label = c.step_label;
  update instructor_curricula set status = 'approved', updated_at = now() where id = c.id;
end $$;

revoke all on function public.comsw_approve_curriculum(uuid) from public, anon;
grant execute on function public.comsw_approve_curriculum(uuid) to authenticated;
