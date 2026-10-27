-- 과목 승인 없이 바로 쓰기 + 학과 관리 › 과목 관리(2026-10-27, 사용자 요청 + Codex 계획 검토 반영).
-- ① 학과장·관리자가 만든 과목은 바로 전체수업 맨 뒤(학과 커리큘럼·로드맵·사이트 '적용' 후)에 들어간다.
--    선생님이 '+ 개월 추가'로 만든 과목은 지금처럼 첫 커리큘럼 승인 때 들어간다(선생님은 바로 작성 가능, 사용자 결정).
-- ② 남은 '승인 전' 과목은 과목 관리 › 정리 필요에서 학과장이 바로 넣거나 지운다.
-- ③ 과목 사용처를 한 번에 세는 함수와, 사용처를 다시 확인하고 지우는 함수.
-- ④ 선생님 제출은 본인 담당 과목(또는 이미 커리큘럼을 낸 과목)만(Codex 검토: 서버 검사 없음).

-- 전체수업 맨 뒤 순서. 같은 잠금으로 동시에 만들어도 순서가 겹치지 않게 한다.
-- ponytail: comsw_approve_curriculum 의 '첫 승인 때 맨 뒤'는 이 잠금을 안 써서 드물게 같은 순서가 날 수 있음(정렬은 이름이 2차 기준). 겹침이 문제되면 그 함수도 이 함수로.
create function comsw_private.next_subject_order() returns int
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('comsw-subject-order'));
  return (select coalesce(max(sort_order), -1) + 1 from public.subjects);
end $$;
revoke all on function comsw_private.next_subject_order() from public, anon, authenticated;

-- 신규 과목 추가(학과장·관리자): 과목 + 학과 연결을 한 번에, 전체수업 맨 뒤로. 새 과목 id를 돌려준다.
create function public.comsw_create_subject(p_name text, p_department_ids uuid[]) returns uuid
language plpgsql security definer set search_path = '' as $$
declare n text := btrim(coalesce(p_name, '')); ids uuid[]; result uuid;
begin
  if coalesce(public.comsw_role(), '') not in ('admin', 'head') then raise exception '권한이 없습니다' using errcode = '42501'; end if;
  if length(n) not between 1 and 80 then raise exception '과목명을 1~80자로 입력해주세요'; end if;
  select array_agg(distinct d) into ids from unnest(coalesce(p_department_ids, '{}')) d where d is not null;
  if ids is null then raise exception '학과를 하나 이상 골라주세요'; end if;
  if (select count(*) from public.departments where id = any(ids)) <> cardinality(ids) then
    raise exception '학과를 다시 골라주세요';
  end if;
  if exists(select 1 from public.subjects where name = n) then raise exception '같은 이름의 과목이 이미 있습니다'; end if;
  insert into public.subjects(name, sort_order) values (n, comsw_private.next_subject_order()) returning id into result;
  insert into public.subject_departments(subject_id, department_id) select result, d from unnest(ids) d;
  return result;
end $$;
revoke all on function public.comsw_create_subject(text, uuid[]) from public, anon;
grant execute on function public.comsw_create_subject(text, uuid[]) to authenticated;

-- '+ 개월 추가': 규칙은 그대로(20261027040000). 학과장·관리자가 새로 만들고 학과 연결이 있으면 바로 맨 뒤 순서.
-- 이미 있는 이름이면 그 과목을 그대로 돌려준다(상태를 바꾸지 않음).
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
  if role in ('admin', 'head') and exists(select 1 from public.subject_departments where subject_id = result) then
    update public.subjects set sort_order = comsw_private.next_subject_order() where id = result;
  end if;
  return result;
end $$;

-- 정리 필요 › '학과 커리큘럼에 넣기': 학과 연결은 있고 순서가 없는(승인 전) 과목을 바로 맨 뒤로.
create function public.comsw_activate_subject(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(public.comsw_role(), '') not in ('admin', 'head') then raise exception '권한이 없습니다' using errcode = '42501'; end if;
  if not exists(select 1 from public.subject_departments where subject_id = p_id) then
    raise exception '학과가 없는 과목은 기타 과목에서 학과에 넣어주세요';
  end if;
  update public.subjects set sort_order = comsw_private.next_subject_order() where id = p_id and sort_order is null;
end $$;
revoke all on function public.comsw_activate_subject(uuid) from public, anon;
grant execute on function public.comsw_activate_subject(uuid) to authenticated;

-- 과목마다 사용처 개수(학과장·관리자). 과목을 지우면 이것들이 함께 지워진다(모두 on delete cascade).
create function public.comsw_subject_usage() returns table(
  subject_id uuid, departments int, weeks int, approved int, pending int, vacation int,
  instructors int, materials int, prep int, roadmap int)
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(public.comsw_role(), '') not in ('admin', 'head') then raise exception '권한이 없습니다' using errcode = '42501'; end if;
  return query
  select s.id,
    (select count(*)::int from public.subject_departments x where x.subject_id = s.id),
    (select count(*)::int from public.subject_weeks x where x.subject_id = s.id),
    (select count(*)::int from public.instructor_curricula x where x.subject_id = s.id and x.status = 'approved' and not x.vacation),
    (select count(*)::int from public.instructor_curricula x where x.subject_id = s.id and x.status <> 'approved' and not x.vacation),
    (select count(*)::int from public.instructor_curricula x where x.subject_id = s.id and x.vacation),
    (select count(*)::int from public.instructor_subjects x where x.subject_id = s.id),
    (select count(*)::int from public.instructor_subject_materials x where x.subject_id = s.id),
    (select count(*)::int from public.course_prep_items x where x.subject_id = s.id),
    (select count(*)::int from public.roadmap_step_subjects x where x.subject_id = s.id)
  from public.subjects s;
end $$;
revoke all on function public.comsw_subject_usage() from public, anon;
grant execute on function public.comsw_subject_usage() to authenticated;

-- 과목 지우기(학과장·관리자). p_used = false 이면 학과 연결 말고는 아무 데도 안 쓰는 과목만 지운다
-- (확인창을 띄운 뒤 다른 사람이 커리큘럼을 내면 거절). 사용 중인 과목은 확인창에서 사용처를 보여 준 뒤 p_used = true 로.
create function public.comsw_delete_subjects(p_ids uuid[], p_used boolean default false) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if coalesce(public.comsw_role(), '') not in ('admin', 'head') then raise exception '권한이 없습니다' using errcode = '42501'; end if;
  perform 1 from public.subjects where id = any(p_ids) for update;
  if not coalesce(p_used, false) and exists(
    select 1 from public.subjects s where s.id = any(p_ids) and (
      exists(select 1 from public.subject_weeks x where x.subject_id = s.id)
      or exists(select 1 from public.instructor_curricula x where x.subject_id = s.id)
      or exists(select 1 from public.instructor_subjects x where x.subject_id = s.id)
      or exists(select 1 from public.instructor_subject_materials x where x.subject_id = s.id)
      or exists(select 1 from public.course_prep_items x where x.subject_id = s.id)
      or exists(select 1 from public.roadmap_step_subjects x where x.subject_id = s.id))) then
    raise exception '그 사이 이 과목을 쓰는 곳이 생겼습니다. 화면을 다시 열어 확인해주세요';
  end if;
  delete from public.subjects where id = any(p_ids);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.comsw_delete_subjects(uuid[], boolean) from public, anon;
grant execute on function public.comsw_delete_subjects(uuid[], boolean) to authenticated;

-- 제출(20261027070000)에 선생님 과목 검사 추가: 본인 제출이고 선생님이면 담당 과목 또는 이미 커리큘럼을 낸 과목만.
create or replace function public.comsw_submit_curriculum(p_set_id uuid, p_vacation boolean, p_subjects jsonb, p_instructor_id uuid default null)
returns int language plpgsql security definer set search_path = '' as $$
declare role text := coalesce(public.comsw_role(), ''); i uuid; s jsonb; st jsonb; sid uuid; sent int := 0;
begin
  if role not in ('admin', 'head', 'teacher') then raise exception '권한이 없습니다' using errcode = '42501'; end if;
  if p_instructor_id is null then
    select id into i from public.instructors where account_uid = comsw_private.member_uid();
    if i is null then raise exception '먼저 강사 정보를 연결해주세요'; end if;
  else
    if role not in ('admin', 'head') then raise exception '다른 선생님 커리큘럼은 학과장·관리자만 올릴 수 있습니다' using errcode = '42501'; end if;
    select id into i from public.instructors where id = p_instructor_id;
    if i is null then raise exception '강사를 다시 선택해주세요'; end if;
  end if;
  perform pg_advisory_xact_lock(hashtext('comsw-curriculum'), hashtext(i::text));
  if not exists(select 1 from public.curriculum_sets where id = p_set_id) then raise exception '선택 학과를 다시 골라주세요'; end if;
  for s in select * from jsonb_array_elements(coalesce(p_subjects, '[]'::jsonb)) loop
    if s ? 'new_name' then
      sid := public.comsw_create_month_subject((s->>'from')::uuid, s->>'new_name');
    else
      select id into sid from public.subjects where id = (s->>'subject_id')::uuid;
      if sid is null then raise exception '과목을 다시 선택해주세요'; end if;
      if role = 'teacher' and not exists(select 1 from public.instructor_subjects where instructor_id = i and subject_id = sid)
         and not exists(select 1 from public.instructor_curricula where instructor_id = i and subject_id = sid) then
        raise exception '내 프로필 > 수업 설정에서 고른 과목만 제출할 수 있습니다' using errcode = '42501';
      end if;
    end if;
    if s ? 'tools' or s ? 'supplies' then
      if length(coalesce(s->>'tools', '')) > 2000 or length(coalesce(s->>'supplies', '')) > 2000 then
        raise exception '프로그램·준비물은 2000자까지 쓸 수 있습니다';
      end if;
      insert into public.instructor_subject_materials(instructor_id, subject_id, tools, supplies)
        values (i, sid, nullif(btrim(s->>'tools'), ''), nullif(btrim(s->>'supplies'), ''))
      on conflict (instructor_id, subject_id) do update
        set tools = excluded.tools, supplies = excluded.supplies, updated_at = now();
    end if;
    for st in select * from jsonb_array_elements(coalesce(s->'steps', '[]'::jsonb)) loop
      perform comsw_private.put_pending_step(i, p_set_id, sid, st->>'step_label', st->>'written', st->>'media_url', p_vacation);
      sent := sent + 1;
    end loop;
  end loop;
  return sent;
end $$;
