-- 홈페이지 로드맵 학과 이름 = 학과 이름(2026-11-26 사용자 요청). 운영 DB에는 사용자가 직접 실행한다. 20261126020000 다음.
--   로드맵 줄(roadmap_tracks.name)은 만들 때의 학과 이름을 따로 저장해, 학과 이름을 바꿔도 홈페이지 로드맵에는 옛 이름이 남았다
--   (예: '건축·기계' → '건축·기계 자격증', '자격증학과' → '사무 자격증').
--   1) 학과에 연결된 로드맵 줄 이름을 지금 학과 이름으로 한 번 맞춘다.
--   2) 학과 이름을 바꾸면 그 학과의 로드맵 줄 이름도 같이 바뀐다(학과명 바꾸기 트리거에 더함).
--   3) 실행 전 공개 상태가 깨끗했으면 바로 공개, 아니면 V4 위쪽 안내의 [같이 반영]으로.
create or replace function public.comsw_department_renamed() returns trigger
language plpgsql set search_path = '' as $$
begin
  update public.curriculum_sets set name = new.name where department_id = new.id and name = old.name;
  update public.roadmap_tracks set name = new.name where department_id = new.id and name is distinct from new.name;
  new.former_names := array_remove(
    case when old.name = any(old.former_names) then old.former_names else old.former_names || old.name end, new.name);
  return new;
end $$;

do $$
declare
  clean boolean;
  n int;
begin
  clean := exists(select 1 from public.site_snapshots) and not comsw_private.v4_differs();
  update public.roadmap_tracks t set name = d.name
    from public.departments d where d.id = t.department_id and t.name is distinct from d.name;
  get diagnostics n = row_count;
  raise notice '로드맵 학과 이름 % 줄을 지금 학과 이름으로 맞췄습니다', n;
  if n = 0 then return; end if;
  if clean then
    insert into public.site_snapshots(published_by, rows) values ('v4-migration', public.comsw_build_rows());
  else
    raise notice '반영하지 않은 다른 변경이 있어 바로 공개하지 않았습니다. V4 위쪽 안내의 [같이 반영]을 눌러주세요';
  end if;
end $$;
