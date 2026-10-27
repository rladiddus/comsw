-- 학과장 메인 학과(2026-10-27). 쌤톡 학과에는 본인 학과와 관리 학과가 섞여 있어 강사소개가 모든 학과에 나왔다.
-- 쌤톡은 그대로 두고, 내 프로필 > 수업 설정에서 학과장이 고른 학과 중 메인 학과를 정한다.
-- '적용' 때 강사페이지 학과 칸(B열)을 메인 학과 하나로 → 공개 사이트 강사소개는 메인 학과에만 나온다(관리 학과에는 안 나옴).
alter table public.instructors add column main_department_id uuid references public.departments on delete set null;

-- 메인 학과 정하기(학과장·관리자 본인만). 고른 학과(instructor_departments) 중 하나, 또는 null(모든 학과에 표시).
create function public.comsw_set_my_main_department(p_department_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare i uuid;
begin
  if coalesce(public.comsw_role(), '') not in ('admin', 'head') then raise exception '권한이 없습니다' using errcode = '42501'; end if;
  select id into i from public.instructors where account_uid = comsw_private.member_uid();
  if i is null then raise exception '먼저 강사 정보를 연결해주세요'; end if;
  if p_department_id is not null and not exists(
       select 1 from public.instructor_departments where instructor_id = i and department_id = p_department_id) then
    raise exception '수업 설정에서 고른 학과 중에서 골라주세요';
  end if;
  update public.instructors set main_department_id = p_department_id where id = i;
end $$;
revoke all on function public.comsw_set_my_main_department(uuid) from public, anon;
grant execute on function public.comsw_set_my_main_department(uuid) to authenticated;

-- 적용 행: 강사페이지 학과 칸을 메인 학과로. 메인 학과가 아직 그 강사의 학과일 때만(수업 설정에서 빼면 원래대로 모든 학과).
-- 행에는 강사 id가 없어 이름으로 찾는다(사이트도 이름으로 강사를 구분). 같은 이름이 둘이면 바꾸지 않는다.
alter function public.comsw_build_rows() rename to comsw_build_rows_before_main;

create function public.comsw_build_rows() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(
    case when r ->> 'sheet_name' = '강사페이지' then coalesce(
      (select jsonb_set(r, '{data,values,1}', to_jsonb(d.name))
       from instructors i
       join instructor_departments x on x.instructor_id = i.id and x.department_id = i.main_department_id
       join departments d on d.id = i.main_department_id
       where i.is_listed and i.name = r #>> '{data,values,0}'
         and (select count(*) from instructors j where j.is_listed and j.name = i.name) = 1), r)
    else r end order by ord), '[]'::jsonb)
  from jsonb_array_elements(comsw_build_rows_before_main()) with ordinality e(r, ord)
$$;

revoke execute on function public.comsw_build_rows() from public, anon, authenticated;
revoke execute on function public.comsw_build_rows_before_main() from public, anon, authenticated;
