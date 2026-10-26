-- 수업별 준비물 항목마다 학과(사용자 요청 2026-10-27): 준비물을 넣을 때 학과 > 과목을 고르고, 관리 화면은 이 학과로 묶는다.
-- 비어 있으면 예전처럼 과목의 첫 학과(학과별 과목 순서). 사이트 표시(적용)에는 쓰지 않는다.
alter table public.course_prep_items add column department_id uuid references public.departments on delete set null;

-- 학과에 없던 묶음 과목(예: 캐드 = 캐드1·캐드2)의 준비물을 사용자가 정한 학과로.
update public.course_prep_items p set department_id = d.id
from public.subjects s, public.departments d,
  (values ('스케치', '인테리어학과'), ('캐드', '인테리어학과'), ('스케치업', '인테리어학과'), ('맥스', '인테리어학과'),
          ('C언어', '프로그래밍학과'), ('자바', '프로그래밍학과'), ('파이썬', '프로그래밍학과'),
          ('애프터 이펙트', '모션그래픽학과'), ('CG', 'CG학과'), ('AI에이전트', 'AI학과')) m(subject_name, dept_name)
where p.subject_id = s.id and s.name = m.subject_name and d.name = m.dept_name;
