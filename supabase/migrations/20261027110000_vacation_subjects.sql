-- 방특 과목(2026-10-27, 사용자 요청): 기타 과목 화면에서 '방특'에 체크한 과목은
-- 선생님이 '방특'에 체크하고 낼 때 수업 설정과 관계없이 고를 수 있다(학과 없는 방학 특강 수업용).
alter table public.subjects add column is_vacation boolean not null default false;

-- 제출(20261027090000)의 선생님 과목 검사에 '방특으로 낸 방특 과목'을 더한다. 나머지는 그대로.
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
