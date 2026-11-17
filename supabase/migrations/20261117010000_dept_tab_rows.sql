-- 학과 커리큘럼 사이트 학과 탭 두 줄(2026-11-17, 사용자 요청): V3 기본 설정 › 학과 커리큘럼 › [페이지 편집]에서
-- 윗줄 개수를 site_settings 'dept_tab_top'에 저장한다. 적용 행에 '학과 탭' 시트(1행 1칸 = 윗줄 개수)를 더한다.
-- 사이트는 학과 순서(departments.sort_order)대로 앞의 N개를 윗줄, 나머지를 아랫줄로 그린다. 값이 없으면 예전처럼 5개.
-- 표·칸은 바꾸지 않는다. 운영 DB에는 사용자가 직접 실행한다.
alter function public.comsw_build_rows() rename to comsw_build_rows_before_dept_tabs;

create function public.comsw_build_rows() returns jsonb
language sql stable security definer set search_path = public as $$
  select comsw_build_rows_before_dept_tabs() || comsw_sheet('main', '학과 탭', jsonb_build_array(jsonb_build_array(
    coalesce((select value from site_settings where key = 'dept_tab_top'), ''))))
$$;

revoke execute on function public.comsw_build_rows() from public, anon, authenticated;
revoke execute on function public.comsw_build_rows_before_dept_tabs() from public, anon, authenticated;
