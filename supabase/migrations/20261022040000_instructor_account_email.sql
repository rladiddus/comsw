-- 관리자가 강사에 쌤톡 이메일을 미리 적어 두면, 그 선생님이 처음 로그인할 때 요청·승인 없이 연결한다.
-- 쌤톡 계정은 이메일 인증을 하지 않으므로(email_verified=false) 선생님 역할을 받은 계정만, 아직 연결 안 된 강사에만 연결한다.
alter table public.instructors add column account_email text;
-- 표 편집기는 빈 칸을 ''로 저장하므로 빈 값은 중복 검사에서 뺀다.
create unique index instructors_account_email_key on public.instructors (lower(nullif(trim(account_email), '')));

create function public.comsw_claim_my_instructor() returns uuid
language plpgsql security definer set search_path = '' as $$
declare u text := comsw_private.member_uid(); mail text := lower(trim(coalesce(auth.jwt()->>'email', ''))); result uuid;
begin
  perform pg_advisory_xact_lock(hashtext('comsw-account'), hashtext(u));
  select id into result from public.instructors where account_uid = u;
  if result is not null or mail = '' then return result; end if;
  update public.instructors set account_uid = u
    where account_uid is null and lower(nullif(trim(account_email), '')) = mail
    returning id into result;
  if result is not null then
    delete from public.instructor_link_requests where account_uid = u;
  end if;
  return result;
end $$;
revoke all on function public.comsw_claim_my_instructor() from public, anon;
grant execute on function public.comsw_claim_my_instructor() to authenticated;
