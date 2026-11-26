-- 학과와 연결되지 않은 예전 로드맵 줄 지우기(2026-11-26 사용자 결정). 운영 DB에는 사용자가 직접 실행한다.
--   대상(실행 시점 조회 결과): 사무 자격증, 디자인 자격증, 건축/기계 자격증. V4 관리 화면에는 보이지 않던 줄들.
--   - 지우기 전에 줄 이름·단계·과목·문구를 comsw_private.roadmap_track_backup에 남긴다(되살릴 때 참고).
--   - 단계·단계 과목은 함께 지워진다(on delete cascade). 과목 자체와 학과에 연결된 로드맵은 그대로.
--   - 실행 전 홈페이지 공개 상태가 깨끗했으면 바로 공개, 아니면 V4 위쪽 안내의 [같이 반영]으로 공개.
create table if not exists comsw_private.roadmap_track_backup (
  id uuid primary key default gen_random_uuid(),
  track_name text not null,
  rows jsonb not null,
  deleted_at timestamptz not null default now()
);

do $$
declare
  clean boolean;
  n int;
begin
  clean := exists(select 1 from public.site_snapshots) and not comsw_private.v4_differs();
  insert into comsw_private.roadmap_track_backup(track_name, rows)
    select t.name, coalesce((
      select jsonb_agg(jsonb_build_object('position', st.position, 'summary', st.summary, 'source_text', st.source_text,
               'subjects', (select jsonb_agg(sj.name order by rs.sort_order nulls last, sj.name)
                            from public.roadmap_step_subjects rs join public.subjects sj on sj.id = rs.subject_id
                            where rs.step_id = st.id))
             order by st.position)
      from public.roadmap_steps st where st.track_id = t.id), '[]'::jsonb)
    from public.roadmap_tracks t where t.department_id is null;
  delete from public.roadmap_tracks where department_id is null;
  get diagnostics n = row_count;
  raise notice '연결된 학과가 없는 로드맵 % 줄을 지웠습니다(보관: comsw_private.roadmap_track_backup)', n;
  if n = 0 then return; end if;
  if clean then
    insert into public.site_snapshots(published_by, rows) values ('v4-migration', public.comsw_build_rows());
  else
    raise notice '반영하지 않은 다른 변경이 있어 바로 공개하지 않았습니다. V4 위쪽 안내의 [같이 반영]을 눌러주세요';
  end if;
end $$;
