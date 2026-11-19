-- V4 학과 추가·학과명 수정(2026-11-19 사용자 요청): 학과·과목 › 학과 구성의 [+ 학과 추가] / [학과명 수정]. 바로 공개.
-- 운영 DB에는 사용자가 직접 실행한다. 20261119060000 다음.
-- - 새 학과: departments + 같은 이름의 강사 커리큘럼 학과 탭(curriculum_sets, 강사가 이 학과로 제출할 곳).
-- - 이름 수정: 기존 트리거(20261118030000)가 같은 이름 학과 탭도 바꾸고 옛 이름을 former_names에 남긴다.
create function public.comsw_v4_save_department(p_id uuid, p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v uuid := p_id; n text := btrim(coalesce(p_name, ''));
begin
  perform comsw_private.v4_guard();
  if length(n) not between 1 and 40 then raise exception '학과 이름을 확인해주세요(1~40자)' using errcode = 'P0001'; end if;
  if exists(select 1 from public.departments where name = n and id is distinct from v) then
    raise exception '같은 이름의 학과가 있습니다' using errcode = 'P0001';
  end if;
  if v is null then
    insert into public.departments(name, sort_order) values (n, (select coalesce(max(sort_order), -1) + 1 from public.departments))
      returning id into v;
    if not exists(select 1 from public.curriculum_sets where name = n) then
      insert into public.curriculum_sets(name, department_id, sort_order)
        values (n, v, (select coalesce(max(sort_order), -1) + 1 from public.curriculum_sets));
    end if;
  else
    update public.departments set name = n where id = v;
    if not found then raise exception '학과가 없습니다' using errcode = 'P0001'; end if;
  end if;
  perform comsw_private.v4_publish();
  return v;
end $$;
revoke all on function public.comsw_v4_save_department(uuid, text) from public, anon;
grant execute on function public.comsw_v4_save_department(uuid, text) to authenticated;
