-- V3 과목 묶음·방학 특강 과목(2026-11-03, 사용자와 합의). 운영 DB에는 사용자가 직접 실행한다(20261103010000 다음에).
-- ① subjects.parent_id = 대표 과목(예: 캐드1·캐드2 → '캐드'). 한 단계만: 대표 과목은 대표를 가질 수 없고, 하위 과목은 대표가 될 수 없다.
--    대표 과목을 지우면 하위 과목은 남고 연결만 풀린다. 대표 과목은 학과에 직접 넣지 않고 하위 과목의 학과를 따른다(화면 규칙).
alter table public.subjects add column parent_id uuid references public.subjects on delete set null;
alter table public.subjects add constraint subjects_parent_not_self check (parent_id <> id);

create function comsw_private.check_subject_parent() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.parent_id is not null then
    if exists(select 1 from public.subjects where id = new.parent_id and parent_id is not null) then
      raise exception '하위 과목은 대표 과목이 될 수 없습니다';
    end if;
    if exists(select 1 from public.subjects where parent_id = new.id) then
      raise exception '대표 과목은 다른 과목의 하위 과목이 될 수 없습니다';
    end if;
  end if;
  return new;
end $$;
create trigger subjects_parent_one_level before insert or update of parent_id on public.subjects
  for each row execute function comsw_private.check_subject_parent();

-- ② 방학 특강 ↔ 과목(학과 ↔ 과목과 같은 모양): 커리큘럼이 없어도 과목을 방학 특강(예: 2026년 여름방학특강)에 넣어 둔다.
create table public.vacation_set_subjects (
  set_id uuid not null references public.curriculum_sets on delete cascade,
  subject_id uuid not null references public.subjects on delete cascade,
  primary key (set_id, subject_id)
);
grant select, insert, update, delete on public.vacation_set_subjects to authenticated;
alter table public.vacation_set_subjects enable row level security;
create policy staff_all on public.vacation_set_subjects for all to authenticated
  using (public.comsw_role() in ('admin', 'head'))
  with check (public.comsw_role() in ('admin', 'head'));
create policy teacher_read on public.vacation_set_subjects for select to authenticated
  using (public.comsw_role() = 'teacher');

-- ③ 제출(20261103010000): '방특'으로 낼 때 고른 방학 특강에 넣어 둔 과목도 낼 수 있다. 나머지는 그대로.
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
