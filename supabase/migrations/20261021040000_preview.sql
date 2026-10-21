-- 미리보기: 관리자·학과장이 '적용' 전 내용을 공개 사이트 화면으로 본다. 방문자(익명)는 계속 적용된 스냅샷만 본다.
create function public.comsw_preview_rows(p_source text, p_sheet text)
returns table (source_id text, sheet_name text, row_number int, data jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(comsw_role(), '') not in ('admin', 'head') then
    raise exception '미리보기 권한이 없습니다';
  end if;
  return query
    select e ->> 'source_id', e ->> 'sheet_name', (e ->> 'row_number')::int, e -> 'data'
    from jsonb_array_elements(comsw_build_rows()) e
    where e ->> 'source_id' = p_source and e ->> 'sheet_name' = p_sheet
    order by 3;
end $$;

revoke all on function public.comsw_preview_rows(text, text) from public, anon;
grant execute on function public.comsw_preview_rows(text, text) to authenticated;
