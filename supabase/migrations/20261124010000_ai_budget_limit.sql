-- AI 예산 한도를 화면(V4 [AI 사용량])에서 바꾸기(2026-11-24 사용자 요청). 운영 DB에는 사용자가 직접 실행한다.
--   - 한도는 처음 3,000원 그대로. 바꾸기와 '사용액에서 빼기'는 관리자만.
--   - 예산 부족 안내에 한도·사용액·필요한 금액을 보인다.
--   - 성공한 작업은 잡아 둔 금액보다 더 들었어도 실제 계산 금액으로 적는다(한 건 최대 3,000원).

create table comsw_private.ai_limit (
  id boolean primary key default true check (id),
  month_krw int not null check (month_krw between 0 and 1000000)
);
insert into comsw_private.ai_limit(month_krw) values (3000);
revoke all on comsw_private.ai_limit from public, anon, authenticated;

create or replace function public.comsw_ai_budget() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare spent int; lim int; m text := to_char(now() at time zone 'Asia/Seoul','YYYY-MM');
begin
  perform comsw_private.member_uid();
  select month_krw into lim from comsw_private.ai_limit;
  select coalesce(sum(budget_krw),0) into spent from public.comsw_ai_jobs where month=m;
  return jsonb_build_object('month',m,'used',spent,'limit',lim,'remaining',greatest(0,lim-spent));
end $$;

create or replace function public.comsw_reserve_ai(p_owner_uid text,p_kind text,p_cache_key text,p_reserve_krw int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m text := to_char(now() at time zone 'Asia/Seoul','YYYY-MM'); j public.comsw_ai_jobs; spent int; lim int;
begin
  -- 전 계정 합산. 같은 달의 동시 요청은 같은 잠금을 사용한다.
  perform pg_advisory_xact_lock(hashtext('comsw-ai-budget'),hashtext(m));
  if p_reserve_krw not between 1 and 3000 or coalesce(p_owner_uid,'')='' then raise exception '잘못된 비용 예약'; end if;
  select * into j from public.comsw_ai_jobs where owner_uid=p_owner_uid and kind=p_kind and cache_key=p_cache_key and status='completed' order by created_at desc limit 1;
  if found and p_kind<>'profile' then return jsonb_build_object('cached',true,'result',j.result); end if;
  if exists(select 1 from public.comsw_ai_jobs where owner_uid=p_owner_uid and kind=p_kind and cache_key=p_cache_key and status='reserved') then
    raise exception '같은 내용의 AI 작업이 진행 중입니다';
  end if;
  select month_krw into lim from comsw_private.ai_limit;
  select coalesce(sum(budget_krw),0) into spent from public.comsw_ai_jobs where month=m;
  if spent+p_reserve_krw>lim then
    raise exception '이번 달 AI 예산이 부족합니다(한도 %원 · 사용 %원 · 이번 작업에 필요한 금액 %원). V4 [AI 사용량]에서 확인해주세요',
      to_char(lim,'FM9,999,990'),to_char(spent,'FM9,999,990'),to_char(p_reserve_krw,'FM9,999,990');
  end if;
  insert into public.comsw_ai_jobs(owner_uid,kind,cache_key,month,budget_krw) values(p_owner_uid,p_kind,p_cache_key,m,p_reserve_krw) returning * into j;
  return jsonb_build_object('cached',false,'id',j.id);
end $$;

create or replace function public.comsw_finish_ai(p_id uuid,p_cost_krw int,p_result jsonb,p_usage jsonb,p_failed boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare j public.comsw_ai_jobs;
begin
  select * into j from public.comsw_ai_jobs where id=p_id for update;
  if not found or j.status<>'reserved' then raise exception '비용 예약을 찾을 수 없습니다'; end if;
  -- 응답이 불확실한 실패는 예약액을 유지한다(관리자가 확인 뒤 comsw_release_ai로 뺀다).
  update public.comsw_ai_jobs set budget_krw=case when p_failed then j.budget_krw else greatest(0,least(3000,p_cost_krw)) end,
    status=case when p_failed then 'failed' else 'completed' end,result=p_result,usage=p_usage where id=p_id;
end $$;

-- 한 달 한도 바꾸기(관리자만). 0원이면 AI를 쓰지 않음.
create function public.comsw_set_ai_limit(p_limit int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(public.comsw_role(),'') <> 'admin' then raise exception '관리자만 한도를 바꿀 수 있습니다' using errcode = '42501'; end if;
  if p_limit is null or p_limit not between 0 and 1000000 then raise exception '한도는 0원부터 1,000,000원까지 정할 수 있습니다' using errcode = 'P0001'; end if;
  update comsw_private.ai_limit set month_krw = p_limit where id;
end $$;

-- 실패했거나 10분 넘게 끝나지 않은 작업의 잡아 둔 금액을 사용액에서 빼기(관리자만). 기록은 '실패'로 남는다.
create function public.comsw_release_ai(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(public.comsw_role(),'') <> 'admin' then raise exception '관리자만 사용액을 고칠 수 있습니다' using errcode = '42501'; end if;
  update public.comsw_ai_jobs set budget_krw = 0, status = 'failed'
    where id = p_id and (status = 'failed' or (status = 'reserved' and created_at < now() - interval '10 minutes'));
  if not found then raise exception '실패했거나 멈춘 작업만 뺄 수 있습니다' using errcode = 'P0001'; end if;
end $$;
revoke all on function public.comsw_set_ai_limit(int), public.comsw_release_ai(uuid) from public, anon;
grant execute on function public.comsw_set_ai_limit(int), public.comsw_release_ai(uuid) to authenticated;
