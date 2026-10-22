-- 먼저 GAS 시트 → Supabase 동기화 트리거를 중지한다.
-- keepSupabaseAlive 및 신청자 외 raw 행은 보존한다.
-- 운영 SQL Editor에서 대상 개수를 확인하고 실행. 신청자 개인정보를 결과로 출력하지 않는다.
begin;
do $$
begin
  if not exists(select 1 from public.raw_sheet_rows where not (source_id='main' and sheet_name in ('특강 신청','특강 신청자 명단'))) then
    raise exception '매일 깨우기에 필요한 비신청자 raw 행을 먼저 확인해주세요';
  end if;
end $$;
delete from public.raw_sheet_rows
where source_id='main' and sheet_name in ('특강 신청','특강 신청자 명단');
commit;
select count(*) as remaining_applicant_raw_rows from public.raw_sheet_rows
where source_id='main' and sheet_name in ('특강 신청','특강 신청자 명단');
-- 0이어야 한다. 실제 신청 명단은 public.seminar_applications에 그대로 남는다.
