-- 과목의 '프로그램·준비물'을 관리 화면에서는 프로그램(tools)과 준비물(supplies)로 나눠 고치고,
-- 공개 사이트에는 예전처럼 한 칸(program = 프로그램 줄 + 준비물 줄)으로 보낸다(사용자 요청 2026-10-23).
-- program은 계산 칸이라 '적용'(comsw_build_rows)은 그대로 둔다.
alter table public.subjects rename column program to tools;
alter table public.subjects add column supplies text;
alter table public.subjects add column program text generated always as (
  nullif(btrim(coalesce(tools, '') || E'\n' || coalesce(supplies, ''), E' \n\r\t'), '')
) stored;

-- 준비물 처음 값 = '수업별 준비물'의 교재·준비물(AI 툴은 프로그램이라 뺌).
update public.subjects s set supplies = x.items
from (
  select subject_id, string_agg(btrim(content), E'\n' order by case category when 'textbook' then 0 else 1 end, sort_order nulls last, id) items
  from public.course_prep_items
  where category in ('textbook', 'supply') and btrim(coalesce(content, '')) <> ''
  group by subject_id
) x
where x.subject_id = s.id;
-- 예전 '프로그램·준비물' 칸에 준비물만 적혀 있던 과목(예: 아트 드로잉)은 프로그램을 비워 두 번 나오지 않게 한다.
update public.subjects
  set tools = null
  where supplies is not null
    and regexp_replace(tools, '\s', '', 'g') = regexp_replace(supplies, '\s', '', 'g');

-- 선생님이 '내 커리큘럼 > 등록하기'에서 과목별로 적는 프로그램·준비물. 승인하면 과목 값에 합친다.
create table public.instructor_subject_materials (
  instructor_id uuid not null references public.instructors on delete cascade,
  subject_id uuid not null references public.subjects on delete cascade,
  tools text,
  supplies text,
  updated_at timestamptz not null default now(),
  primary key (instructor_id, subject_id)
);
grant select, insert, update, delete on public.instructor_subject_materials to authenticated;
alter table public.instructor_subject_materials enable row level security;
create policy staff_all on public.instructor_subject_materials for all to authenticated
  using (public.comsw_role() in ('admin', 'head'))
  with check (public.comsw_role() in ('admin', 'head'));
create policy teacher_read_own on public.instructor_subject_materials for select to authenticated
  using (public.comsw_role() = 'teacher' and instructor_id in (select public.comsw_my_instructor_ids()));

create function public.comsw_save_my_materials(p_subject_id uuid, p_tools text, p_supplies text) returns void
language plpgsql security definer set search_path = '' as $$
declare u text := comsw_private.member_uid(); i uuid;
begin
  select id into i from public.instructors where account_uid = u;
  if i is null then raise exception '먼저 강사 정보를 연결해주세요'; end if;
  if length(coalesce(p_tools, '')) > 2000 or length(coalesce(p_supplies, '')) > 2000 then
    raise exception '프로그램·준비물은 2000자까지 쓸 수 있습니다';
  end if;
  if not exists(select 1 from public.subjects where id = p_subject_id) then raise exception '과목을 다시 선택해주세요'; end if;
  insert into public.instructor_subject_materials(instructor_id, subject_id, tools, supplies)
    values (i, p_subject_id, nullif(btrim(p_tools), ''), nullif(btrim(p_supplies), ''))
  on conflict (instructor_id, subject_id) do update
    set tools = excluded.tools, supplies = excluded.supplies, updated_at = now();
end $$;
revoke all on function public.comsw_save_my_materials(uuid, text, text) from public, anon;
grant execute on function public.comsw_save_my_materials(uuid, text, text) to authenticated;

-- 목록 합치기: 쉼표·줄바꿈으로 나눈 항목 중 이미 있는 것(띄어쓰기·대소문자 무시)은 빼고 새 항목만 뒤에 붙인다.
-- 새 항목이 없으면 원래 글을 그대로 둔다(줄바꿈 모양 유지).
create function comsw_private.merge_items(p_old text, p_new text) returns text
language sql immutable set search_path = '' as $$
  with old_items as (
    select lower(regexp_replace(x, '\s', '', 'g')) k
    from regexp_split_to_table(coalesce(p_old, ''), '[,\n\r]+') x
  ), added as (
    select btrim(x) item, min(n) n
    from regexp_split_to_table(coalesce(p_new, ''), '[,\n\r]+') with ordinality t(x, n)
    where btrim(x) <> ''
      and lower(regexp_replace(x, '\s', '', 'g')) not in (select k from old_items)
    group by btrim(x)
  )
  select case
    when not exists(select 1 from added) then p_old
    when btrim(coalesce(p_old, '')) = '' then (select string_agg(item, ', ' order by n) from added)
    else p_old || E'\n' || (select string_agg(item, ', ' order by n) from added)
  end
$$;

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
  -- 이 강사가 이 과목에 적은 프로그램·준비물을 과목 값에 합친다.
  select * into m from public.instructor_subject_materials where instructor_id=c.instructor_id and subject_id=c.subject_id;
  if found then
    update public.subjects
      set tools = comsw_private.merge_items(tools, m.tools),
          supplies = comsw_private.merge_items(supplies, m.supplies)
      where id = c.subject_id;
  end if;
end $$;
