-- 옵저버(보기 전용) 역할(2026-11-27 사용자 결정: 포트폴리오 심사용). 운영 DB에는 사용자가 직접 실행한다.
--   쌤톡 계정 등급이 observer면 로그인 표식 comsw_role = 'observer'(매신저/comsw-claims-functions).
--   옵저버는 V4 관리 화면을 읽기만 한다:
--     - 읽기 허용: 학과·과목·커리큘럼·로드맵·준비물·특강 정보·사이트 편집·AI 사용량(금액·작업 기록) 등 공개 자료와 운영 기록
--     - 막음(정책을 주지 않음): 특강 신청자(이름·연락처), 강사 프로필 제출본·비공개 원본 사진(media_assets),
--       학과장·강사 임시 저장함, 보관본, 홈페이지 챗봇 상담 평가, AI 프롬프트(site_settings의 ai_prompt_*)
--   저장·반영 함수는 지금처럼 관리자·학과장만(v4_guard), AI·이미지 서버(comsw-tools)도 옵저버를 거절한다.
do $$
declare t text;
begin
  foreach t in array array[
    'departments', 'site_categories', 'subjects', 'subject_departments', 'subject_weeks',
    'instructors', 'instructor_departments', 'instructor_subjects', 'curriculum_sets',
    'instructor_curricula', 'roadmap_tracks', 'roadmap_steps', 'roadmap_step_subjects',
    'course_prep_items', 'seminars', 'recruitment_posts', 'main_media', 'menus', 'loading_items',
    'site_snapshots', 'comsw_ai_jobs', 'vacation_set_subjects', 'subject_groups', 'instructor_subject_materials',
    'v4_common_meta', 'v4_vacation_steps', 'v4_vacation_meta'
  ] loop
    execute format('create policy observer_read on public.%I for select to authenticated using (public.comsw_role() = ''observer'')', t);
  end loop;
end $$;

-- 사이트 설정은 AI 프롬프트만 빼고
create policy observer_read on public.site_settings for select to authenticated
  using (public.comsw_role() = 'observer' and key not like 'ai\_prompt\_%');

-- AI 사용량(관리 화면 AI·홈페이지 챗봇)의 이번 달 금액·한도: 옵저버도 보기
create or replace function public.comsw_ai_budget() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare spent int; lim int; m text := to_char(now() at time zone 'Asia/Seoul','YYYY-MM');
begin
  if coalesce(public.comsw_role(), '') <> 'observer' then perform comsw_private.member_uid(); end if;
  select month_krw into lim from comsw_private.ai_limit;
  select coalesce(sum(budget_krw),0) into spent from public.comsw_ai_jobs where month=m;
  return jsonb_build_object('month',m,'used',spent,'limit',lim,'remaining',greatest(0,lim-spent));
end $$;

create or replace function public.comsw_chat_budget() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare month0 timestamptz := date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
begin
  if coalesce(public.comsw_role(), '') not in ('admin', 'head', 'observer') then
    raise exception '권한이 없습니다' using errcode = '42501';
  end if;
  return (select jsonb_build_object('used', coalesce(sum(krw), 0), 'count', count(*),
                                    'limit', (select chat_krw from comsw_private.ai_limit))
          from comsw_private.chat_calls where created_at >= month0);
end $$;
