-- 홈페이지 AI 챗봇(2026-11-25 사용자 요청). 운영 DB에는 사용자가 직접 실행한다. 공개 자료(comsw_build_rows)는 바뀌지 않는다.
--   - 방문자 챗봇 요금은 관리 화면 AI 한도(comsw_ai_jobs)와 따로 센다. 처음 한 달 3,000원, 하루에는 그 5분의 1까지.
--   - 대화 내용은 저장하지 않는다. 남기는 것은 시각·계산 금액·날마다 바뀌는 익명 번호뿐(3개월 뒤 지움).

alter table comsw_private.ai_limit add column chat_krw int not null default 3000 check (chat_krw between 0 and 1000000);

create table comsw_private.chat_calls (
  id uuid primary key default gen_random_uuid(),
  who text not null,
  krw int not null check (krw between 0 and 1000),
  created_at timestamptz not null default now()
);
create index on comsw_private.chat_calls(created_at);
alter table comsw_private.chat_calls enable row level security;
revoke all on comsw_private.chat_calls from public, anon, authenticated;

-- 질문 한 번 시작: 같은 사람 1분 8번·하루 200번, 전체 1분 60번, 하루·한 달 금액을 확인하고 금액을 잡아 둔다(서버 전용).
create function public.comsw_chat_reserve(p_who text, p_krw int) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  lim int;
  new_id uuid;
  day0 timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  month0 timestamptz := date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
begin
  if p_krw is null or p_krw not between 1 and 1000 or coalesce(p_who, '') = '' then
    raise exception '잘못된 요청입니다' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('comsw-chat'));
  delete from comsw_private.chat_calls where created_at < now() - interval '3 months';
  select chat_krw into lim from comsw_private.ai_limit;
  if (select count(*) from comsw_private.chat_calls where who = p_who and created_at > now() - interval '1 minute') >= 8
     or (select count(*) from comsw_private.chat_calls where who = p_who and created_at >= day0) >= 200
     or (select count(*) from comsw_private.chat_calls where created_at > now() - interval '1 minute') >= 60 then
    raise exception '질문이 너무 많습니다. 잠시 뒤에 다시 물어봐주세요.' using errcode = 'P0001';
  end if;
  if (select coalesce(sum(krw), 0) from comsw_private.chat_calls where created_at >= month0) + p_krw > lim
     or (select coalesce(sum(krw), 0) from comsw_private.chat_calls where created_at >= day0) + p_krw > ceil(lim / 5.0) then
    raise exception '지금은 AI 상담을 이용할 수 없습니다. 멘토님께 문의해주세요.' using errcode = 'P0001';
  end if;
  insert into comsw_private.chat_calls(who, krw) values (p_who, p_krw) returning id into new_id;
  return new_id;
end $$;

-- 질문 한 번 끝: 실제 계산 금액으로 고친다(서버 전용).
create function public.comsw_chat_finish(p_id uuid, p_krw int) returns void
language sql security definer set search_path = '' as $$
  update comsw_private.chat_calls set krw = greatest(0, least(1000, p_krw)) where id = p_id
$$;
revoke all on function public.comsw_chat_reserve(text, int), public.comsw_chat_finish(uuid, int) from public, anon, authenticated;
grant execute on function public.comsw_chat_reserve(text, int), public.comsw_chat_finish(uuid, int) to service_role;

-- 관리 화면 [AI 사용량]: 이번 달 챗봇 사용액·질문 수·한도(학과장·관리자가 봄, 바꾸기는 관리자만).
create function public.comsw_chat_budget() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare month0 timestamptz := date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
begin
  if coalesce(public.comsw_role(), '') not in ('admin', 'head') then
    raise exception '권한이 없습니다' using errcode = '42501';
  end if;
  return (select jsonb_build_object('used', coalesce(sum(krw), 0), 'count', count(*),
                                    'limit', (select chat_krw from comsw_private.ai_limit))
          from comsw_private.chat_calls where created_at >= month0);
end $$;

create function public.comsw_set_chat_limit(p_limit int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(public.comsw_role(), '') <> 'admin' then
    raise exception '관리자만 한도를 바꿀 수 있습니다' using errcode = '42501';
  end if;
  if p_limit is null or p_limit not between 0 and 1000000 then
    raise exception '한도는 0원부터 1,000,000원까지 정할 수 있습니다' using errcode = 'P0001';
  end if;
  update comsw_private.ai_limit set chat_krw = p_limit where id;
end $$;
revoke all on function public.comsw_chat_budget(), public.comsw_set_chat_limit(int) from public, anon;
grant execute on function public.comsw_chat_budget(), public.comsw_set_chat_limit(int) to authenticated;
