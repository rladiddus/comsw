-- 사이트 전체에서 '주차' 대신 '단계'를 쓴다(사용자 요청 2026-10-22).
-- 'N주차' 값만 'N단계'로 바꾼다. 'N개월' 등 다른 값과 이미 'N단계'인 값은 그대로.
-- 강사 커리큘럼 이미지 후보는 과목·단계 이름이 같을 때 붙으므로 두 표를 함께 바꾼다.
update public.subject_weeks set week_label = regexp_replace(week_label, '^\s*(\d+)\s*주차\s*$', '\1단계')
  where week_label ~ '^\s*\d+\s*주차\s*$';
update public.instructor_curricula set step_label = regexp_replace(step_label, '^\s*(\d+)\s*주차\s*$', '\1단계')
  where step_label ~ '^\s*\d+\s*주차\s*$';

create or replace function public.comsw_submit_my_curriculum(p_set_id uuid,p_subject_id uuid,p_step_label text,p_written text,p_summary text,p_media_url text) returns uuid
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
  select id into result from public.instructor_curricula where instructor_id=i and set_id=p_set_id and subject_id=p_subject_id and step_label=trim(p_step_label) and status='pending' order by updated_at desc limit 1 for update;
  if result is null then
    insert into public.instructor_curricula(set_id,instructor_id,subject_id,step_label,written,summary,media_url,status,sort_order)
    select p_set_id,i,p_subject_id,trim(p_step_label),trim(p_written),case when public.comsw_role()='teacher' then null else p_summary end,p_media_url,'pending',coalesce(max(sort_order),-1)+1
    from public.instructor_curricula where set_id=p_set_id returning id into result;
  else
    update public.instructor_curricula set written=trim(p_written),summary=case when public.comsw_role()='teacher' then case when written is distinct from trim(p_written) then null else summary end else p_summary end,media_url=p_media_url,updated_at=clock_timestamp() where id=result;
  end if;
  return result;
end $$;
