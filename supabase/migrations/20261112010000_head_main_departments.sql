-- 학과장 메인 학과 여러 개(2026-11-12 사용자 요청). 예: 모션그래픽 + AI처럼 실제 수업하는 학과가 둘 이상인 학과장.
-- 메인 학과를 하나도 고르지 않으면 지금처럼 고른 모든 학과에 강사소개가 나온다.
-- 옛 칸(main_department_id, 하나)은 새 칸으로 옮기고 비운다(칸은 남겨 둠: 옛 화면이 열려 있어도 오류 없게).
alter table public.instructors add column main_department_ids uuid[] not null default '{}';
update public.instructors set main_department_ids = array[main_department_id], main_department_id = null
  where main_department_id is not null;

-- 내 메인 학과 정하기(학과장·관리자 본인). 수업 설정에서 고른 학과(instructor_departments) 중에서만. 빈 배열 = 고르지 않음.
create function public.comsw_set_my_main_departments(p_department_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  i uuid;
  ids uuid[] := array(select distinct x from unnest(coalesce(p_department_ids, '{}')) x where x is not null);
begin
  if coalesce(public.comsw_role(), '') not in ('admin', 'head') then raise exception '권한이 없습니다' using errcode = '42501'; end if;
  select id into i from public.instructors where account_uid = comsw_private.member_uid();
  if i is null then raise exception '먼저 강사 정보를 연결해주세요'; end if;
  if exists (select 1 from unnest(ids) d where not exists (
       select 1 from public.instructor_departments where instructor_id = i and department_id = d)) then
    raise exception '수업 설정에서 고른 학과 중에서 골라주세요';
  end if;
  update public.instructors set main_department_ids = ids, main_department_id = null where id = i;
end $$;
revoke all on function public.comsw_set_my_main_departments(uuid[]) from public, anon;
grant execute on function public.comsw_set_my_main_departments(uuid[]) to authenticated;

-- 옛 함수(하나)도 새 칸에 저장하게(옛 화면 호환).
create or replace function public.comsw_set_my_main_department(p_department_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.comsw_set_my_main_departments(case when p_department_id is null then '{}'::uuid[] else array[p_department_id] end);
end $$;

-- 적용 행: 강사페이지 학과 칸(B열)을 메인 학과들로(학과 순서, ', '로 이음). 아직 그 강사의 학과인 메인 학과만.
-- 남는 메인 학과가 없으면 원래대로 모든 학과. 같은 이름 공개 강사가 둘이면 바꾸지 않는다(사이트가 이름으로 구분).
-- 이 함수는 20261027080000에서 만든 메인 학과 단계(20261030020000에서 이름이 바뀜)이고, 몸통만 바꾼다.
create or replace function public.comsw_build_rows_before_seminar_listed() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(
    case when r ->> 'sheet_name' = '강사페이지' then coalesce(
      (select jsonb_set(r, '{data,values,1}', to_jsonb(string_agg(d.name, ', ' order by d.sort_order nulls last, d.name)))
       from instructors i
       join instructor_departments x on x.instructor_id = i.id and x.department_id = any(i.main_department_ids)
       join departments d on d.id = x.department_id
       where i.is_listed and i.name = r #>> '{data,values,0}'
         and (select count(*) from instructors j where j.is_listed and j.name = i.name) = 1), r)
    else r end order by ord), '[]'::jsonb)
  from jsonb_array_elements(comsw_build_rows_before_main()) with ordinality e(r, ord)
$$;
