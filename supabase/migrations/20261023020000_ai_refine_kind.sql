-- 신청 과목 '커리큘럼 다듬기'(선생님 원문을 AI로 다듬기) 비용 기록을 위해 AI 종류에 refine을 더한다.
alter table public.comsw_ai_jobs drop constraint comsw_ai_jobs_kind_check;
alter table public.comsw_ai_jobs add constraint comsw_ai_jobs_kind_check
  check (kind in ('week','department','roadmap','profile','refine'));
