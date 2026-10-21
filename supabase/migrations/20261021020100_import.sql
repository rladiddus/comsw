-- 관리 화면 '시트에서 가져오기': 브라우저가 시트 원본을 변환해 넘긴 표별 행으로 콘텐츠 표를 통째로 갈아끼운다.
-- 함수 하나 = 트랜잭션 하나라 중간에 실패하면 기존 데이터가 그대로 남는다. 스냅샷(site_snapshots)은 건드리지 않는다.
create or replace function public.comsw_import(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  -- 의존 순서(부모 먼저). 이 목록에 없는 키는 무시한다.
  tables text[] := array[
    'departments', 'site_categories', 'subjects', 'subject_departments', 'subject_weeks',
    'instructors', 'instructor_departments', 'instructor_subjects', 'curriculum_sets',
    'instructor_curricula', 'roadmap_tracks', 'roadmap_steps', 'roadmap_step_subjects',
    'course_prep_items', 'seminars', 'seminar_applications', 'recruitment_posts',
    'main_media', 'menus', 'loading_items', 'site_settings'];
  t text;
  cols text;
  rows jsonb;
  result jsonb := '{}';
begin
  if coalesce(comsw_role(), '') not in ('admin', 'head') then
    raise exception '가져오기 권한이 없습니다';
  end if;
  execute 'truncate ' || (select string_agg(format('public.%I', x), ', ') from unnest(tables) x) || ' cascade';
  foreach t in array tables loop
    rows := payload -> t;
    if rows is null or jsonb_typeof(rows) <> 'array' or jsonb_array_length(rows) = 0 then continue; end if;
    -- 넘어온 열만 넣어 id·created_at 같은 기본값은 DB가 채운다.
    select string_agg(format('%I', k), ', ') into cols from jsonb_object_keys(rows -> 0) k;
    execute format('insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I, $1)', t, cols, cols, t)
      using rows;
    result := result || jsonb_build_object(t, jsonb_array_length(rows));
  end loop;
  return result;
end $$;

revoke all on function public.comsw_import(jsonb) from public, anon;
grant execute on function public.comsw_import(jsonb) to authenticated;
