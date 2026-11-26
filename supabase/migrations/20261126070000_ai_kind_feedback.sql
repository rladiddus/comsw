-- AI 종류 'feedback'(홈페이지 챗봇 상담 평가 정리, 2026-11-26)을 AI 사용 기록 표에 허용. 운영 DB에는 사용자가 직접 실행한다.
-- V4 AI 사용량 › 홈페이지 챗봇 › [피드백 정리하기]가 관리 화면 AI(comsw-tools, 생각하기 켬)로 별점·대화를 정리한다. 금액은 관리 화면 AI 한도에서 쓴다.
alter table public.comsw_ai_jobs drop constraint comsw_ai_jobs_kind_check;
alter table public.comsw_ai_jobs add constraint comsw_ai_jobs_kind_check
  check (kind in ('week', 'common', 'department', 'roadmap', 'profile', 'feedback'));
