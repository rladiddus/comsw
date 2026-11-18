-- 학과명 바꾸기(2026-11-18, 사용자 요청): 학과 관리 › 학과 설정 › 학과 수정(= 기본 설정 › 학과별 자료와 같은 화면)에서
-- 학과명을 바꾸면 사이트 전체가 새 이름을 쓴다. 대부분은 학과 id로 이어져 있어 저절로 바뀌지만, 이름으로 이어진 두 곳을 맞춘다.
-- 1) 강사 커리큘럼 학과 탭(curriculum_sets): 사이트가 학과 이름과 같은 탭 이름으로 강사 커리큘럼을 찾는다 → 같은 이름의 그 학과 탭도 바꾼다.
-- 2) 쌤톡 학과(선생님 계정 majors): 이름 글자로 저장돼 있어 컴수원에서 못 바꾼다 → 옛 이름(former_names)을 기억해 수업 설정이 알아보게 한다.
-- 어느 화면에서 바꾸든(학과 수정·기본 설정) 같게 표 트리거로 한다. 공개 사이트에는 '사이트에 반영' 뒤. 운영 DB에는 사용자가 직접 실행한다.
alter table public.departments add column former_names text[] not null default '{}';

create function public.comsw_department_renamed() returns trigger
language plpgsql set search_path = '' as $$
begin
  update public.curriculum_sets set name = new.name where department_id = new.id and name = old.name;
  new.former_names := array_remove(
    case when old.name = any(old.former_names) then old.former_names else old.former_names || old.name end, new.name);
  return new;
end $$;

create trigger departments_renamed before update of name on public.departments
  for each row when (old.name is distinct from new.name) execute function public.comsw_department_renamed();
