-- 기준 과목 이름 규칙 고침(2026-11-20): 끝의 '1~2'처럼 범위도 뗀다. '디지털 드로잉 1~2' → '디지털 드로잉'(전에는 '디지털 드로잉 1~').
-- 운영 DB에는 사용자가 직접 실행한다. 화면 규칙(admin-v4/js/rules.mjs baseName)과 같아야 한다.
create or replace function comsw_private.v4_base(n text) returns text
language sql immutable set search_path = '' as $$
  select coalesce(nullif(btrim(regexp_replace(btrim(coalesce(n, '')), '\s*\d+(\s*~\s*\d+)?$', '')), ''), btrim(coalesce(n, '')))
$$;
