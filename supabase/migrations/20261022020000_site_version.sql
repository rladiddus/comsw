-- 공개 사이트 캐시: 방문자 브라우저는 이 번호(최신 '적용' 스냅샷 id)만 확인하고, 같으면 저장해 둔 내용을 쓴다.
create function public.comsw_site_version() returns bigint
language sql stable security definer set search_path = public as $$
  select max(id) from site_snapshots
$$;

revoke execute on function public.comsw_site_version() from public;
grant execute on function public.comsw_site_version() to anon, authenticated;
