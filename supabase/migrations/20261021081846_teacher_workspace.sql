-- 기존 Firebase 역할과 승인/적용 스냅샷을 유지한다.
create schema if not exists comsw_private;
revoke all on schema comsw_private from public, anon, authenticated;

create function comsw_private.member_uid() returns text
language plpgsql stable set search_path = '' as $$
declare u text := auth.jwt()->>'sub';
begin
  if coalesce(public.comsw_role(), '') not in ('admin','head','teacher') or coalesce(u,'') = '' then
    raise exception '접근 권한이 없습니다' using errcode = '42501';
  end if;
  return u;
end $$;

-- 비용 집계는 서버 전용. 브라우저는 합계만 읽는다.
create table public.comsw_ai_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_uid text not null,
  kind text not null check (kind in ('week','department','roadmap','profile')),
  cache_key text not null,
  month text not null,
  budget_krw int not null check (budget_krw between 0 and 3000),
  status text not null default 'reserved' check (status in ('reserved','completed','failed')),
  result jsonb,
  usage jsonb,
  created_at timestamptz not null default now()
);
create index on public.comsw_ai_jobs(month);
create index on public.comsw_ai_jobs(owner_uid,kind,cache_key);
alter table public.comsw_ai_jobs enable row level security;
grant select on public.comsw_ai_jobs to authenticated;
create policy staff_read on public.comsw_ai_jobs for select to authenticated
  using ((select public.comsw_role()) in ('admin','head'));

create function public.comsw_ai_budget() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare spent int; m text := to_char(now() at time zone 'Asia/Seoul','YYYY-MM');
begin
  perform comsw_private.member_uid();
  select coalesce(sum(budget_krw),0) into spent from public.comsw_ai_jobs where month=m;
  return jsonb_build_object('month',m,'used',spent,'limit',3000,'remaining',greatest(0,3000-spent));
end $$;
revoke all on function public.comsw_ai_budget() from public,anon;
grant execute on function public.comsw_ai_budget() to authenticated;

create function public.comsw_reserve_ai(p_owner_uid text,p_kind text,p_cache_key text,p_reserve_krw int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m text := to_char(now() at time zone 'Asia/Seoul','YYYY-MM'); j public.comsw_ai_jobs; spent int;
begin
  -- 전 계정 합산. 같은 달의 동시 요청은 같은 잠금을 사용한다.
  perform pg_advisory_xact_lock(hashtext('comsw-ai-budget'),hashtext(m));
  if p_reserve_krw not between 1 and 3000 or coalesce(p_owner_uid,'')='' then raise exception '잘못된 비용 예약'; end if;
  select * into j from public.comsw_ai_jobs where owner_uid=p_owner_uid and kind=p_kind and cache_key=p_cache_key and status='completed' order by created_at desc limit 1;
  if found and p_kind<>'profile' then return jsonb_build_object('cached',true,'result',j.result); end if;
  if exists(select 1 from public.comsw_ai_jobs where owner_uid=p_owner_uid and kind=p_kind and cache_key=p_cache_key and status='reserved') then
    raise exception '같은 내용의 AI 작업이 진행 중입니다';
  end if;
  select coalesce(sum(budget_krw),0) into spent from public.comsw_ai_jobs where month=m;
  if spent+p_reserve_krw>3000 then raise exception '이번 달 AI 예산이 부족합니다. 다음 달에 다시 이용해주세요'; end if;
  insert into public.comsw_ai_jobs(owner_uid,kind,cache_key,month,budget_krw) values(p_owner_uid,p_kind,p_cache_key,m,p_reserve_krw) returning * into j;
  return jsonb_build_object('cached',false,'id',j.id);
end $$;

create function public.comsw_finish_ai(p_id uuid,p_cost_krw int,p_result jsonb,p_usage jsonb,p_failed boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare j public.comsw_ai_jobs;
begin
  select * into j from public.comsw_ai_jobs where id=p_id for update;
  if not found or j.status<>'reserved' then raise exception '비용 예약을 찾을 수 없습니다'; end if;
  -- 응답이 불확실한 실패는 예약액을 유지한다. 자동 재시도로 비용을 중복 발생시키지 않는다.
  update public.comsw_ai_jobs set budget_krw=case when p_failed then j.budget_krw else greatest(0,least(j.budget_krw,p_cost_krw)) end,
    status=case when p_failed then 'failed' else 'completed' end,result=p_result,usage=p_usage where id=p_id;
end $$;
revoke all on function public.comsw_reserve_ai(text,text,text,int),public.comsw_finish_ai(uuid,int,jsonb,jsonb,boolean) from public,anon,authenticated;
-- Supabase 기본 service_role은 서버에서만 사용한다. 테스트 환경에도 같은 역할을 만든다.
grant execute on function public.comsw_reserve_ai(text,text,text,int),public.comsw_finish_ai(uuid,int,jsonb,jsonb,boolean) to service_role;

create or replace function public.comsw_my_instructor_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select id from public.instructors
  where account_uid = auth.jwt()->>'sub' and public.comsw_role() in ('admin','head','teacher')
$$;
revoke all on function public.comsw_my_instructor_ids() from public, anon;
grant execute on function public.comsw_my_instructor_ids() to authenticated;

drop policy teacher_read on public.instructors;
create policy teacher_read_own on public.instructors for select to authenticated
  using ((select public.comsw_role()) = 'teacher' and account_uid = (select auth.jwt()->>'sub'));

create table public.instructor_link_requests (
  id uuid primary key default gen_random_uuid(),
  account_uid text not null unique,
  instructor_id uuid not null references public.instructors on delete cascade,
  requested_name text not null,
  created_at timestamptz not null default now()
);
create index on public.instructor_link_requests(instructor_id);
alter table public.instructor_link_requests enable row level security;
grant select, delete on public.instructor_link_requests to authenticated;
create policy staff_all on public.instructor_link_requests for all to authenticated
  using ((select public.comsw_role()) in ('admin','head'))
  with check ((select public.comsw_role()) in ('admin','head'));
create policy own_read on public.instructor_link_requests for select to authenticated
  using ((select public.comsw_role()) = 'teacher' and account_uid = (select auth.jwt()->>'sub'));
create policy own_cancel on public.instructor_link_requests for delete to authenticated
  using ((select public.comsw_role()) = 'teacher' and account_uid = (select auth.jwt()->>'sub'));

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_uid text not null,
  kind text not null check (kind in ('curriculum','image','profile-source','profile-generated')),
  drive_file_id text not null unique,
  public_url text,
  filename text not null,
  mime_type text not null,
  byte_size int not null check (byte_size > 0 and byte_size <= 10485760),
  created_at timestamptz not null default now(),
  check (kind <> 'profile-source' or public_url is null)
);
create index on public.media_assets(owner_uid);
alter table public.media_assets enable row level security;
grant select on public.media_assets to authenticated;
create policy member_read on public.media_assets for select to authenticated
  using ((select public.comsw_role()) in ('admin','head') or
    ((select public.comsw_role()) = 'teacher' and owner_uid = (select auth.jwt()->>'sub')));

create table public.instructor_profile_drafts (
  instructor_id uuid primary key references public.instructors on delete cascade,
  name text not null,
  career text not null default '',
  message text not null default '',
  source_asset_id uuid references public.media_assets on delete set null,
  source_consent boolean not null default false,
  photo_url text,
  status text not null default 'pending' check (status in ('pending','approved')),
  updated_at timestamptz not null default now()
);
create index on public.instructor_profile_drafts(source_asset_id);
alter table public.instructor_profile_drafts enable row level security;
grant select on public.instructor_profile_drafts to authenticated;
create policy staff_read on public.instructor_profile_drafts for select to authenticated
  using ((select public.comsw_role()) in ('admin','head'));
create policy own_read on public.instructor_profile_drafts for select to authenticated
  using ((select public.comsw_role()) = 'teacher' and instructor_id in (select public.comsw_my_instructor_ids()));

create function public.comsw_instructor_candidates(p_name text)
returns table(id uuid, name text) language plpgsql stable security definer set search_path = '' as $$
begin
  perform comsw_private.member_uid();
  return query select i.id, i.name from public.instructors i
    where i.account_uid is null and lower(trim(i.name)) = lower(trim(p_name)) order by i.sort_order nulls last;
end $$;


create function public.comsw_create_my_instructor(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare u text := comsw_private.member_uid(); result uuid;
begin
  perform pg_advisory_xact_lock(hashtext('comsw-account'), hashtext(u));
  select id into result from public.instructors where account_uid = u;
  if result is not null then return result; end if;
  if length(trim(coalesce(p_name,''))) not between 1 and 80 then raise exception '이름을 입력해주세요'; end if;
  if exists(select 1 from public.instructor_link_requests where account_uid=u) then
    raise exception '강사 정보 연결 확인을 기다려주세요';
  end if;
  insert into public.instructors(name,account_uid,is_listed) values(trim(p_name),u,false) returning id into result;
  return result;
end $$;

create function public.comsw_request_instructor_link(p_instructor_id uuid, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare u text := comsw_private.member_uid();
begin
  perform pg_advisory_xact_lock(hashtext('comsw-account'), hashtext(u));
  if exists(select 1 from public.instructors where account_uid=u) then raise exception '이미 연결된 강사 정보가 있습니다'; end if;
  if not exists(select 1 from public.instructors where id=p_instructor_id and account_uid is null and lower(trim(name))=lower(trim(p_name))) then
    raise exception '연결 가능한 같은 이름의 강사 정보가 없습니다';
  end if;
  insert into public.instructor_link_requests(account_uid,instructor_id,requested_name) values(u,p_instructor_id,trim(p_name))
    on conflict(account_uid) do update set instructor_id=excluded.instructor_id, requested_name=excluded.requested_name, created_at=now();
end $$;

create function public.comsw_approve_instructor_link(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.instructor_link_requests;
begin
  if coalesce(public.comsw_role(),'') not in ('admin','head') then raise exception '승인 권한이 없습니다' using errcode='42501'; end if;
  select * into r from public.instructor_link_requests where id=p_id for update;
  if not found then raise exception '연결 요청을 찾을 수 없습니다'; end if;
  perform pg_advisory_xact_lock(hashtext('comsw-account'), hashtext(r.account_uid));
  if exists(select 1 from public.instructors where account_uid=r.account_uid) then raise exception '이미 연결된 계정입니다'; end if;
  update public.instructors set account_uid=r.account_uid where id=r.instructor_id and account_uid is null;
  if not found then raise exception '이미 다른 계정에 연결된 강사입니다'; end if;
  delete from public.instructor_link_requests where id=p_id;
end $$;

create function public.comsw_save_my_profile(p_name text,p_career text,p_message text,p_source_asset_id uuid,p_source_consent boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare u text := comsw_private.member_uid(); i uuid;
begin
  select id into i from public.instructors where account_uid=u;
  if i is null then raise exception '먼저 강사 정보를 연결해주세요'; end if;
  if length(trim(coalesce(p_name,''))) not between 1 and 80 or length(coalesce(p_career,''))>10000 or length(coalesce(p_message,''))>2000 then
    raise exception '이름·경력·한마디의 길이를 확인해주세요';
  end if;
  if p_source_asset_id is not null and not exists(select 1 from public.media_assets where id=p_source_asset_id and owner_uid=u and kind='profile-source') then
    raise exception '본인 사진을 다시 올려주세요';
  end if;
  if p_source_asset_id is not null and not coalesce(p_source_consent,false) then raise exception '본인 사진 사용 동의를 확인해주세요'; end if;
  insert into public.instructor_profile_drafts(instructor_id,name,career,message,source_asset_id,source_consent)
    values(i,trim(p_name),coalesce(p_career,''),coalesce(p_message,''),p_source_asset_id,coalesce(p_source_consent,false))
  on conflict(instructor_id) do update set name=excluded.name,career=excluded.career,message=excluded.message,
    photo_url=case when instructor_profile_drafts.source_asset_id is distinct from excluded.source_asset_id then null else instructor_profile_drafts.photo_url end,
    source_asset_id=excluded.source_asset_id,source_consent=excluded.source_consent,status='pending',updated_at=clock_timestamp();
end $$;

create function public.comsw_approve_profile(p_id uuid,p_updated_at timestamptz default null) returns void
language plpgsql security definer set search_path = '' as $$
declare d public.instructor_profile_drafts;
begin
  if coalesce(public.comsw_role(),'') not in ('admin','head') then raise exception '승인 권한이 없습니다' using errcode='42501'; end if;
  select * into d from public.instructor_profile_drafts where instructor_id=p_id for update;
  if not found or d.status<>'pending' then raise exception '승인 대기 프로필이 없습니다'; end if;
  if p_updated_at is not null and d.updated_at is distinct from p_updated_at then raise exception '프로필이 변경되었습니다. 새로 확인 후 승인해주세요'; end if;
  update public.instructors set name=d.name,career=d.career,message=d.message,photo_url=coalesce(d.photo_url,photo_url),is_listed=true where id=p_id;
  update public.instructor_profile_drafts set status='approved',updated_at=clock_timestamp() where instructor_id=p_id;
end $$;

create index on public.instructor_curricula(instructor_id,set_id,subject_id,step_label,status);
create function public.comsw_submit_my_curriculum(p_set_id uuid,p_subject_id uuid,p_step_label text,p_written text,p_summary text,p_media_url text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare u text := comsw_private.member_uid(); i uuid; result uuid;
begin
  perform pg_advisory_xact_lock(hashtext('comsw-curriculum'),hashtext(u));
  select id into i from public.instructors where account_uid=u;
  if i is null then raise exception '먼저 강사 정보를 연결해주세요'; end if;
  if length(trim(coalesce(p_step_label,''))) not between 1 and 80 or length(trim(coalesce(p_written,''))) not between 1 and 12000 or length(coalesce(p_summary,''))>2000 then
    raise exception '주차와 커리큘럼 내용을 확인해주세요';
  end if;
  if coalesce(p_media_url,'')<>'' and (p_media_url not like 'https://%' or length(p_media_url)>2000) then raise exception '이미지는 https 주소를 입력해주세요'; end if;
  if not exists(select 1 from public.curriculum_sets where id=p_set_id) or not exists(select 1 from public.subjects where id=p_subject_id) then
    raise exception '학과 탭과 과목을 다시 선택해주세요';
  end if;
  select id into result from public.instructor_curricula where instructor_id=i and set_id=p_set_id and subject_id=p_subject_id and step_label=trim(p_step_label) and status='pending' order by updated_at desc limit 1 for update;
  if result is null then
    insert into public.instructor_curricula(set_id,instructor_id,subject_id,step_label,written,summary,media_url,status,sort_order)
    select p_set_id,i,p_subject_id,trim(p_step_label),trim(p_written),case when public.comsw_role()='teacher' then null else p_summary end,p_media_url,'pending',coalesce(max(sort_order),-1)+1
    from public.instructor_curricula where set_id=p_set_id returning id into result;
  else
    update public.instructor_curricula set written=trim(p_written),summary=case when public.comsw_role()='teacher' then case when written is distinct from trim(p_written) then null else summary end else p_summary end,media_url=p_media_url,updated_at=clock_timestamp() where id=result;
  end if;
  return result;
end $$;

-- PUBLIC 기본 실행 권한을 모두 걷고 허용한 RPC만 명시한다.
do $$ declare f regprocedure; begin
  for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname in
    ('comsw_instructor_candidates','comsw_create_my_instructor','comsw_request_instructor_link','comsw_approve_instructor_link','comsw_save_my_profile','comsw_approve_profile','comsw_submit_my_curriculum') loop
    execute format('revoke all on function %s from public, anon',f);
    execute format('grant execute on function %s to authenticated',f);
  end loop;
end $$;
grant select,insert,update,delete on public.media_assets,public.instructor_profile_drafts,public.comsw_ai_jobs to service_role;
grant select on public.site_settings to service_role;

-- 교사는 원문·이미지를 제출하고 표준 요약은 관리자·학과장이 작성한다.
create function comsw_private.guard_teacher_summary() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.comsw_role()='teacher' then
    if tg_op='INSERT' then
      if coalesce(new.summary,'')<>'' then raise exception '요약은 학과장·관리자가 작성합니다' using errcode='42501'; end if;
      new.summary:=null;
    elsif new.written is distinct from old.written then
      new.summary:=null;
    elsif new.summary is distinct from old.summary then
      raise exception '요약은 학과장·관리자가 작성합니다' using errcode='42501';
    end if;
  end if;
  return new;
end $$;
create trigger guard_teacher_summary before insert or update on public.instructor_curricula
for each row execute function comsw_private.guard_teacher_summary();

-- 새 강사가 제출한 학과·과목은 승인 시 기존 강사 소개 연결표에도 반영한다.
create or replace function public.comsw_approve_curriculum(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.instructor_curricula;
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
end $$;
