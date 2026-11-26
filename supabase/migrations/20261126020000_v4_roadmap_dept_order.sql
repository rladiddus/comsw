-- V4 로드맵 학과 순서(2026-11-26 사용자 요청). 운영 DB에는 사용자가 직접 실행한다. 20261126010000 다음.
--   - 로드맵 화면의 학과 탭을 끌어서 정한 순서 = 홈페이지 로드맵의 위→아래 순서(roadmap_tracks.sort_order). 학과 순서(학과·과목)와는 따로.
--   - 새로 만드는 로드맵 줄의 순서가 다른 줄과 겹치면 맨 아래로(겹치면 이름순으로 섞이지 않게).
create function public.comsw_v4_save_roadmap_order(p_departments uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform comsw_private.v4_guard();
  update public.roadmap_tracks t set sort_order = array_position(p_departments, t.department_id) - 1
    where t.department_id = any(coalesce(p_departments, '{}'));
  perform comsw_private.v4_publish();
end $$;
revoke all on function public.comsw_v4_save_roadmap_order(uuid[]) from public, anon;
grant execute on function public.comsw_v4_save_roadmap_order(uuid[]) to authenticated;

create function comsw_private.roadmap_track_last() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.sort_order is null or exists(select 1 from public.roadmap_tracks where sort_order = new.sort_order) then
    new.sort_order := coalesce((select max(sort_order) from public.roadmap_tracks), -1) + 1;
  end if;
  return new;
end $$;
revoke all on function comsw_private.roadmap_track_last() from public, anon, authenticated;
create trigger roadmap_track_last before insert on public.roadmap_tracks
  for each row execute function comsw_private.roadmap_track_last();
