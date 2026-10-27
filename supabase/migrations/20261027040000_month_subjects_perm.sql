-- 개월 추가 권한 좁히기(Codex 리뷰 ①, 2026-10-27):
-- ① 선생님은 본인 담당 과목(instructor_subjects)을 기준으로만 다음 달 과목을 만들 수 있다. 학과장·관리자는 모든 과목.
-- ② 새로 만들 수 있는 이름은 '지금 가장 큰 번호 + 1'만(숫자 없는 원래 과목은 1로 침). 이미 있는 이름은 그 과목을 돌려준다.
--    예: 웹툰1·웹툰2가 있으면 웹툰3만 새로 만들 수 있고, 웹툰999 같은 건 막는다.
create or replace function public.comsw_create_month_subject(p_from uuid, p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare base text; result uuid; n text := btrim(coalesce(p_name, '')); role text := coalesce(public.comsw_role(), ''); next_no int;
begin
  if role not in ('admin', 'head', 'teacher') then
    raise exception '권한이 없습니다' using errcode = '42501';
  end if;
  select regexp_replace(name, '\s*\d+$', '') into base from public.subjects where id = p_from;
  if base is null then raise exception '과목을 다시 선택해주세요'; end if;
  if role = 'teacher' and not exists(
    select 1 from public.instructor_subjects
    where subject_id = p_from and instructor_id in (select public.comsw_my_instructor_ids())
  ) then
    raise exception '내 담당 과목에서만 개월을 추가할 수 있습니다. 내 프로필 > 수업 설정에서 과목을 확인해주세요' using errcode = '42501';
  end if;
  if left(n, length(base)) <> base or substr(n, length(base) + 1) !~ '^\s*\d+$' or length(n) > 80 then
    raise exception '과목 이름은 ''%'' 뒤에 숫자만 붙일 수 있습니다', base;
  end if;
  perform pg_advisory_xact_lock(hashtext('comsw-month-subject'), hashtext(base));
  select id into result from public.subjects where name = n;
  if result is not null then return result; end if;
  -- 같은 이름(끝 숫자 뺀 것)의 과목 중 가장 큰 번호. 숫자 없는 원래 과목만 있으면 1.
  select coalesce(max(btrim(substr(name, length(base) + 1))::int), 1) into next_no
    from public.subjects
    where left(name, length(base)) = base and substr(name, length(base) + 1) ~ '^\s*\d+$';
  if btrim(substr(n, length(base) + 1))::int <> next_no + 1 then
    raise exception '다음 달 과목은 ''%''부터 만들 수 있습니다', base || (next_no + 1)::text;
  end if;
  insert into public.subjects(name, duration)
    select n, duration from public.subjects where id = p_from
  returning id into result;
  insert into public.subject_departments(subject_id, department_id)
    select result, department_id from public.subject_departments where subject_id = p_from
  on conflict do nothing;
  return result;
end $$;
