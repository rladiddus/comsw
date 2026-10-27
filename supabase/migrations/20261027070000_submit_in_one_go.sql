-- 제출·개월 추가·개월 빼기를 각각 DB 함수 한 번으로(Codex 리뷰 ④⑤⑦, 2026-10-27).
-- 예전에는 화면이 '새 달 과목 만들기 → 프로그램·준비물 → 단계마다 제출'을 따로 요청해 중간 실패 시 일부만 남았고,
-- 학과장·관리자 대신 등록은 제출 함수를 거치지 않아 글자 수·https 검사와 동시 제출 잠금이 없었다.

-- 한 단계를 승인 대기로 넣기(같은 강사·학과 탭·과목·단계·방특 여부의 대기 줄이 있으면 그 줄을 고침). 검사는 본인 제출과 같다.
create function comsw_private.put_pending_step(i uuid, p_set uuid, p_subject uuid, p_label text, p_written text, p_media text, p_vacation boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid; label text := btrim(coalesce(p_label, '')); body text := btrim(coalesce(p_written, ''));
begin
  if length(label) not between 1 and 80 or length(body) not between 1 and 12000 then
    raise exception '단계와 커리큘럼 내용을 확인해주세요';
  end if;
  if coalesce(p_media, '') <> '' and (p_media not like 'https://%' or length(p_media) > 2000) then
    raise exception '이미지는 https 주소를 입력해주세요';
  end if;
  select id into result from public.instructor_curricula
    where instructor_id = i and set_id = p_set and subject_id = p_subject and step_label = label
      and status = 'pending' and vacation = coalesce(p_vacation, false)
    order by updated_at desc limit 1 for update;
  if result is null then
    insert into public.instructor_curricula(set_id, instructor_id, subject_id, step_label, written, summary, media_url, status, sort_order, vacation)
      select p_set, i, p_subject, label, body, null, nullif(p_media, ''), 'pending', coalesce(max(sort_order), -1) + 1, coalesce(p_vacation, false)
      from public.instructor_curricula where set_id = p_set
    returning id into result;
  else
    update public.instructor_curricula
      set written = body,
          summary = case when written is distinct from body then null else summary end,
          media_url = nullif(p_media, ''), updated_at = clock_timestamp()
      where id = result;
  end if;
  return result;
end $$;
revoke all on function comsw_private.put_pending_step(uuid, uuid, uuid, text, text, text, boolean) from public, anon, authenticated;

-- 커리큘럼 제출(본인, 또는 학과장·관리자가 p_instructor_id로 대신). 한 트랜잭션: 하나라도 실패하면 아무것도 저장되지 않는다.
-- p_subjects: [{ subject_id | (new_name + from), tools?, supplies?, steps: [{ step_label, written, media_url }] }]
--   new_name: '+ 개월 추가'로 연 다음 달 과목(comsw_create_month_subject 규칙 그대로: 담당 과목·다음 번호만)
--   tools/supplies: 칸이 들어오면 그 강사의 이 과목 프로그램·준비물로 저장(승인 때 과목 값에 합쳐짐)
-- 돌려주는 값: 제출한 단계 수
create function public.comsw_submit_curriculum(p_set_id uuid, p_vacation boolean, p_subjects jsonb, p_instructor_id uuid default null)
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
revoke all on function public.comsw_submit_curriculum(uuid, boolean, jsonb, uuid) from public, anon;
grant execute on function public.comsw_submit_curriculum(uuid, boolean, jsonb, uuid) to authenticated;

-- 신청 과목 '+ 개월 추가': 다음 달 과목 + 그 선생님의 빈 1단계 승인 대기 줄을 한 번에. 새(또는 기존) 과목 id를 돌려준다.
create function public.comsw_add_month_request(p_from uuid, p_name text, p_set_id uuid, p_instructor_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare sid uuid;
begin
  if coalesce(public.comsw_role(), '') not in ('admin', 'head') then raise exception '권한이 없습니다' using errcode = '42501'; end if;
  if not exists(select 1 from public.instructors where id = p_instructor_id) or not exists(select 1 from public.curriculum_sets where id = p_set_id) then
    raise exception '강사와 학과 탭을 다시 확인해주세요';
  end if;
  sid := public.comsw_create_month_subject(p_from, p_name);
  if not exists(select 1 from public.instructor_curricula
                where instructor_id = p_instructor_id and set_id = p_set_id and subject_id = sid and status = 'pending') then
    insert into public.instructor_curricula(set_id, instructor_id, subject_id, step_label, written, status, sort_order)
      select p_set_id, p_instructor_id, sid, '1단계', '', 'pending', coalesce(max(sort_order), -1) + 1
      from public.instructor_curricula where set_id = p_set_id;
  end if;
  return sid;
end $$;
revoke all on function public.comsw_add_month_request(uuid, text, uuid, uuid) from public, anon;
grant execute on function public.comsw_add_month_request(uuid, text, uuid, uuid) to authenticated;

-- 신청 과목 '이 개월 빼기': 한 묶음(같은 강사·과목·학과 탭)의 승인 대기 줄만 한 번에 지운다. 지운 줄 수를 돌려준다.
create function public.comsw_drop_requests(p_ids uuid[])
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if coalesce(public.comsw_role(), '') not in ('admin', 'head') then raise exception '권한이 없습니다' using errcode = '42501'; end if;
  if coalesce(array_length(p_ids, 1), 0) = 0 then return 0; end if;
  if (select count(*) from public.instructor_curricula where id = any(p_ids) and status = 'pending') <> array_length(p_ids, 1)
     or (select count(distinct (instructor_id, subject_id, set_id)) from public.instructor_curricula where id = any(p_ids)) <> 1 then
    raise exception '같은 묶음의 승인 대기 신청만 뺄 수 있습니다. 화면을 다시 열어 확인해주세요';
  end if;
  delete from public.instructor_curricula where id = any(p_ids);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.comsw_drop_requests(uuid[]) from public, anon;
grant execute on function public.comsw_drop_requests(uuid[]) to authenticated;
