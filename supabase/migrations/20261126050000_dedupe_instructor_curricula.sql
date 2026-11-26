-- 강사 커리큘럼 중복 정리(2026-11-26 사용자 결정). 운영 DB에는 사용자가 직접 실행한다. 20261126040000 다음.
--   같은 강사·같은 과목이 여러 학과 탭(방학 특강 탭 제외)에 "단계 이름·원문·이미지·준비물·수업시간·상태가 같게" 있으면
--   강사의 학과 탭 것만 남기고 나머지를 지운다(순서 번호·AI 요약은 비교하지 않음, 남기는 쪽 요약은 그대로).
--   남길 강사의 학과 탭이 없는 묶음은 건드리지 않는다. 실행 시점 조회: 온세상 · 라이노 1·2의 사무 자격증 탭.
--   지우기 전에 지울 줄 전체를 comsw_private.instructor_curricula_backup에 남긴다.
--   실행 전 공개 상태가 깨끗했으면 바로 공개, 아니면 V4 위쪽 안내의 [같이 반영]으로.
create table if not exists comsw_private.instructor_curricula_backup (
  id uuid primary key default gen_random_uuid(),
  reason text not null,
  row jsonb not null,
  backed_up_at timestamptz not null default now()
);

do $$
declare
  clean boolean;
  n int;
begin
  clean := exists(select 1 from public.site_snapshots) and not comsw_private.v4_differs();
  create temp table v4_dupe_drop on commit drop as
  with unit as (
    select ic.instructor_id, ic.subject_id, ic.set_id, cs.department_id,
           md5(string_agg(concat_ws('|', ic.step_label, ic.written, ic.media_url, ic.supplies, ic.supplies_detail, ic.class_time, ic.status),
                          '§' order by ic.step_label)) as body
    from public.instructor_curricula ic
    join public.curriculum_sets cs on cs.id = ic.set_id
    where coalesce(cs.is_vacation, false) = false
    group by ic.instructor_id, ic.subject_id, ic.set_id, cs.department_id
  ), marked as (
    select u.*, exists(select 1 from public.instructor_departments x
                       where x.instructor_id = u.instructor_id and x.department_id = u.department_id) as mine
    from unit u
  ), groups as (
    select instructor_id, subject_id, body from marked
    group by instructor_id, subject_id, body
    having count(*) >= 2 and bool_or(mine)
  )
  select m.instructor_id, m.subject_id, m.set_id
  from marked m join groups g using (instructor_id, subject_id, body)
  where not m.mine;

  insert into comsw_private.instructor_curricula_backup(reason, row)
    select '중복 정리 2026-11-26', to_jsonb(ic)
    from public.instructor_curricula ic
    join v4_dupe_drop d on d.instructor_id = ic.instructor_id and d.subject_id = ic.subject_id and d.set_id = ic.set_id;
  delete from public.instructor_curricula ic
    using v4_dupe_drop d
    where d.instructor_id = ic.instructor_id and d.subject_id = ic.subject_id and d.set_id = ic.set_id;
  get diagnostics n = row_count;
  raise notice '중복된 강사 커리큘럼 % 줄을 지웠습니다(보관: comsw_private.instructor_curricula_backup)', n;
  if n = 0 then return; end if;
  if clean then
    insert into public.site_snapshots(published_by, rows) values ('v4-migration', public.comsw_build_rows());
  else
    raise notice '반영하지 않은 다른 변경이 있어 바로 공개하지 않았습니다. V4 위쪽 안내의 [같이 반영]을 눌러주세요';
  end if;
end $$;
