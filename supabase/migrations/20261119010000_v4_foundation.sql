-- V4 관리 화면 바탕(2026-11-19, docs/v4-설계.md 5·6장). 운영 DB에는 사용자가 직접 실행한다.
-- 1) 확정한 건만 공개: 확정 함수는 먼저 "지금 실제 표로 만든 공개 자료 = 마지막 스냅샷"인지 본다(아니면 멈춤).
--    그래서 V3 등에서 고치고 '사이트에 반영'하지 않은 변경이 V4 확정에 섞여 공개되지 않는다. 확정 = 그 건 저장 + 새 스냅샷(한 트랜잭션).
-- 2) 과목 삭제 = 보관: deleted_at, 모든 학과·방학 특강·로드맵 연결 해제, 공개에서 빠짐. 자료(강사 원문·공통·준비물)는 그대로.
--    복원 = deleted_at만 지우고 relink_needed(다시 연결 필요) → 학과·방학 특강에 다시 넣기 전까지 공개되지 않음.
-- 3) 학과마다 따로 과목 순서(subject_departments.sort_order). 처음 값 = 지금 순서. 공개 화면 연결은 V4 4단계.
-- 4) 작성 중 보관함 v4_drafts(공통 커리큘럼·준비물·사이트 편집·특강의 저장 = 여기까지, 공개 안 됨).
-- 5) 옛 '웹툰'(단계 자리에 1~6개월 요약을 넣은 과목)을 삭제된 과목으로(사용자 결정). 실행 전 공개 상태가 깨끗할 때만 바로 공개.

alter table public.subjects
  add column deleted_at timestamptz,
  add column relink_needed boolean not null default false;

alter table public.subject_departments add column sort_order int;
update public.subject_departments sd set sort_order = s.sort_order
  from public.subjects s where s.id = sd.subject_id;

create table public.v4_drafts (
  kind text not null,
  target text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (kind, target)
);
grant select, insert, update, delete on public.v4_drafts to authenticated;
alter table public.v4_drafts enable row level security;
create policy staff_all on public.v4_drafts for all to authenticated
  using (public.comsw_role() in ('admin', 'head'))
  with check (public.comsw_role() in ('admin', 'head'));

-- 삭제된 과목은 복원 전에는 학과·방학 특강에 넣을 수 없고, 다시 넣으면 '다시 연결 필요'가 풀린다.
create function comsw_private.v4_subject_linked() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from public.subjects where id = new.subject_id and deleted_at is not null) then
    raise exception '삭제된 과목입니다. 복원한 뒤 연결해주세요' using errcode = 'P0001';
  end if;
  update public.subjects set relink_needed = false where id = new.subject_id and relink_needed;
  return new;
end $$;
create trigger v4_subject_linked before insert on public.subject_departments
  for each row execute function comsw_private.v4_subject_linked();
create trigger v4_subject_linked before insert on public.vacation_set_subjects
  for each row execute function comsw_private.v4_subject_linked();

-- 공개 자료에서 삭제·다시 연결 필요 과목 빼기(전체수업은 학과가 없으면 이미 빠짐: 순서가 비워짐).
alter function public.comsw_build_rows() rename to comsw_build_rows_before_v4;
create function public.comsw_build_rows() returns jsonb
language sql stable security definer set search_path = public as $$
  with hidden as (
    select name from subjects where deleted_at is not null or relink_needed
  )
  select coalesce(jsonb_agg(
    case when r ->> 'sheet_name' = '강사페이지' then
      jsonb_set(r, '{data,values,2}', to_jsonb(coalesce((
        select string_agg(x, ', ' order by o) from unnest(string_to_array(r #>> '{data,values,2}', ', ')) with ordinality u(x, o)
        where x not in (select name from hidden)), '')))
    else r end order by ord), '[]'::jsonb)
  from jsonb_array_elements(comsw_build_rows_before_v4()) with ordinality e(r, ord)
  where not ((r ->> 'sheet_name' = '수업별 준비물(AI/교재 등)' and r #>> '{data,values,0}' in (select name from hidden))
          or (r ->> 'source_id' = 'instructor_curriculum' and r #>> '{data,values,1}' in (select name from hidden)))
$$;
revoke execute on function public.comsw_build_rows() from public, anon, authenticated;
revoke execute on function public.comsw_build_rows_before_v4() from public, anon, authenticated;

-- 비교용: 특강 신청 수(방문자가 신청할 때마다 바뀜)는 빼고 본다.
create function comsw_private.v4_stable(p jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(case when r ->> 'sheet_name' = '특강 및 세미나'
    then jsonb_set(r, '{data,values,7}', '""'::jsonb) else r end order by o), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p, '[]'::jsonb)) with ordinality e(r, o)
$$;

create function comsw_private.v4_differs() returns boolean
language sql stable security definer set search_path = '' as $$
  select comsw_private.v4_stable(public.comsw_build_rows())
    is distinct from comsw_private.v4_stable((select rows from public.site_snapshots order by id desc limit 1))
$$;

-- 화면 안내용: 반영하지 않은 다른 변경이 있나(학과장·관리자만).
create function public.comsw_v4_unpublished() returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(public.comsw_role(), '') not in ('admin', 'head') then
    raise exception '권한이 없습니다' using errcode = '42501';
  end if;
  return comsw_private.v4_differs();
end $$;

-- 확정 함수마다 맨 앞: 권한, 한 번에 하나씩, 다른 미반영 변경이 없는지.
create function comsw_private.v4_guard() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(public.comsw_role(), '') not in ('admin', 'head') then
    raise exception '권한이 없습니다' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('comsw_v4_publish'));
  if comsw_private.v4_differs() then
    raise exception '사이트에 반영하지 않은 다른 변경이 있어 멈췄습니다. 기존 관리 화면에서 사이트에 반영한 뒤 다시 눌러주세요'
      using errcode = 'P0001';
  end if;
end $$;

create function comsw_private.v4_publish() returns bigint
language sql security definer set search_path = '' as $$
  insert into public.site_snapshots(published_by, rows)
  values (coalesce(auth.jwt() ->> 'sub', 'v4'), public.comsw_build_rows()) returning id
$$;

-- 과목 삭제: 영향받은 학과·방학 특강 이름을 돌려준다.
create function public.comsw_v4_delete_subject(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  perform comsw_private.v4_guard();
  if not exists(select 1 from public.subjects where id = p_id and deleted_at is null) then
    raise exception '과목이 없거나 이미 삭제되었습니다' using errcode = 'P0001';
  end if;
  select jsonb_build_object(
    'departments', coalesce((select jsonb_agg(d.name order by d.sort_order nulls last, d.name)
      from public.subject_departments sd join public.departments d on d.id = sd.department_id where sd.subject_id = p_id), '[]'),
    'vacations', coalesce((select jsonb_agg(c.name order by c.sort_order nulls last, c.name)
      from public.vacation_set_subjects v join public.curriculum_sets c on c.id = v.set_id where v.subject_id = p_id), '[]'))
  into result;
  delete from public.subject_departments where subject_id = p_id;
  delete from public.vacation_set_subjects where subject_id = p_id;
  delete from public.roadmap_step_subjects where subject_id = p_id;
  update public.subjects set deleted_at = now(), relink_needed = false where id = p_id;
  perform comsw_private.v4_publish();
  return result;
end $$;

-- 복원: 과목과 자료만. 연결·순서·공개는 다시 해야 한다(공개 자료는 그대로라 새 스냅샷 없음).
create function public.comsw_v4_restore_subject(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(public.comsw_role(), '') not in ('admin', 'head') then
    raise exception '권한이 없습니다' using errcode = '42501';
  end if;
  update public.subjects set deleted_at = null, relink_needed = true where id = p_id and deleted_at is not null;
  if not found then raise exception '삭제된 과목이 아닙니다' using errcode = 'P0001'; end if;
end $$;

-- 강사 홈페이지 노출 켜기·끄기(바로 공개). 계정 차단과는 다른 일이다.
create function public.comsw_v4_set_instructor_listed(p_id uuid, p_listed boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform comsw_private.v4_guard();
  update public.instructors set is_listed = p_listed where id = p_id;
  if not found then raise exception '강사가 없습니다' using errcode = 'P0001'; end if;
  perform comsw_private.v4_publish();
end $$;

revoke all on function comsw_private.v4_subject_linked(), comsw_private.v4_stable(jsonb), comsw_private.v4_differs(),
  comsw_private.v4_guard(), comsw_private.v4_publish() from public, anon, authenticated;
revoke all on function public.comsw_v4_unpublished(), public.comsw_v4_delete_subject(uuid),
  public.comsw_v4_restore_subject(uuid), public.comsw_v4_set_instructor_listed(uuid, boolean) from public, anon;
grant execute on function public.comsw_v4_unpublished(), public.comsw_v4_delete_subject(uuid),
  public.comsw_v4_restore_subject(uuid), public.comsw_v4_set_instructor_listed(uuid, boolean) to authenticated;

-- 옛 '웹툰' → 삭제된 과목. 실행 전 공개 상태가 깨끗했을 때만 바로 새 스냅샷(아니면 기존 화면에서 반영할 때 함께 빠짐).
do $$
declare
  wid uuid;
  clean boolean;
begin
  select id into wid from public.subjects where name = '웹툰' and deleted_at is null;
  if wid is null then return; end if;
  clean := exists(select 1 from public.site_snapshots) and not comsw_private.v4_differs();
  delete from public.subject_departments where subject_id = wid;
  delete from public.vacation_set_subjects where subject_id = wid;
  delete from public.roadmap_step_subjects where subject_id = wid;
  update public.subjects set deleted_at = now() where id = wid;
  if clean then
    insert into public.site_snapshots(published_by, rows) values ('v4-migration', public.comsw_build_rows());
  else
    raise notice '반영하지 않은 다른 변경이 있어 웹툰 삭제를 바로 공개하지 않았습니다. 기존 관리 화면에서 사이트에 반영해주세요';
  end if;
end $$;
