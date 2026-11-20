-- V4 검수 완료 커리큘럼 학과장·관리자 수정(2026-11-20 사용자 요청). 운영 DB에는 사용자가 직접 실행한다. 20261120040000 다음.
-- 강사 팝업 › 커리큘럼(검수 완료)에서 [수정]: 단계마다 홈페이지 문구, 이미지가 없는 단계는 이미지 올리기. 바로 공개, 예전 검수본은 보관.
-- p_steps = [{id, updated_at, summary, media_url}] 그 과목의 검수 완료 줄 전부(화면이 본 버전).
create function public.comsw_v4_edit_curriculum(p_instructor uuid, p_set uuid, p_subject uuid, p_steps jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare n int; old jsonb;
begin
  perform comsw_private.v4_guard();
  perform pg_advisory_xact_lock(hashtext('comsw-curriculum'), hashtext(p_instructor::text));
  select count(*) into n from public.instructor_curricula
    where instructor_id = p_instructor and set_id = p_set and subject_id = p_subject and status = 'approved';
  if n = 0 then raise exception '고칠 검수 완료 커리큘럼이 없습니다' using errcode = 'P0001'; end if;
  if jsonb_array_length(coalesce(p_steps, '[]'::jsonb)) <> n or exists(
    select 1 from public.instructor_curricula c
    where c.instructor_id = p_instructor and c.set_id = p_set and c.subject_id = p_subject and c.status = 'approved'
      and not exists(select 1 from jsonb_array_elements(p_steps) x
                     where (x->>'id')::uuid = c.id and (x->>'updated_at')::timestamptz = c.updated_at)) then
    raise exception '그사이 커리큘럼이 바뀌었습니다. 새로 불러온 뒤 고쳐주세요' using errcode = 'P0001';
  end if;
  if exists(select 1 from jsonb_array_elements(p_steps) x
            where length(coalesce(x->>'summary', '')) > 2000
               or (coalesce(x->>'media_url', '') <> '' and (x->>'media_url' !~* '^https?://' or length(x->>'media_url') > 2000))) then
    raise exception '문구 길이나 이미지 주소를 확인해주세요' using errcode = 'P0001';
  end if;
  select jsonb_agg(to_jsonb(c) order by c.sort_order nulls last, c.step_label) into old
    from public.instructor_curricula c
    where c.instructor_id = p_instructor and c.set_id = p_set and c.subject_id = p_subject and c.status = 'approved';
  insert into public.v4_curricula_archive(instructor_id, set_id, subject_id, rows, archived_by)
    values (p_instructor, p_set, p_subject, old, auth.jwt() ->> 'sub');
  update public.instructor_curricula c
    set summary = nullif(btrim(x->>'summary'), ''),
        media_url = coalesce(nullif(btrim(x->>'media_url'), ''), c.media_url),
        updated_at = clock_timestamp()
    from jsonb_array_elements(p_steps) x where c.id = (x->>'id')::uuid;
  perform comsw_private.v4_publish();
end $$;
revoke all on function public.comsw_v4_edit_curriculum(uuid, uuid, uuid, jsonb) from public, anon;
grant execute on function public.comsw_v4_edit_curriculum(uuid, uuid, uuid, jsonb) to authenticated;
