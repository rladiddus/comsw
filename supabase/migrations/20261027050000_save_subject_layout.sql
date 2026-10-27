-- 학과 커리큘럼·학과별 과목의 '저장'을 한 번에(Codex 리뷰 ⑥, 2026-10-27).
-- 예전에는 연결 추가 → 과목 수정 → 연결 삭제를 따로 요청해, 중간에 실패하면 일부만 저장되고
-- 다시 저장하면 이미 들어간 연결 때문에 막혔다. 이 함수는 한 트랜잭션이라 전부 저장되거나 전부 안 된다.
--   p_add:      [{subject_id, department_id}]           — 이미 있으면 건너뜀(다시 저장해도 안전)
--   p_subjects: [{id, name?, duration?, tools?, supplies?, level?, sort_order?}] — 들어온 칸만 바꿈
--   p_remove:   [{subject_id, department_id}]           — 마지막 학과에서 빠지면 트리거가 기타 과목으로
-- 학과장·관리자만. SECURITY INVOKER라 표 권한(RLS)도 그대로 적용된다.
create function public.comsw_save_subject_layout(p_add jsonb, p_subjects jsonb, p_remove jsonb) returns void
language plpgsql set search_path = '' as $$
declare e jsonb;
begin
  if coalesce(public.comsw_role(), '') not in ('admin', 'head') then
    raise exception '저장 권한이 없습니다' using errcode = '42501';
  end if;
  insert into public.subject_departments(subject_id, department_id)
    select (x->>'subject_id')::uuid, (x->>'department_id')::uuid
    from jsonb_array_elements(coalesce(p_add, '[]'::jsonb)) x
  on conflict do nothing;
  for e in select * from jsonb_array_elements(coalesce(p_subjects, '[]'::jsonb)) loop
    if e ? 'name' and btrim(coalesce(e->>'name', '')) = '' then
      raise exception '과목명을 입력해주세요';
    end if;
    update public.subjects set
      name = case when e ? 'name' then btrim(e->>'name') else name end,
      duration = case when e ? 'duration' then e->>'duration' else duration end,
      tools = case when e ? 'tools' then e->>'tools' else tools end,
      supplies = case when e ? 'supplies' then e->>'supplies' else supplies end,
      level = case when e ? 'level' then e->>'level' else level end,
      sort_order = case when e ? 'sort_order' then (e->>'sort_order')::int else sort_order end
    where id = (e->>'id')::uuid;
  end loop;
  delete from public.subject_departments d
    using jsonb_array_elements(coalesce(p_remove, '[]'::jsonb)) x
    where d.subject_id = (x->>'subject_id')::uuid and d.department_id = (x->>'department_id')::uuid;
end $$;
revoke all on function public.comsw_save_subject_layout(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.comsw_save_subject_layout(jsonb, jsonb, jsonb) to authenticated;
