-- 방학 특강 그룹과 선생님 '방특' 제출 (사용자 요청 2026-10-26).
-- ① curriculum_sets.is_vacation: 방학 특강 그룹(예: '2026년 여름방학특강'). 선생님의 '선택 학과' 목록·강사 커리큘럼 학과 탭에서 빠진다.
--    지금 사이트 방학 특강으로 고른 세트를 첫 그룹으로 표시한다.
-- ② instructor_curricula.vacation: 선생님이 '방특'에 체크해 낸 커리큘럼. 신청 과목(학과 승인)에는 나오지 않고
--    관리 화면 '방학 특강'에서 그룹에 담는다(그 그룹 세트로 옮기고 승인).
alter table public.curriculum_sets add column is_vacation boolean not null default false;
update public.curriculum_sets set is_vacation = true
  where id::text = (select value from public.site_settings where key = 'vacation_set_id');
alter table public.instructor_curricula add column vacation boolean not null default false;

-- 제출 함수에 p_vacation(기본 false)을 더한다. 예전 6개 인자 호출도 그대로 동작한다.
drop function public.comsw_submit_my_curriculum(uuid, uuid, text, text, text, text);
create function public.comsw_submit_my_curriculum(p_set_id uuid,p_subject_id uuid,p_step_label text,p_written text,p_summary text,p_media_url text,p_vacation boolean default false) returns uuid
language plpgsql security definer set search_path = '' as $$
declare u text := comsw_private.member_uid(); i uuid; result uuid;
begin
  perform pg_advisory_xact_lock(hashtext('comsw-curriculum'),hashtext(u));
  select id into i from public.instructors where account_uid=u;
  if i is null then raise exception '먼저 강사 정보를 연결해주세요'; end if;
  if length(trim(coalesce(p_step_label,''))) not between 1 and 80 or length(trim(coalesce(p_written,''))) not between 1 and 12000 or length(coalesce(p_summary,''))>2000 then
    raise exception '단계와 커리큘럼 내용을 확인해주세요';
  end if;
  if coalesce(p_media_url,'')<>'' and (p_media_url not like 'https://%' or length(p_media_url)>2000) then raise exception '이미지는 https 주소를 입력해주세요'; end if;
  if not exists(select 1 from public.curriculum_sets where id=p_set_id) or not exists(select 1 from public.subjects where id=p_subject_id) then
    raise exception '학과 탭과 과목을 다시 선택해주세요';
  end if;
  select id into result from public.instructor_curricula where instructor_id=i and set_id=p_set_id and subject_id=p_subject_id and step_label=trim(p_step_label) and status='pending' and vacation=coalesce(p_vacation,false) order by updated_at desc limit 1 for update;
  if result is null then
    insert into public.instructor_curricula(set_id,instructor_id,subject_id,step_label,written,summary,media_url,status,sort_order,vacation)
    select p_set_id,i,p_subject_id,trim(p_step_label),trim(p_written),case when public.comsw_role()='teacher' then null else p_summary end,p_media_url,'pending',coalesce(max(sort_order),-1)+1,coalesce(p_vacation,false)
    from public.instructor_curricula where set_id=p_set_id returning id into result;
  else
    update public.instructor_curricula set written=trim(p_written),summary=case when public.comsw_role()='teacher' then case when written is distinct from trim(p_written) then null else summary end else p_summary end,media_url=p_media_url,updated_at=clock_timestamp() where id=result;
  end if;
  return result;
end $$;
revoke all on function public.comsw_submit_my_curriculum(uuid, uuid, text, text, text, text, boolean) from public, anon;
grant execute on function public.comsw_submit_my_curriculum(uuid, uuid, text, text, text, text, boolean) to authenticated;
