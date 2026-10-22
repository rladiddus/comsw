-- 실제 삭제 전에도 익명·일반 API에서 옛 신청자 복사본을 읽지 못하게 한다.
-- 기존 허용 정책과 함께 적용되는 제한 정책이며 권한을 추가하지 않는다.
begin;
alter table public.raw_sheet_rows enable row level security;
create policy comsw_hide_legacy_applicants on public.raw_sheet_rows
as restrictive for select to anon, authenticated
using (sheet_name not in ('특강 신청','특강 신청자 명단'));
commit;
-- keepSupabaseAlive는 신청자 외 raw 자료의 1행 읽기를 계속 사용할 수 있다.
