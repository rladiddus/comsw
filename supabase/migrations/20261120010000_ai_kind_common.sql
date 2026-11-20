-- AI 종류 'common'(V4 과목 공통 4단계 요약, 2026-11-20)을 AI 사용 기록 표에 허용. 운영 DB에는 사용자가 직접 실행한다.
alter table public.comsw_ai_jobs drop constraint comsw_ai_jobs_kind_check;
alter table public.comsw_ai_jobs add constraint comsw_ai_jobs_kind_check
  check (kind in ('week', 'common', 'department', 'roadmap', 'profile'));
