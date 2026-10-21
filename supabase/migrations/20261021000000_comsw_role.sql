-- 쌤톡(Firebase ssamtalk-sbs) 토큰의 comsw_role 클레임으로 관리 플랫폼 역할을 판단한다.

create or replace function public.comsw_role()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'comsw_role', '')
$$;

create or replace function public.comsw_whoami()
returns json
language sql
stable
as $$
  select json_build_object('uid', auth.jwt() ->> 'sub', 'role', public.comsw_role())
$$;

revoke execute on function public.comsw_whoami() from public, anon;
grant execute on function public.comsw_whoami() to authenticated;
