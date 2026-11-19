-- V4 3단계(2026-11-19): 강사 작성 [저장]/[제출] 구분, 학과장 검수 [확정] = 그 강사·그 과목 한 건만 공개.
-- 운영 DB에는 사용자가 직접 실행한다. 20261119010000(v4_foundation) 다음.
-- - [저장]: v4_teacher_drafts(본인만, 학과장·관리자는 읽기). 공개·검수와 상관없음.
-- - [제출]: 기존 comsw_submit_curriculum / comsw_save_my_profile 그대로(대기 줄·대기 프로필).
-- - [확정]: 기존 승인 함수(comsw_approve_curriculum)는 강사 준비물을 공통 준비물에 자동으로 넣고 학과 연결·순서도 바꾸므로
--   V4는 쓰지 않는다. 확정은 정확히 4단계일 때만, 학과장이 고친 문구(summary)와 함께 한 트랜잭션으로.
--   예전 검수본(4단계가 아닌 것 포함)은 지우기 전에 v4_curricula_archive에 보관한다(원문 보존).
-- - 프로필 확정은 홈페이지 노출(is_listed)을 바꾸지 않는다(노출은 강사 목록 버튼으로 따로).

create table public.v4_teacher_drafts (
  instructor_id uuid not null references public.instructors on delete cascade,
  kind text not null check (kind in ('curriculum', 'profile')),
  target text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (instructor_id, kind, target)
);
grant select, insert, update, delete on public.v4_teacher_drafts to authenticated;
alter table public.v4_teacher_drafts enable row level security;
create policy own_all on public.v4_teacher_drafts for all to authenticated
  using (instructor_id in (select public.comsw_my_instructor_ids()))
  with check (instructor_id in (select public.comsw_my_instructor_ids()));
create policy staff_read on public.v4_teacher_drafts for select to authenticated
  using (public.comsw_role() in ('admin', 'head'));

create table public.v4_curricula_archive (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null,
  set_id uuid not null,
  subject_id uuid not null,
  rows jsonb not null,
  archived_at timestamptz not null default now(),
  archived_by text
);
grant select on public.v4_curricula_archive to authenticated;
alter table public.v4_curricula_archive enable row level security;
create policy staff_read on public.v4_curricula_archive for select to authenticated
  using (public.comsw_role() in ('admin', 'head'));

-- 강사 커리큘럼 한 건 확정. p_steps = [{id, updated_at, summary}] 이번 제출 4줄(화면이 본 버전, 학과장이 고친 문구).
create function public.comsw_v4_confirm_curriculum(p_instructor uuid, p_set uuid, p_subject uuid, p_steps jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare n int; old jsonb;
begin
  perform comsw_private.v4_guard();
  perform pg_advisory_xact_lock(hashtext('comsw-curriculum'), hashtext(p_instructor::text));
  select count(*) into n from public.instructor_curricula
    where instructor_id = p_instructor and set_id = p_set and subject_id = p_subject and status = 'pending';
  if n = 0 then raise exception '확정할 제출이 없습니다' using errcode = 'P0001'; end if;
  if n <> 4 then raise exception '4단계가 모두 있어야 확정할 수 있습니다(지금 %단계)', n using errcode = 'P0001'; end if;
  if jsonb_array_length(coalesce(p_steps, '[]'::jsonb)) <> 4 or exists(
    select 1 from public.instructor_curricula c
    where c.instructor_id = p_instructor and c.set_id = p_set and c.subject_id = p_subject and c.status = 'pending'
      and not exists(select 1 from jsonb_array_elements(p_steps) x
                     where (x->>'id')::uuid = c.id and (x->>'updated_at')::timestamptz = c.updated_at)) then
    raise exception '그사이 제출이 바뀌었습니다. 새로 불러온 뒤 확정해주세요' using errcode = 'P0001';
  end if;
  update public.instructor_curricula c set summary = nullif(btrim(x->>'summary'), '')
    from jsonb_array_elements(p_steps) x where c.id = (x->>'id')::uuid and x ? 'summary';
  select jsonb_agg(to_jsonb(c) order by c.sort_order nulls last, c.step_label) into old
    from public.instructor_curricula c
    where c.instructor_id = p_instructor and c.set_id = p_set and c.subject_id = p_subject and c.status = 'approved';
  if old is not null then
    insert into public.v4_curricula_archive(instructor_id, set_id, subject_id, rows, archived_by)
      values (p_instructor, p_set, p_subject, old, auth.jwt() ->> 'sub');
    delete from public.instructor_curricula
      where instructor_id = p_instructor and set_id = p_set and subject_id = p_subject and status = 'approved';
  end if;
  update public.instructor_curricula set status = 'approved', updated_at = clock_timestamp()
    where instructor_id = p_instructor and set_id = p_set and subject_id = p_subject and status = 'pending';
  -- 이 강사의 담당 과목·학과(강사 소개에 쓰임). 과목의 학과 구성·순서·공통 준비물은 건드리지 않는다.
  insert into public.instructor_subjects(instructor_id, subject_id) values (p_instructor, p_subject) on conflict do nothing;
  insert into public.instructor_departments(instructor_id, department_id)
    select p_instructor, department_id from public.curriculum_sets where id = p_set and department_id is not null
  on conflict do nothing;
  perform comsw_private.v4_publish();
end $$;

-- 프로필 한 건 확정. 학과장이 고친 경력·한마디(없으면 제출 그대로). 노출 여부는 그대로.
create function public.comsw_v4_confirm_profile(p_instructor uuid, p_updated_at timestamptz, p_career text default null, p_message text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare d public.instructor_profile_drafts;
begin
  perform comsw_private.v4_guard();
  select * into d from public.instructor_profile_drafts where instructor_id = p_instructor for update;
  if not found or d.status <> 'pending' then raise exception '확정할 프로필 제출이 없습니다' using errcode = 'P0001'; end if;
  if d.updated_at is distinct from p_updated_at then
    raise exception '그사이 프로필이 바뀌었습니다. 새로 불러온 뒤 확정해주세요' using errcode = 'P0001';
  end if;
  if length(coalesce(p_career, '')) > 10000 or length(coalesce(p_message, '')) > 2000 then
    raise exception '경력·한마디의 길이를 확인해주세요' using errcode = 'P0001';
  end if;
  update public.instructors set name = d.name, career = coalesce(p_career, d.career), message = coalesce(p_message, d.message),
    photo_url = coalesce(d.photo_url, photo_url) where id = p_instructor;
  update public.instructor_profile_drafts set career = coalesce(p_career, career), message = coalesce(p_message, message),
    status = 'approved', updated_at = clock_timestamp() where instructor_id = p_instructor;
  perform comsw_private.v4_publish();
end $$;

revoke all on function public.comsw_v4_confirm_curriculum(uuid, uuid, uuid, jsonb),
  public.comsw_v4_confirm_profile(uuid, timestamptz, text, text) from public, anon;
grant execute on function public.comsw_v4_confirm_curriculum(uuid, uuid, uuid, jsonb),
  public.comsw_v4_confirm_profile(uuid, timestamptz, text, text) to authenticated;
