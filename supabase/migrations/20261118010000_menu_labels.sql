-- 메뉴 이름 고치기(2026-11-18, 사용자 요청): V3 기본 설정 › 메뉴 알약 글자를 고치면 사이트 메뉴 이름도 바뀐다.
-- 사이트는 원래 이름(menus.name)으로 갈 페이지를 정하므로 name은 그대로 두고, 보이는 이름은 새 칸 label에 둔다(비우면 name).
-- 적용 행 '메인 페이지' 시트의 메뉴 행(E가 있는 행)에 K열 = label을 더한다. 사이트는 K가 있으면 K, 없으면 E를 보여 준다.
-- 운영 DB에는 사용자가 직접 실행한다.
alter table public.menus add column label text;

alter function public.comsw_build_rows() rename to comsw_build_rows_before_menu_labels;

create function public.comsw_build_rows() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(
    case when r ->> 'sheet_name' = '메인 페이지' and coalesce(r #>> '{data,values,4}', '') <> '' then
      jsonb_set(r, '{data,values,10}', to_jsonb(coalesce(
        (select nullif(btrim(m.label), '') from menus m where m.name = r #>> '{data,values,4}'), '')), true)
    else r end order by ord), '[]'::jsonb)
  from jsonb_array_elements(comsw_build_rows_before_menu_labels()) with ordinality e(r, ord)
$$;

revoke execute on function public.comsw_build_rows() from public, anon, authenticated;
revoke execute on function public.comsw_build_rows_before_menu_labels() from public, anon, authenticated;
