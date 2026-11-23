-- V4 학과장·관리자는 언제든 커리큘럼을 고친다(2026-11-23 사용자 요청). 운영 DB에는 사용자가 직접 실행한다. 20261123020000 다음.
-- 이번 제출(검수 전) 확정과 검수 완료 수정이 같은 '단계 고치기'를 쓴다:
--   p_steps = 화면 순서대로 [{id, updated_at, written?, summary, media_url, delete?}(있던 단계) | {written, summary, media_url}(새 단계, id 없음)]
--   - 있던 단계는 모두 보내야 한다(화면이 본 버전 확인). 원래 문구(written)·홈페이지 문구·이미지를 고친다.
--   - delete: 4단계를 넘을 때만 지운다(지운 뒤 4단계 이상). 새 단계: 4단계까지만 더한다.
--   - 남은 단계는 보낸 순서대로 '1단계…'로 다시 번호.
-- 확정(이번 제출)은 고친 뒤 정확히 4단계여야 한다. 고치기 전 검수본은 v4_curricula_archive에 보관.

create function comsw_private.v4_apply_steps(p_instructor uuid, p_set uuid, p_subject uuid, p_status text, p_steps jsonb, p_exact4 boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare n int; given int; dels int; adds int; kept int; vac boolean;
begin
  select count(*) into n from public.instructor_curricula
    where instructor_id = p_instructor and set_id = p_set and subject_id = p_subject and status = p_status;
  select count(*) filter (where x ? 'id'), count(*) filter (where x ? 'id' and coalesce((x->>'delete')::boolean, false)), count(*) filter (where not x ? 'id')
    into given, dels, adds from jsonb_array_elements(coalesce(p_steps, '[]'::jsonb)) x;
  if given <> n or exists(
    select 1 from public.instructor_curricula c
    where c.instructor_id = p_instructor and c.set_id = p_set and c.subject_id = p_subject and c.status = p_status
      and not exists(select 1 from jsonb_array_elements(p_steps) x
                     where (x->>'id')::uuid = c.id and (x->>'updated_at')::timestamptz = c.updated_at)) then
    raise exception '그사이 커리큘럼이 바뀌었습니다. 새로 불러온 뒤 다시 해주세요' using errcode = 'P0001';
  end if;
  if exists(select 1 from jsonb_array_elements(p_steps) x
            where length(coalesce(x->>'summary', '')) > 2000 or length(coalesce(x->>'written', '')) > 4000
               or (coalesce(x->>'media_url', '') <> '' and (x->>'media_url' !~* '^https?://' or length(x->>'media_url') > 2000))
               or (not x ? 'id' and btrim(coalesce(x->>'written', '')) = '')) then
    raise exception '문구 길이·이미지 주소를 확인하고, 새 단계에는 원래 문구를 써주세요' using errcode = 'P0001';
  end if;
  kept := n - dels + adds;
  if p_exact4 and kept <> 4 then
    raise exception '4단계가 되어야 확정할 수 있습니다(지금 %단계)', kept using errcode = 'P0001';
  end if;
  if not p_exact4 and ((dels > 0 and kept < 4) or (adds > 0 and kept > 4)) then
    raise exception '단계는 4단계까지만 더하고, 4단계보다 적게 지울 수 없습니다(지금 %단계)', kept using errcode = 'P0001';
  end if;
  select coalesce(bool_or(vacation), (select is_vacation from public.curriculum_sets where id = p_set), false) into vac
    from public.instructor_curricula where instructor_id = p_instructor and set_id = p_set and subject_id = p_subject;
  delete from public.instructor_curricula c using jsonb_array_elements(p_steps) x
    where c.id = (x->>'id')::uuid and coalesce((x->>'delete')::boolean, false);
  update public.instructor_curricula c
    set written = case when x ? 'written' then nullif(btrim(x->>'written'), '') else c.written end,
        summary = nullif(btrim(x->>'summary'), ''),
        media_url = coalesce(nullif(btrim(x->>'media_url'), ''), c.media_url),
        sort_order = o, updated_at = clock_timestamp()
    from jsonb_array_elements(p_steps) with ordinality e(x, o) where c.id = (x->>'id')::uuid;
  insert into public.instructor_curricula(set_id, instructor_id, subject_id, step_label, written, summary, media_url, status, sort_order, vacation)
    select p_set, p_instructor, p_subject, o || '단계', btrim(x->>'written'), nullif(btrim(x->>'summary'), ''), nullif(btrim(x->>'media_url'), ''), p_status, o, vac
    from jsonb_array_elements(p_steps) with ordinality e(x, o) where not x ? 'id';
  -- 번호 다시: 보낸 순서(sort_order = 위치) 그대로 1단계부터
  update public.instructor_curricula c set step_label = r.k || '단계', sort_order = r.k
    from (select id, row_number() over (order by sort_order, updated_at) k from public.instructor_curricula
          where instructor_id = p_instructor and set_id = p_set and subject_id = p_subject and status = p_status) r
    where c.id = r.id;
end $$;
revoke all on function comsw_private.v4_apply_steps(uuid, uuid, uuid, text, jsonb, boolean) from public, anon, authenticated;

-- 검수 완료 수정: 보관 → 단계 고치기 → 공개
create or replace function public.comsw_v4_edit_curriculum(p_instructor uuid, p_set uuid, p_subject uuid, p_steps jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare old jsonb;
begin
  perform comsw_private.v4_guard();
  perform pg_advisory_xact_lock(hashtext('comsw-curriculum'), hashtext(p_instructor::text));
  select jsonb_agg(to_jsonb(c) order by c.sort_order nulls last, c.step_label) into old
    from public.instructor_curricula c
    where c.instructor_id = p_instructor and c.set_id = p_set and c.subject_id = p_subject and c.status = 'approved';
  if old is null then raise exception '고칠 검수 완료 커리큘럼이 없습니다' using errcode = 'P0001'; end if;
  insert into public.v4_curricula_archive(instructor_id, set_id, subject_id, rows, archived_by)
    values (p_instructor, p_set, p_subject, old, auth.jwt() ->> 'sub');
  perform comsw_private.v4_apply_steps(p_instructor, p_set, p_subject, 'approved', p_steps, false);
  perform comsw_private.v4_publish();
end $$;

-- 이번 제출 확정: 단계 고치기(정확히 4단계) → 예전 검수본 보관·교체 → 담당 과목·학과 연결 → 공개
create or replace function public.comsw_v4_confirm_curriculum(p_instructor uuid, p_set uuid, p_subject uuid, p_steps jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare old jsonb;
begin
  perform comsw_private.v4_guard();
  perform pg_advisory_xact_lock(hashtext('comsw-curriculum'), hashtext(p_instructor::text));
  if not exists(select 1 from public.instructor_curricula
                where instructor_id = p_instructor and set_id = p_set and subject_id = p_subject and status = 'pending') then
    raise exception '확정할 제출이 없습니다' using errcode = 'P0001';
  end if;
  perform comsw_private.v4_apply_steps(p_instructor, p_set, p_subject, 'pending', p_steps, true);
  select jsonb_agg(to_jsonb(c) order by c.sort_order nulls last, c.step_label) into old
    from public.instructor_curricula c
    where c.instructor_id = p_instructor and c.set_id = p_set and c.subject_id = p_subject and c.status = 'approved';
  if old is not null then
    insert into public.v4_curricula_archive(instructor_id, set_id, subject_id, rows, archived_by)
      values (p_instructor, p_set, p_subject, old, auth.jwt() ->> 'sub');
    delete from public.instructor_curricula
      where instructor_id = p_instructor and set_id = p_set and subject_id = p_subject and status = 'approved';
  end if;
  update public.instructor_curricula set status = 'approved', updated_at = clock_timestamp()
    where instructor_id = p_instructor and set_id = p_set and subject_id = p_subject and status = 'pending';
  insert into public.instructor_subjects(instructor_id, subject_id) values (p_instructor, p_subject) on conflict do nothing;
  insert into public.instructor_departments(instructor_id, department_id)
    select p_instructor, department_id from public.curriculum_sets where id = p_set and department_id is not null
  on conflict do nothing;
  perform comsw_private.v4_publish();
end $$;
