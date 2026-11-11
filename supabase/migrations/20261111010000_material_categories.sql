-- 선생님 준비물을 분류(물품·교재·AI 도구)로 받기(2026-11-11 사용자 요청). 이 파일은 사용자가 운영 DB에 직접 실행한다.
-- ① instructor_subject_materials에 교재(textbook)·AI 도구(ai) 칸. 기존 supplies는 '물품'.
-- ② 제출(comsw_submit_curriculum): textbook·ai도 저장. 나머지는 20261103020000 그대로.
-- ③ 승인(comsw_approve_curriculum): 수업별 준비물에 분류대로(교재 → textbook, 물품 → supply, AI 도구 → ai) 넣고,
--    과목 '준비물' 칸(subjects.supplies, 사이트 학과 커리큘럼)에는 교재·물품을 합친다(AI 도구는 넣지 않음). 나머지는 20261027060000 그대로.
-- 실행 전에는 관리 화면에서 교재·AI 도구 고르기만 잠긴다(물품만).

alter table public.instructor_subject_materials
  add column if not exists textbook text,
  add column if not exists ai text;

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
         and not exists(select 1 from public.subject_departments sd
           join public.instructor_departments idp on idp.department_id = sd.department_id
           where idp.instructor_id = i and sd.subject_id = sid)
        and not (coalesce(p_vacation, false) and exists(select 1 from public.subjects where id = sid and is_vacation))
        and not (coalesce(p_vacation, false) and exists(select 1 from public.vacation_set_subjects where set_id = p_set_id and subject_id = sid)) then
        raise exception '내 학과의 과목만 제출할 수 있습니다. 내 프로필 > 수업 설정에서 학과를 저장해주세요' using errcode = '42501';
      end if;
    end if;
    if s ? 'tools' or s ? 'supplies' or s ? 'textbook' or s ? 'ai' then
      if greatest(length(coalesce(s->>'tools', '')), length(coalesce(s->>'supplies', '')), length(coalesce(s->>'textbook', '')), length(coalesce(s->>'ai', ''))) > 2000 then
        raise exception '프로그램·준비물은 2000자까지 쓸 수 있습니다';
      end if;
      insert into public.instructor_subject_materials(instructor_id, subject_id, tools, supplies, textbook, ai)
        values (i, sid, nullif(btrim(s->>'tools'), ''), nullif(btrim(s->>'supplies'), ''), nullif(btrim(s->>'textbook'), ''), nullif(btrim(s->>'ai'), ''))
      on conflict (instructor_id, subject_id) do update
        set tools = excluded.tools, supplies = excluded.supplies, textbook = excluded.textbook, ai = excluded.ai, updated_at = now();
    end if;
    for st in select * from jsonb_array_elements(coalesce(s->'steps', '[]'::jsonb)) loop
      perform comsw_private.put_pending_step(i, p_set_id, sid, st->>'step_label', st->>'written', st->>'media_url', p_vacation);
      sent := sent + 1;
    end loop;
  end loop;
  return sent;
end $$;

create or replace function public.comsw_approve_curriculum(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.instructor_curricula; m public.instructor_subject_materials;
begin
  if coalesce(public.comsw_role(), '') not in ('admin','head') then raise exception '승인 권한이 없습니다' using errcode='42501'; end if;
  select * into c from public.instructor_curricula where id=p_id for update;
  if not found then raise exception '커리큘럼을 찾을 수 없습니다'; end if;
  perform pg_advisory_xact_lock(hashtext('comsw-approve'),hashtext(c.instructor_id::text||c.set_id::text||c.subject_id::text||c.step_label));
  delete from public.instructor_curricula where id<>c.id and status='approved' and set_id=c.set_id and instructor_id=c.instructor_id and subject_id=c.subject_id and step_label=c.step_label;
  update public.instructor_curricula set status='approved',updated_at=clock_timestamp() where id=c.id;
  insert into public.instructor_subjects(instructor_id,subject_id)
    values(c.instructor_id,c.subject_id) on conflict do nothing;
  insert into public.instructor_departments(instructor_id,department_id)
    select c.instructor_id,department_id from public.curriculum_sets where id=c.set_id and department_id is not null on conflict do nothing;
  insert into public.subject_departments(subject_id, department_id)
    select c.subject_id, cs.department_id from public.curriculum_sets cs
    where cs.id = c.set_id and cs.department_id is not null
      and exists(select 1 from public.subject_departments where subject_id = c.subject_id)
  on conflict do nothing;
  update public.subjects
    set sort_order = (select coalesce(max(sort_order), -1) + 1 from public.subjects)
    where id = c.subject_id and sort_order is null
      and exists(select 1 from public.subject_departments where subject_id = c.subject_id);
  -- 이 강사가 이 과목에 적은 프로그램·준비물: 과목 칸에 합치고(준비물 칸 = 교재 + 물품), 수업별 준비물에 분류대로 넣는다.
  select * into m from public.instructor_subject_materials where instructor_id=c.instructor_id and subject_id=c.subject_id;
  if found then
    update public.subjects
      set tools = comsw_private.merge_items(tools, m.tools),
          supplies = comsw_private.merge_items(comsw_private.merge_items(supplies, m.textbook), m.supplies)
      where id = c.subject_id;
    insert into public.course_prep_items(subject_id, category, content, sort_order)
      select c.subject_id, a.cat, a.item,
             (select coalesce(max(sort_order), -1) from public.course_prep_items where subject_id = c.subject_id)
               + row_number() over (order by a.ord, a.n)
      from (
        -- 같은 항목이 여러 분류에 있으면 앞 분류(교재 → 물품 → AI 도구) 하나만
        select distinct on (lower(regexp_replace(btrim(t.x), '\s', '', 'g'))) v.cat, btrim(t.x) item, v.ord, t.n
        from (values ('textbook', m.textbook, 1), ('supply', m.supplies, 2), ('ai', m.ai, 3)) v(cat, txt, ord)
        cross join lateral regexp_split_to_table(coalesce(v.txt, ''), '[,\n\r]+') with ordinality t(x, n)
        where btrim(t.x) <> ''
        order by lower(regexp_replace(btrim(t.x), '\s', '', 'g')), v.ord, t.n
      ) a
      where lower(regexp_replace(a.item, '\s', '', 'g')) not in (
        select lower(regexp_replace(coalesce(p.content, ''), '\s', '', 'g'))
        from public.course_prep_items p where p.subject_id = c.subject_id
      );
  end if;
end $$;
