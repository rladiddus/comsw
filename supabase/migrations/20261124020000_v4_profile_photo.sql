-- 강사 프로필 확정: 공개할 사진을 학과장·관리자가 고른다(2026-11-24 사용자 요청). 운영 DB에는 사용자가 직접 실행한다. 20261124010000 다음.
--   p_photo_url = 고른 사진 주소(강사 업로드를 공개용으로 올린 것 또는 AI 사진). 비우면 지금 홈페이지 사진 그대로.
--   (전에는 AI 사진이 있으면 늘 그 사진으로 바뀌었다.)
drop function public.comsw_v4_confirm_profile(uuid, timestamptz, text, text);

create function public.comsw_v4_confirm_profile(p_instructor uuid, p_updated_at timestamptz, p_career text default null, p_message text default null, p_photo_url text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare d public.instructor_profile_drafts; photo text := nullif(btrim(p_photo_url), '');
begin
  perform comsw_private.v4_guard();
  select * into d from public.instructor_profile_drafts where instructor_id = p_instructor for update;
  if not found or d.status <> 'pending' then raise exception '확정할 프로필 제출이 없습니다' using errcode = 'P0001'; end if;
  if d.updated_at is distinct from p_updated_at then
    raise exception '그사이 프로필이 바뀌었습니다. 새로 불러온 뒤 확정해주세요' using errcode = 'P0001';
  end if;
  if length(coalesce(p_career, '')) > 10000 or length(coalesce(p_message, '')) > 2000 then
    raise exception '경력·한마디의 길이를 확인해주세요' using errcode = 'P0001';
  end if;
  if photo is not null and (photo !~* '^https?://' or length(photo) > 2000) then
    raise exception '사진 주소를 확인해주세요' using errcode = 'P0001';
  end if;
  update public.instructors set name = d.name, career = coalesce(p_career, d.career), message = coalesce(p_message, d.message),
    photo_url = coalesce(photo, photo_url) where id = p_instructor;
  -- 제출 기록의 사진도 실제 공개한 것으로(고르지 않았으면 비움 → 강사 화면은 홈페이지 사진을 보인다)
  update public.instructor_profile_drafts set career = coalesce(p_career, career), message = coalesce(p_message, message),
    photo_url = photo, status = 'approved', updated_at = clock_timestamp() where instructor_id = p_instructor;
  perform comsw_private.v4_publish();
end $$;
revoke all on function public.comsw_v4_confirm_profile(uuid, timestamptz, text, text, text) from public, anon;
grant execute on function public.comsw_v4_confirm_profile(uuid, timestamptz, text, text, text) to authenticated;
