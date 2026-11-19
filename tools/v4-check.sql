-- V4 운영 확인(읽기만, 아무것도 바꾸지 않음). Supabase SQL Editor에서 실행. 개인정보는 출력하지 않는다(개수·과목명만).

-- 1) 강사 커리큘럼 중 4단계가 아닌 것(검수 완료·대기 따로): 과목명, 단계 수, 건수
select s.name 과목, c.status 상태, n 단계수, count(*) 건수
from (
  select subject_id, status, instructor_id, set_id, count(*) n
  from public.instructor_curricula group by subject_id, status, instructor_id, set_id
) c join public.subjects s on s.id = c.subject_id
where n <> 4
group by s.name, c.status, n order by s.name, c.status, n;

-- 2) 공통 커리큘럼(학과 관리 단계) 중 4단계가 아닌 과목
select s.name 과목, count(*) 단계수
from public.subject_weeks w join public.subjects s on s.id = w.subject_id
group by s.name having count(*) <> 4 order by s.name;

-- 3) 계정이 연결되지 않은 강사 수, 같은 이름 강사
select (select count(*) from public.instructors where account_uid is null) 계정_미연결,
       (select count(*) from (select name from public.instructors group by name having count(*) > 1) x) 같은이름_묶음;

-- 4) V4 SQL(20261119010000) 실행 뒤: 반영하지 않은 다른 변경이 있나(true면 기존 화면에서 사이트에 반영 먼저)
-- select comsw_private.v4_differs();
