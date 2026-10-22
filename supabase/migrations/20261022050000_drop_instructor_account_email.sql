-- 20261022040000의 '쌤톡 이메일 미리 적기'는 쓰지 않는다(관리 화면 '계정 연결'에서 쌤톡 회원과 강사를 바로 연결).
drop function public.comsw_claim_my_instructor();
drop index public.instructors_account_email_key;
alter table public.instructors drop column account_email;
