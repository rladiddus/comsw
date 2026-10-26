-- '+ 개월 추가'(사용자 요청 2026-10-27): 과정이 여러 달이면 과목을 '웹툰1, 웹툰2 …'처럼 달마다 따로 둔다(각 과목 안에 1~4단계).
-- 선생님·학과장·관리자가 커리큘럼을 낼 때 다음 달 과목이 없으면 이 함수로 만든다:
-- 이름은 원래 과목 이름(끝 숫자 뺀 것) + 숫자만 허용, 같은 이름이 있으면 그 과목을 쓰고, 새로 만들면 원래 과목의 학과에 연결한다.
-- 새 과목은 전체수업 순서가 없어 '승인 전 신규 과목'이고, 첫 커리큘럼 승인 때 전체수업 맨 뒤에 들어간다(20261023050000).
create function public.comsw_create_month_subject(p_from uuid, p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare base text; result uuid; n text := btrim(coalesce(p_name, ''));
begin
  if coalesce(public.comsw_role(), '') not in ('admin', 'head', 'teacher') then
    raise exception '권한이 없습니다' using errcode = '42501';
  end if;
  select regexp_replace(name, '\s*\d+$', '') into base from public.subjects where id = p_from;
  if base is null then raise exception '과목을 다시 선택해주세요'; end if;
  if n !~ ('^' || regexp_replace(base, '([\.^$|?*+()\[\]{}])', '\\1', 'g') || '\s*\d+$') or length(n) > 80 then
    raise exception '과목 이름은 ''%'' 뒤에 숫자만 붙일 수 있습니다', base;
  end if;
  perform pg_advisory_xact_lock(hashtext('comsw-month-subject'), hashtext(n));
  select id into result from public.subjects where name = n;
  if result is not null then return result; end if;
  insert into public.subjects(name, duration)
    select n, duration from public.subjects where id = p_from
  returning id into result;
  insert into public.subject_departments(subject_id, department_id)
    select result, department_id from public.subject_departments where subject_id = p_from
  on conflict do nothing;
  return result;
end $$;
revoke all on function public.comsw_create_month_subject(uuid, text) from public, anon;
grant execute on function public.comsw_create_month_subject(uuid, text) to authenticated;
