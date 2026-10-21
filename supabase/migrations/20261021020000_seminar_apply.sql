-- 특강 신청: 공개 사이트(익명)가 GAS 대신 부른다. 규칙은 기존 applySeminar 그대로.
-- 특강은 스냅샷 행에 실린 id로 찾는다(관리 화면에서 제목을 바꾸고 아직 '적용' 전이어도 맞게).

-- 사이트 _semParseDate와 같은 형식만 읽는다. 못 읽으면 null(= 지난 것으로 보지 않음).
create or replace function public.comsw_seminar_date(p text) returns date
language plpgsql stable set search_path = public as $$
declare m text[];
begin
  m := regexp_match(coalesce(p, ''), '(\d{4})[./-](\d{1,2})[./-](\d{1,2})');
  if m is null then m := regexp_match(coalesce(p, ''), '(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일'); end if;
  if m is null then
    m := regexp_match(coalesce(p, ''), '(\d{1,2})월\s*(\d{1,2})일');
    if m is not null then
      m := array[extract(year from (now() at time zone 'Asia/Seoul'))::text, m[1], m[2]];
    end if;
  end if;
  if m is null then return null; end if;
  return make_date(m[1]::int, m[2]::int, m[3]::int);
exception when others then
  return null;
end $$;

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

  select * into s from seminars where id = p_id;
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

-- 특강 id별 신청 수만(이름·연락처·제목 없음 — 아직 적용 안 한 특강 제목이 새지 않게).
create or replace function public.comsw_seminar_counts() returns table(id uuid, applied int)
language sql stable security definer set search_path = public as $$
  select s.id, (select count(*) from seminar_applications a where a.seminar_id = s.id)::int
  from seminars s order by s.sort_order nulls last, s.title
$$;

revoke all on function public.comsw_apply_seminar(uuid, text, text), public.comsw_seminar_counts() from public;
grant execute on function public.comsw_apply_seminar(uuid, text, text), public.comsw_seminar_counts() to anon, authenticated;
