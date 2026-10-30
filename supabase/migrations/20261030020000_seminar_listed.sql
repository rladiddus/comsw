-- V3 특강·세미나 '공개' 체크(2026-10-30, 사용자 요청): 체크를 끈 특강은 사이트에 나오지 않고 신청도 받지 않는다.
-- 기존 특강은 모두 공개(기본값 true)라 지금 사이트는 그대로다. 운영 DB에는 사용자가 직접 실행한다.
alter table public.seminars add column is_listed boolean not null default true;

-- 적용 행: '특강 및 세미나' 시트에서 비공개 특강 줄을 빼고 줄 번호를 다시 매긴다(9번째 칸 = 특강 id, 20261021020200).
alter function public.comsw_build_rows() rename to comsw_build_rows_before_seminar_listed;

create function public.comsw_build_rows() returns jsonb
language sql stable security definer set search_path = public as $$
  with kept as (
    select r, ord
    from jsonb_array_elements(comsw_build_rows_before_seminar_listed()) with ordinality e(r, ord)
    where not (r ->> 'sheet_name' = '특강 및 세미나'
      and exists (select 1 from seminars sm where sm.id::text = r #>> '{data,values,8}' and not sm.is_listed))
  ), numbered as (
    select ord, case when r ->> 'sheet_name' = '특강 및 세미나'
      then jsonb_set(r, '{row_number}', to_jsonb(1 + row_number() over (partition by r ->> 'sheet_name' order by ord)))
      else r end r
    from kept
  )
  select coalesce(jsonb_agg(r order by ord), '[]'::jsonb) from numbered
$$;

revoke execute on function public.comsw_build_rows() from public, anon, authenticated;
revoke execute on function public.comsw_build_rows_before_seminar_listed() from public, anon, authenticated;

-- 신청(20261021020000): 비공개 특강은 '특강을 찾을 수 없습니다'. 나머지 규칙은 그대로.
create or replace function public.comsw_apply_seminar(p_id uuid, p_name text, p_phone text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s seminars;
  v_name text := btrim(coalesce(p_name, ''));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_date date;
begin
  if v_name = '' then return jsonb_build_object('ok', false, 'error', '이름을 입력해주세요.'); end if;
  if v_name !~ '^[가-힣ㄱ-ㅎㅏ-ㅣ]+$' then return jsonb_build_object('ok', false, 'error', '한글만 입력해주세요'); end if;
  if char_length(v_name) > 20 then return jsonb_build_object('ok', false, 'error', '이름이 너무 깁니다.'); end if;
  if v_phone = '' then return jsonb_build_object('ok', false, 'error', '연락처를 입력해주세요.'); end if;
  if v_phone !~ '^\d{3}-\d{4}-\d{4}$' then
    return jsonb_build_object('ok', false, 'error', '연락처 형식은 000-0000-0000입니다.');
  end if;

  select * into s from seminars where id = p_id and is_listed;
  if not found then return jsonb_build_object('ok', false, 'error', '특강을 찾을 수 없습니다'); end if;
  v_date := comsw_seminar_date(s.datetime_text);
  if v_date is not null and v_date < (now() at time zone 'Asia/Seoul')::date then
    return jsonb_build_object('ok', false, 'error', '특강 신청일이 지났습니다.');
  end if;

  begin
    insert into seminar_applications (seminar_id, name, phone) values (s.id, v_name, v_phone);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'duplicate', true, 'error', '이미 신청되었습니다');
  end;
  return jsonb_build_object('ok', true,
    'applied', (select count(*) from seminar_applications where seminar_id = s.id));
end $$;
