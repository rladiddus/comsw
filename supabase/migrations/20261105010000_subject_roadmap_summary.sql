-- 과목마다 로드맵 문구 하나(2026-11-05, 사용자와 합의). 운영 DB에는 사용자가 직접 실행한다.
-- 로드맵 단계(roadmap_steps)에 아직 넣지 않은 과목도 승인 대기에서 로드맵 문구를 만들어 둘 수 있게 한다.
-- 모든 학과 공용(과목 하나에 문구 하나). 로드맵 단계에 넣으면 이 문구를 쓰고, 과목 여럿이 든 단계는 그 과목들의 문구를 요약한다.
alter table public.subjects add column roadmap_summary text
  check (roadmap_summary is null or length(roadmap_summary) <= 2000);
