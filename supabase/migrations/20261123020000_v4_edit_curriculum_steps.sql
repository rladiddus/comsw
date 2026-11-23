-- V4 검수 완료 커리큘럼 수정 넓히기(2026-11-23 사용자 요청). 운영 DB에는 사용자가 직접 실행한다. 20261123010000 다음.
-- - 원래 문구(written)도 고친다(AI 다듬기의 재료).
-- - 4단계를 넘는 단계는 지울 수 있다({delete: true}). 지운 뒤에도 4단계 이상 남아야 한다.
-- - 남은 단계는 순서대로 '1단계, 2단계…'로 다시 번호를 매긴다. 고치기 전 것은 v4_curricula_archive에 보관.
-- p_steps = [{id, updated_at, written?, summary, media_url, delete?}] 그 과목의 검수 완료 줄 전부(화면이 본 버전).
create or replace function public.comsw_v4_edit_curriculum(p_instructor uuid, p_set uuid, p_subject uuid, p_steps jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare n int; kept int; old jsonb;
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
            where length(coalesce(x->>'summary', '')) > 2000 or length(coalesce(x->>'written', '')) > 4000
               or (coalesce(x->>'media_url', '') <> '' and (x->>'media_url' !~* '^https?://' or length(x->>'media_url') > 2000))) then
    raise exception '문구 길이나 이미지 주소를 확인해주세요' using errcode = 'P0001';
  end if;
  select count(*) into kept from jsonb_array_elements(p_steps) x where coalesce((x->>'delete')::boolean, false) is false;
  if kept < n and kept < 4 then
    raise exception '4단계보다 적게 지울 수 없습니다(남는 단계 %개)', kept using errcode = 'P0001';
  end if;
  select jsonb_agg(to_jsonb(c) order by c.sort_order nulls last, c.step_label) into old
    from public.instructor_curricula c
    where c.instructor_id = p_instructor and c.set_id = p_set and c.subject_id = p_subject and c.status = 'approved';
  insert into public.v4_curricula_archive(instructor_id, set_id, subject_id, rows, archived_by)
    values (p_instructor, p_set, p_subject, old, auth.jwt() ->> 'sub');
  delete from public.instructor_curricula c using jsonb_array_elements(p_steps) x
    where c.id = (x->>'id')::uuid and coalesce((x->>'delete')::boolean, false);
  update public.instructor_curricula c
    set written = case when x ? 'written' then nullif(btrim(x->>'written'), '') else c.written end,
        summary = nullif(btrim(x->>'summary'), ''),
        media_url = coalesce(nullif(btrim(x->>'media_url'), ''), c.media_url),
        updated_at = clock_timestamp()
    from jsonb_array_elements(p_steps) x where c.id = (x->>'id')::uuid;
  -- 남은 단계 번호 다시 매기기(화면이 보낸 순서 = 지금 순서)
  update public.instructor_curricula c set step_label = r.k || '단계', sort_order = r.k
    from (select (x->>'id')::uuid id, row_number() over (order by o) k
          from jsonb_array_elements(p_steps) with ordinality e(x, o)
          where coalesce((x->>'delete')::boolean, false) is false) r
    where c.id = r.id;
  perform comsw_private.v4_publish();
end $$;
