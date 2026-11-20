-- V4 학과 구성 표(2026-11-20 사용자 요청): 과목마다 기간·과정내용(학과 커리큘럼 01~04)·프로그램(준비물)·학습수준을 고쳐 공개.
-- + 이번 제출 확정 때 학과장이 바꾼 단계 이미지도 함께(이미지 없는 단계 올리기·바꾸기). 운영 DB에는 사용자가 직접 실행한다. 20261120050000 다음.

-- p_items = [{id, duration, dept_curriculum, program, level}] 바뀐 과목만. 과목 정보는 모든 학과가 같이 쓴다.
-- program(계산 칸)은 tools에 넣고 supplies를 비운다(공개 칸 = 적은 그대로).
create function public.comsw_v4_save_subject_info(p_items jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform comsw_private.v4_guard();
  if jsonb_typeof(coalesce(p_items, 'null'::jsonb)) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception '고친 과목이 없습니다' using errcode = 'P0001';
  end if;
  if exists(select 1 from jsonb_array_elements(p_items) x
            where not exists(select 1 from public.subjects s where s.id = (x->>'id')::uuid and s.deleted_at is null)
               or length(coalesce(x->>'duration', '')) > 50 or length(coalesce(x->>'dept_curriculum', '')) > 2000
               or length(coalesce(x->>'program', '')) > 2000
               or coalesce(x->>'level', '') not in ('', '★☆☆☆☆', '★★☆☆☆', '★★★☆☆', '★★★★☆', '★★★★★')) then
    raise exception '과목 정보를 확인해주세요(없는 과목, 길이, 학습수준)' using errcode = 'P0001';
  end if;
  update public.subjects s set
    duration = nullif(btrim(x->>'duration'), ''),
    dept_curriculum = nullif(btrim(x->>'dept_curriculum'), ''),
    tools = nullif(btrim(x->>'program'), ''),
    supplies = null,
    level = nullif(x->>'level', '')
  from jsonb_array_elements(p_items) x where s.id = (x->>'id')::uuid;
  perform comsw_private.v4_publish();
end $$;
revoke all on function public.comsw_v4_save_subject_info(jsonb) from public, anon;
grant execute on function public.comsw_v4_save_subject_info(jsonb) to authenticated;

create or replace function public.comsw_v4_confirm_curriculum(p_instructor uuid, p_set uuid, p_subject uuid, p_steps jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare n int; old jsonb;
begin
  perform comsw_private.v4_guard();
  perform pg_advisory_xact_lock(hashtext('comsw-curriculum'), hashtext(p_instructor::text));
  select count(*) into n from public.instructor_curricula
    where instructor_id = p_instructor and set_id = p_set and subject_id = p_subject and status = 'pending';
  if n = 0 then raise exception '확정할 제출이 없습니다' using errcode = 'P0001'; end if;
  if n <> 4 then raise exception '4단계가 모두 있어야 확정할 수 있습니다(지금 %단계)', n using errcode = 'P0001'; end if;
  if jsonb_array_length(coalesce(p_steps, '[]'::jsonb)) <> 4 or exists(
    select 1 from public.instructor_curricula c
    where c.instructor_id = p_instructor and c.set_id = p_set and c.subject_id = p_subject and c.status = 'pending'
      and not exists(select 1 from jsonb_array_elements(p_steps) x
                     where (x->>'id')::uuid = c.id and (x->>'updated_at')::timestamptz = c.updated_at)) then
    raise exception '그사이 제출이 바뀌었습니다. 새로 불러온 뒤 확정해주세요' using errcode = 'P0001';
  end if;
  if exists(select 1 from jsonb_array_elements(p_steps) x
            where coalesce(x->>'media_url', '') <> '' and (x->>'media_url' !~* '^https?://' or length(x->>'media_url') > 2000)) then
    raise exception '이미지 주소를 확인해주세요' using errcode = 'P0001';
  end if;
  update public.instructor_curricula c set summary = nullif(btrim(x->>'summary'), '')
    from jsonb_array_elements(p_steps) x where c.id = (x->>'id')::uuid and x ? 'summary';
  -- 학과장이 확정 전에 바꾼 이미지(비우면 강사 이미지 그대로)
  update public.instructor_curricula c set media_url = btrim(x->>'media_url')
    from jsonb_array_elements(p_steps) x where c.id = (x->>'id')::uuid and coalesce(btrim(x->>'media_url'), '') <> '';
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
  -- 이 강사의 담당 과목·학과(강사 소개에 쓰임). 과목의 학과 구성·순서·공통 준비물은 건드리지 않는다.
  insert into public.instructor_subjects(instructor_id, subject_id) values (p_instructor, p_subject) on conflict do nothing;
  insert into public.instructor_departments(instructor_id, department_id)
    select p_instructor, department_id from public.curriculum_sets where id = p_set and department_id is not null
  on conflict do nothing;
  perform comsw_private.v4_publish();
end $$;

