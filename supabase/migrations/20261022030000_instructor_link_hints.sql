-- 같은 이름 강사 구분: 선생님 후보에 학과·담당 과목, 관리자 연결 카드에 요청자 이메일을 보여 준다.
alter table public.instructor_link_requests add column requester_email text;

-- 반환 칸이 바뀌어 다시 만든다. 학과·과목은 사이트 '학과 강사소개'에 공개되는 정보다.
drop function public.comsw_instructor_candidates(text);
create function public.comsw_instructor_candidates(p_name text)
returns table(id uuid, name text, departments text[], subjects text[])
language plpgsql stable security definer set search_path = '' as $$
begin
  perform comsw_private.member_uid();
  return query select i.id, i.name,
    array(select d.name from public.instructor_departments x join public.departments d on d.id = x.department_id
          where x.instructor_id = i.id order by d.sort_order nulls last, d.name),
    array(select s.name from public.instructor_subjects x join public.subjects s on s.id = x.subject_id
          where x.instructor_id = i.id order by x.sort_order nulls last, s.sort_order nulls last, s.name)
    from public.instructors i
    where i.account_uid is null and lower(trim(i.name)) = lower(trim(p_name)) order by i.sort_order nulls last;
end $$;
revoke all on function public.comsw_instructor_candidates(text) from public, anon;
grant execute on function public.comsw_instructor_candidates(text) to authenticated;

-- 요청자 이메일은 화면 입력이 아니라 로그인 토큰에서 가져온다.
create or replace function public.comsw_request_instructor_link(p_instructor_id uuid, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare u text := comsw_private.member_uid();
begin
  perform pg_advisory_xact_lock(hashtext('comsw-account'), hashtext(u));
  if exists(select 1 from public.instructors where account_uid=u) then raise exception '이미 연결된 강사 정보가 있습니다'; end if;
  if not exists(select 1 from public.instructors where id=p_instructor_id and account_uid is null and lower(trim(name))=lower(trim(p_name))) then
    raise exception '연결 가능한 같은 이름의 강사 정보가 없습니다';
  end if;
  insert into public.instructor_link_requests(account_uid,instructor_id,requested_name,requester_email)
    values(u,p_instructor_id,trim(p_name),nullif(auth.jwt()->>'email',''))
    on conflict(account_uid) do update set instructor_id=excluded.instructor_id, requested_name=excluded.requested_name,
      requester_email=excluded.requester_email, created_at=now();
end $$;
