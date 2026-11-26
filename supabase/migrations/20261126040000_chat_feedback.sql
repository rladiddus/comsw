-- 홈페이지 AI 챗봇 상담 평가(2026-11-26 사용자 요청). 운영 DB에는 사용자가 직접 실행한다. 20261126030000 다음.
--   - 방문자가 [상담 끝내기]나 채팅창 닫기에서 별점(1~5)을 보내면 별점·한마디·그 대화를 저장한다. [건너뛰기]하면 아무것도 저장하지 않는다.
--   - 대화의 전화번호·이메일은 서버(comsw-chat)가 가린 뒤 넘긴다. 3개월 지난 평가는 새 평가가 들어올 때 지운다.
--   - 저장은 서버(service_role)만, 보기는 학과장·관리자만(V4 AI 사용량 › 홈페이지 챗봇).
create table comsw_private.chat_feedback (
  id uuid primary key default gen_random_uuid(),
  who text not null, -- 날마다 바뀌는 익명 번호(횟수 제한용)
  stars int not null check (stars between 1 and 5),
  comment text not null default '' check (length(comment) <= 500),
  messages jsonb not null check (jsonb_typeof(messages) = 'array'),
  created_at timestamptz not null default now()
);
create index on comsw_private.chat_feedback(created_at);
alter table comsw_private.chat_feedback enable row level security;
revoke all on comsw_private.chat_feedback from public, anon, authenticated;

create function public.comsw_chat_feedback_add(p_who text, p_stars int, p_comment text, p_messages jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare day0 timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
begin
  if coalesce(p_who, '') = '' or p_stars is null or p_stars not between 1 and 5
     or length(coalesce(p_comment, '')) > 500 or jsonb_typeof(p_messages) is distinct from 'array'
     or jsonb_array_length(p_messages) = 0 or length(p_messages::text) > 100000 then
    raise exception '잘못된 요청입니다' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('comsw-chat-feedback'));
  delete from comsw_private.chat_feedback where created_at < now() - interval '3 months';
  if (select count(*) from comsw_private.chat_feedback where who = p_who and created_at >= day0) >= 10
     or (select count(*) from comsw_private.chat_feedback where created_at >= day0) >= 300 then
    raise exception '평가가 너무 많습니다. 내일 다시 보내주세요.' using errcode = 'P0001';
  end if;
  insert into comsw_private.chat_feedback(who, stars, comment, messages) values (p_who, p_stars, coalesce(p_comment, ''), p_messages);
end $$;
revoke all on function public.comsw_chat_feedback_add(text, int, text, jsonb) from public, anon, authenticated;
grant execute on function public.comsw_chat_feedback_add(text, int, text, jsonb) to service_role;

-- 관리 화면: 최근 3개월 평가(새것부터). 익명 번호는 보내지 않는다.
create function public.comsw_chat_feedback_list() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(public.comsw_role(), '') not in ('admin', 'head') then
    raise exception '권한이 없습니다' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'stars', stars, 'comment', comment, 'messages', messages, 'created_at', created_at)
                                    order by created_at desc)
                   from comsw_private.chat_feedback where created_at >= now() - interval '3 months'), '[]'::jsonb);
end $$;
revoke all on function public.comsw_chat_feedback_list() from public, anon;
grant execute on function public.comsw_chat_feedback_list() to authenticated;
