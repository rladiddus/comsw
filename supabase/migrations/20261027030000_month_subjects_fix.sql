-- 고침(2026-10-27): 과목 이름에 괄호 등 특수문자가 있으면 이름 검사(정규식)가 오류 → 정규식 없이 '원래 이름으로 시작 + 나머지는 숫자'로 검사.
create or replace function public.comsw_create_month_subject(p_from uuid, p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare base text; result uuid; n text := btrim(coalesce(p_name, ''));
begin
  if coalesce(public.comsw_role(), '') not in ('admin', 'head', 'teacher') then
    raise exception '권한이 없습니다' using errcode = '42501';
  end if;
  select regexp_replace(name, '\s*\d+$', '') into base from public.subjects where id = p_from;
  if base is null then raise exception '과목을 다시 선택해주세요'; end if;
  if left(n, length(base)) <> base or substr(n, length(base) + 1) !~ '^\s*\d+$' or length(n) > 80 then
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
