-- V3 내 커리큘럼 '과목명 동일'(2026-10-30, 사용자 요청): 체크를 끄면 선생님이 적은 새 과목명으로 낸다.
-- 새 과목은 고른 과목(p_from)의 학과 연결·기간·방특 여부를 이어받고, 순서 없이(승인 전) 만들어져
-- 강사 커리큘럼·과목 통합 커리큘럼·로드맵·과목 관리(정리 필요)에서 확인하고 넣는다.
-- 운영 DB에는 사용자가 직접 실행한다.

-- 규칙: 선생님은 내 담당 과목(수업 설정)이나 방특 과목에서만 시작할 수 있다. 이미 있는 이름은 막는다(남의 과목에 섞이지 않게).
create or replace function public.comsw_create_teacher_subject(p_from uuid, p_name text, p_vacation boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare n text := btrim(coalesce(p_name, '')); role text := coalesce(public.comsw_role(), ''); result uuid;
begin
  if role not in ('admin', 'head', 'teacher') then
    raise exception '권한이 없습니다' using errcode = '42501';
  end if;
  if not exists(select 1 from public.subjects where id = p_from) then raise exception '과목을 다시 선택해주세요'; end if;
  if role = 'teacher' and not exists(
    select 1 from public.instructor_subjects
    where subject_id = p_from and instructor_id in (select public.comsw_my_instructor_ids())
  ) and not (coalesce(p_vacation, false) and exists(select 1 from public.subjects where id = p_from and is_vacation)) then
    raise exception '내 담당 과목에서만 새 과목을 낼 수 있습니다. 내 프로필 > 수업 설정에서 과목을 확인해주세요' using errcode = '42501';
  end if;
  if n = '' or length(n) > 80 then raise exception '새 과목명은 1~80자로 입력해주세요'; end if;
  perform pg_advisory_xact_lock(hashtext('comsw-teacher-subject'), hashtext(n));
  if exists(select 1 from public.subjects where name = n) then
    raise exception '''%'' 과목이 이미 있습니다. 수업 설정에서 그 과목을 고르거나 다른 이름을 써주세요', n;
  end if;
  insert into public.subjects(name, duration, is_vacation)
    select n, duration, is_vacation from public.subjects where id = p_from
  returning id into result;
  insert into public.subject_departments(subject_id, department_id)
    select result, department_id from public.subject_departments where subject_id = p_from
  on conflict do nothing;
  return result;
end $$;
-- 제출 함수 안에서만 부른다(직접 호출 막음).
revoke all on function public.comsw_create_teacher_subject(uuid, text, boolean) from public, anon, authenticated;

-- 제출(20261027110000)에 'custom_name'(새 과목명) 갈래를 더한다. 나머지는 그대로.
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
    if s ? 'custom_name' then
      sid := public.comsw_create_teacher_subject((s->>'from')::uuid, s->>'custom_name', p_vacation);
    elsif s ? 'new_name' then
      sid := public.comsw_create_month_subject((s->>'from')::uuid, s->>'new_name');
    else
      select id into sid from public.subjects where id = (s->>'subject_id')::uuid;
      if sid is null then raise exception '과목을 다시 선택해주세요'; end if;
      if role = 'teacher' and not exists(select 1 from public.instructor_subjects where instructor_id = i and subject_id = sid)
         and not exists(select 1 from public.instructor_curricula where instructor_id = i and subject_id = sid)
        and not (coalesce(p_vacation, false) and exists(select 1 from public.subjects where id = sid and is_vacation)) then
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
