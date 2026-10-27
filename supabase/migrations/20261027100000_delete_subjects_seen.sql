-- 과목 지우기: 확인창에 보여 준 사용처 개수(p_seen)와 지금 개수가 같을 때만 지운다(Codex 검토 ①, 2026-10-27).
-- 예전 p_used = true 는 다시 세지 않아, 확인창을 띄운 사이 새로 낸 커리큘럼까지 함께 지워졌다.
-- 과목 관리와 기타 과목 '삭제'가 모두 이 함수를 쓴다. 학과 연결은 세지 않는다(지워도 되는 것).
drop function public.comsw_delete_subjects(uuid[], boolean);

create function public.comsw_delete_subjects(p_ids uuid[], p_seen int) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if coalesce(public.comsw_role(), '') not in ('admin', 'head') then raise exception '권한이 없습니다' using errcode = '42501'; end if;
  -- 과목 줄을 잠가 세는 동안 새 사용처(외래키)가 붙지 못하게 한다.
  perform 1 from public.subjects where id = any(p_ids) for update;
  if (select count(*) from public.subject_weeks where subject_id = any(p_ids))
     + (select count(*) from public.instructor_curricula where subject_id = any(p_ids))
     + (select count(*) from public.instructor_subjects where subject_id = any(p_ids))
     + (select count(*) from public.instructor_subject_materials where subject_id = any(p_ids))
     + (select count(*) from public.course_prep_items where subject_id = any(p_ids))
     + (select count(*) from public.roadmap_step_subjects where subject_id = any(p_ids))
     <> coalesce(p_seen, 0) then
    raise exception '그 사이 이 과목을 쓰는 곳이 바뀌었습니다. 화면을 다시 열어 확인해주세요';
  end if;
  delete from public.subjects where id = any(p_ids);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.comsw_delete_subjects(uuid[], int) from public, anon;
grant execute on function public.comsw_delete_subjects(uuid[], int) to authenticated;
