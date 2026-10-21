-- 사이트 전환이 끝나 '시트에서 가져오기'를 없앤다. 전환 뒤 실수로 누르면 사이트에서 받은 특강 신청이 지워지기 때문.
drop function if exists public.comsw_import(jsonb);
