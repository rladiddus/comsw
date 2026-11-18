-- '강사별 커리큘럼' 메뉴(2026-11-18, 사용자 요청): 학과별 자료에 있던 학과 강사소개를 따로 뗀 페이지
-- (Curriculum_full.html?view=instructors)로 가는 알약 메뉴. 오른쪽 맨 끝에 켜서 넣는다(이미 있으면 그대로).
-- 표·칸은 바꾸지 않는다. 공개 사이트에는 '사이트에 반영' 뒤 나온다. 운영 DB에는 사용자가 직접 실행한다.
insert into public.menus (name, is_active, side, sort_order)
select '강사별 커리큘럼', true, 'right', coalesce(max(sort_order), 0) + 1 from public.menus
on conflict (name) do nothing;
