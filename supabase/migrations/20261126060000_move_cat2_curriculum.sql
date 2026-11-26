-- CAT 2급 강사 커리큘럼 주인 바로잡기(2026-11-26 사용자 결정). 운영 DB에는 사용자가 직접 실행한다. 20261126050000 다음.
--   예전 시트를 옮길 때 '자격증학과' 탭의 CAT 2급 작성자가 '김민주'로 적혀 있어, 동명이인과 구분이 안 돼 숨김 강사 '김민주'
--   (id 862978ef-…, 학과 사무 자격증, 담당 과목 없음)가 따로 생겼다. 실제 강사는 남현우 선생님.
--   1) 그 CAT 2급 커리큘럼을 남현우 선생님 것으로 옮기고(같은 줄 그대로, 글·이미지·검수 상태 유지),
--      건축·기계 자격증 학과 탭이 있으면 그 탭으로 옮긴다. 남현우 선생님 담당 과목에 CAT 2급을 넣는다(학과 설정은 바꾸지 않음).
--   2) 남은 것이 없는 숨김 '김민주' 기록은 보관 뒤 지운다(로그인 계정이 이어져 있거나 다른 자료가 남아 있으면 그대로 둔다).
--   3) 실행 전 공개 상태가 깨끗했으면 바로 공개, 아니면 V4 위쪽 안내의 [같이 반영]으로.
--   남현우 선생님이 한 명이 아니거나, 이미 같은 탭에 CAT 2급 커리큘럼이 있으면 아무것도 바꾸지 않고 멈춘다.
create table if not exists comsw_private.instructor_curricula_backup (
  id uuid primary key default gen_random_uuid(),
  reason text not null,
  row jsonb not null,
  backed_up_at timestamptz not null default now()
);

do $$
declare
  ghost uuid := '862978ef-f32f-4fb4-a4b8-a56254cad3a7';
  nam uuid;
  cat uuid;
  target uuid;
  clean boolean;
  moved int;
  left_rows int;
begin
  if not exists(select 1 from public.instructors where id = ghost and name = '김민주') then
    raise notice '옮길 숨김 김민주 기록이 없습니다(이미 정리됨). 바꾼 것 없음';
    return;
  end if;
  if (select count(*) from public.instructors where name = '남현우') <> 1 then
    raise exception '남현우 선생님 기록이 하나가 아닙니다. 바꾼 것 없음(관리자에게 알려주세요)';
  end if;
  select id into nam from public.instructors where name = '남현우';
  select id into cat from public.subjects where name = 'CAT 2급' and deleted_at is null;
  if cat is null then raise exception 'CAT 2급 과목이 없습니다. 바꾼 것 없음'; end if;
  select cs.id into target from public.curriculum_sets cs join public.departments d on d.id = cs.department_id
    where d.name = '건축·기계 자격증' and coalesce(cs.is_vacation, false) = false order by cs.sort_order nulls last limit 1;

  clean := exists(select 1 from public.site_snapshots) and not comsw_private.v4_differs();
  if exists(select 1 from public.instructor_curricula a join public.instructor_curricula b
              on b.instructor_id = nam and b.subject_id = cat and b.set_id = coalesce(target, a.set_id)
            where a.instructor_id = ghost and a.subject_id = cat) then
    raise exception '남현우 선생님에게 이미 같은 학과 탭의 CAT 2급 커리큘럼이 있습니다. 바꾼 것 없음';
  end if;

  insert into comsw_private.instructor_curricula_backup(reason, row)
    select 'CAT 2급 주인 바로잡기 2026-11-26(옮기기 전)', to_jsonb(ic) from public.instructor_curricula ic
    where ic.instructor_id = ghost and ic.subject_id = cat;
  update public.instructor_curricula set instructor_id = nam, set_id = coalesce(target, set_id)
    where instructor_id = ghost and subject_id = cat;
  get diagnostics moved = row_count;
  insert into public.instructor_subjects(instructor_id, subject_id)
    select nam, cat where not exists(select 1 from public.instructor_subjects where instructor_id = nam and subject_id = cat);
  raise notice 'CAT 2급 커리큘럼 % 줄을 남현우 선생님으로 옮겼습니다(학과 탭: %)', moved,
    coalesce((select name from public.curriculum_sets where id = target), '그대로');

  select count(*) into left_rows from public.instructor_curricula where instructor_id = ghost;
  if left_rows = 0 and (select account_uid is null and not is_listed from public.instructors where id = ghost) then
    insert into comsw_private.instructor_curricula_backup(reason, row)
      select '숨김 강사 김민주 기록 정리 2026-11-26', to_jsonb(i) from public.instructors i where id = ghost;
    delete from public.instructors where id = ghost;
    raise notice '빈 숨김 김민주 기록을 지웠습니다';
  else
    raise notice '숨김 김민주 기록에 다른 자료나 계정이 있어 그대로 두었습니다';
  end if;

  if clean then
    insert into public.site_snapshots(published_by, rows) values ('v4-migration', public.comsw_build_rows());
  else
    raise notice '반영하지 않은 다른 변경이 있어 바로 공개하지 않았습니다. V4 위쪽 안내의 [같이 반영]을 눌러주세요';
  end if;
end $$;
