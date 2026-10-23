-- 프로필 승인 대기에서 학과장·관리자가 '수정 요청'을 보낼 수 있다. 선생님이 고쳐 다시 내면 다시 승인 대기.
alter table public.instructor_profile_drafts drop constraint instructor_profile_drafts_status_check;
alter table public.instructor_profile_drafts add constraint instructor_profile_drafts_status_check
  check (status in ('pending','approved','changes_requested'));
alter table public.instructor_profile_drafts add column review_note text;

create function public.comsw_request_profile_changes(p_id uuid, p_note text, p_updated_at timestamptz default null) returns void
language plpgsql security definer set search_path = '' as $$
declare d public.instructor_profile_drafts;
begin
  if coalesce(public.comsw_role(),'') not in ('admin','head') then raise exception '수정 요청 권한이 없습니다' using errcode='42501'; end if;
  if length(trim(coalesce(p_note,''))) not between 1 and 2000 then raise exception '수정할 내용을 적어주세요'; end if;
  select * into d from public.instructor_profile_drafts where instructor_id=p_id for update;
  if not found or d.status<>'pending' then raise exception '승인 대기 프로필이 없습니다'; end if;
  if p_updated_at is not null and d.updated_at is distinct from p_updated_at then raise exception '프로필이 변경되었습니다. 새로 확인 후 요청해주세요'; end if;
  update public.instructor_profile_drafts set status='changes_requested', review_note=trim(p_note), updated_at=clock_timestamp()
    where instructor_id=p_id;
end $$;
revoke all on function public.comsw_request_profile_changes(uuid, text, timestamptz) from public, anon;
grant execute on function public.comsw_request_profile_changes(uuid, text, timestamptz) to authenticated;

-- 다시 제출하면 수정 요청 메모를 지운다.
create or replace function public.comsw_save_my_profile(p_name text,p_career text,p_message text,p_source_asset_id uuid,p_source_consent boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare u text := comsw_private.member_uid(); i uuid;
begin
  select id into i from public.instructors where account_uid=u;
  if i is null then raise exception '먼저 강사 정보를 연결해주세요'; end if;
  if length(trim(coalesce(p_name,''))) not between 1 and 80 or length(coalesce(p_career,''))>10000 or length(coalesce(p_message,''))>2000 then
    raise exception '이름·경력·한마디의 길이를 확인해주세요';
  end if;
  if p_source_asset_id is not null and not exists(select 1 from public.media_assets where id=p_source_asset_id and owner_uid=u and kind='profile-source') then
    raise exception '본인 사진을 다시 올려주세요';
  end if;
  if p_source_asset_id is not null and not coalesce(p_source_consent,false) then raise exception '본인 사진 사용 동의를 확인해주세요'; end if;
  insert into public.instructor_profile_drafts(instructor_id,name,career,message,source_asset_id,source_consent)
    values(i,trim(p_name),coalesce(p_career,''),coalesce(p_message,''),p_source_asset_id,coalesce(p_source_consent,false))
  on conflict(instructor_id) do update set name=excluded.name,career=excluded.career,message=excluded.message,
    photo_url=case when instructor_profile_drafts.source_asset_id is distinct from excluded.source_asset_id then null else instructor_profile_drafts.photo_url end,
    source_asset_id=excluded.source_asset_id,source_consent=excluded.source_consent,status='pending',review_note=null,updated_at=clock_timestamp();
end $$;
