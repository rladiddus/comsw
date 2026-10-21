-- "적용": 콘텐츠 테이블을 공개 사이트가 읽는 시트 모양(raw_sheet_rows와 같은 행)으로 묶어 스냅샷으로 저장한다.
-- 셀 값은 시트처럼 문자열: 체크박스 'true'/'false', 숫자는 숫자 문자열, 빈 칸은 ''.

create function public.comsw_sheet(p_source text, p_sheet text, p_rows jsonb) returns jsonb
language sql immutable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'source_id', p_source, 'sheet_name', p_sheet, 'row_number', ord + 1,
           'data', jsonb_build_object('values', v)) order by ord), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) with ordinality as e(v, ord)
$$;

create function public.comsw_build_rows() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  result jsonb := '[]'::jsonb;
  s record;
  d record;
  width int;
begin
  -- 메인 페이지: 미디어(A–C)와 메뉴(E–H)를 같은 행 번호에. 1행 J = 로드맵 로고.
  -- 방학 특강 메뉴 행(I·J)은 로고와 겹치지 않게 다른 메뉴 뒤, 최소 2행.
  result := result || comsw_sheet('main', '메인 페이지', (
    with media as (
      select row_number() over (order by sort_order nulls last, url) n, * from main_media
    ), plain as (
      select row_number() over (order by sort_order nulls last, name) n, * from menus
      where replace(name, ' ', '') <> '방학특강'
    ), vacation as (
      select greatest((select count(*) from plain) + 1, 2) n, * from menus
      where replace(name, ' ', '') = '방학특강'
    ), menu as (
      select n, name, is_active, side, sort_order, false as is_vacation from plain
      union all
      select n, name, is_active, side, sort_order, true from vacation
    ), nums as (
      select generate_series(1, greatest((select count(*) from media), (select max(n) from menu), 1)) n
    )
    select jsonb_agg(jsonb_build_array(
      coalesce(media.url, ''), coalesce(media.caption, ''), coalesce(media.is_active::text, ''), '',
      coalesce(menu.name, ''), coalesce(menu.is_active::text, ''),
      case menu.side when 'left' then '왼쪽' when 'right' then '오른쪽' else '' end,
      coalesce(menu.sort_order::text, ''),
      case when menu.is_vacation then coalesce((select c.name from curriculum_sets c join site_settings v
             on v.key = 'vacation_set_id' and c.id::text = v.value), '') else '' end,
      case when nums.n = 1 then coalesce((select value from site_settings where key = 'roadmap_logo_url'), '')
           when menu.is_vacation then coalesce((select value from site_settings where key = 'vacation_background_url'), '')
           else '' end
    ) order by nums.n)
    from nums left join media on media.n = nums.n left join menu on menu.n = nums.n
  ));

  result := result || comsw_sheet('main', '로딩 중', (
    select jsonb_agg(jsonb_build_array(image_url, coalesce(text, ''), is_active::text,
             coalesce(font_family, ''), coalesce(font_size, ''), coalesce(font_weight, ''))
           order by sort_order nulls last, image_url)
    from loading_items
  ));

  -- 컴수원_전체수업: 주차 행(B–L) + 같은 행 번호에 학과(O,P,Q,R,U)·카테고리(W,X).
  -- 주차가 없는 전체수업 과목은 D가 빈 요약 행 하나를 남긴다.
  result := result || comsw_sheet('main', '컴수원_전체수업', (
    with week as (
      select row_number() over (order by sj.sort_order, sj.name, sj.id, w.sort_order nulls last, w.week_label) n,
             sj.id subject_id, sj.name, sj.duration, sj.dept_curriculum, sj.program, sj.level,
             w.week_label, w.written, w.summary, w.image_url
      from subjects sj
      left join subject_weeks w on w.subject_id = sj.id
      where sj.sort_order is not null
    ), dept as (
      select row_number() over (order by sort_order nulls last, name) n, * from departments
    ), cat as (
      select row_number() over (order by sort_order nulls last, name) n, * from site_categories
    ), nums as (
      select generate_series(1, greatest((select count(*) from week), (select count(*) from dept), (select count(*) from cat), 1)) n
    )
    select jsonb_agg(jsonb_build_array(
      '',
      coalesce((select string_agg(regexp_replace(dd.name, '학과$', ''), ', ' order by dd.sort_order nulls last, dd.name)
                from subject_departments sd join departments dd on dd.id = sd.department_id
                where sd.subject_id = week.subject_id), ''),
      coalesce(week.name, ''), coalesce(week.week_label, ''), coalesce(week.written, ''), coalesce(week.summary, ''),
      coalesce(week.duration, ''), coalesce(week.image_url, ''), '',
      coalesce(week.dept_curriculum, ''), coalesce(week.program, ''), coalesce(week.level, ''),
      '', '',
      coalesce(dept.name, ''), coalesce(dept.image_url, ''), coalesce(dept.is_active::text, ''), coalesce(dept.description, ''),
      '', '', coalesce(dept.name_en, ''), '',
      coalesce(cat.name, ''), coalesce(cat.is_active::text, '')
    ) order by nums.n)
    from nums left join week on week.n = nums.n left join dept on dept.n = nums.n left join cat on cat.n = nums.n
  ));

  -- 로드맵: 묶음마다 3행 (1행 과목명, 2행 원문, 3행 요약). 열 = 1 + 가장 큰 position.
  select coalesce(max(position), 0) into width from roadmap_steps;
  result := result || comsw_sheet('main', '로드맵', (
    select jsonb_agg(line order by t_order, t_name, t_id, kind)
    from (
      select t.sort_order t_order, t.name t_name, t.id t_id, k.kind,
             jsonb_build_array(t.name) || coalesce((
               select jsonb_agg(coalesce(case k.kind
                        when 1 then (select string_agg(sj.name, ', ' order by rs.sort_order nulls last, sj.name)
                                     from roadmap_step_subjects rs join subjects sj on sj.id = rs.subject_id
                                     where rs.step_id = st.id)
                        when 2 then st.source_text
                        else st.summary end, '') order by p)
               from generate_series(1, width) p
               left join roadmap_steps st on st.track_id = t.id and st.position = p), '[]'::jsonb) line
      from roadmap_tracks t cross join (values (1), (2), (3)) k(kind)
    ) x
  ));

  result := result || comsw_sheet('main', '수업별 준비물(AI/교재 등)', (
    select jsonb_agg(jsonb_build_array(sj.name,
             case p.category when 'textbook' then '교재명' when 'supply' then '준비물' else 'AI 툴' end,
             coalesce(p.content, ''), coalesce(p.link_url, ''), coalesce(p.image_url, ''), coalesce(p.extra, ''))
           order by p.sort_order nulls last, p.id)
    from course_prep_items p join subjects sj on sj.id = p.subject_id
  ));

  result := result || comsw_sheet('main', '강사페이지', (
    select jsonb_agg(jsonb_build_array(i.name,
             coalesce((select string_agg(dd.name, ', ' order by dd.sort_order nulls last, dd.name)
                       from instructor_departments x join departments dd on dd.id = x.department_id
                       where x.instructor_id = i.id), ''),
             coalesce((select string_agg(sj.name, ', ' order by x.sort_order nulls last, sj.name)
                       from instructor_subjects x join subjects sj on sj.id = x.subject_id
                       where x.instructor_id = i.id), ''),
             coalesce(i.career, ''), coalesce(i.message, ''), coalesce(i.photo_url, ''), '', coalesce(i.gender, ''))
           order by i.sort_order nulls last, i.name)
    from instructors i where i.is_listed
  ));

  result := result || comsw_sheet('main', '특강 및 세미나', (
    select jsonb_agg(jsonb_build_array(coalesce(poster_url, ''), title, coalesce(subtitle, ''),
             coalesce(datetime_text, ''), coalesce(instructor, ''), coalesce(place, ''),
             coalesce(capacity::text, ''),
             (select count(*) from seminar_applications a where a.seminar_id = sm.id)::text)
           order by sort_order nulls last, title)
    from seminars sm
  ));

  for s in select * from curriculum_sets order by sort_order nulls last, name loop
    result := result || comsw_sheet('instructor_curriculum', s.name, (
      select jsonb_agg(jsonb_build_array(i.name, sj.name, c.step_label, coalesce(c.written, ''), coalesce(c.summary, ''),
               coalesce(c.media_url, ''), coalesce(c.supplies, ''), coalesce(c.supplies_detail, ''), coalesce(c.class_time, ''))
             order by c.sort_order nulls last, c.updated_at)
      from instructor_curricula c
      join instructors i on i.id = c.instructor_id
      join subjects sj on sj.id = c.subject_id
      where c.set_id = s.id and c.status = 'approved'
    ));
  end loop;

  for d in select * from departments where exists (select 1 from recruitment_posts r where r.department_id = departments.id)
           order by sort_order nulls last, name loop
    result := result || comsw_sheet('recruitment', d.name, (
      select jsonb_agg(jsonb_build_array(coalesce(company, ''), coalesce(job_title, ''), coalesce(location, ''),
               coalesce(employment_type, ''), coalesce(requirements, ''), coalesce(duties, ''), coalesce(salary, ''),
               coalesce(how_to_apply, ''), coalesce(deadline, ''), coalesce(contact, ''), coalesce(experience, ''),
               coalesce(notes, ''), coalesce(link_url, ''), coalesce(updated_text, ''))
             order by sort_order nulls last, id)
      from recruitment_posts where department_id = d.id
    ));
  end loop;

  return result;
end $$;

create function public.comsw_publish() returns bigint
language plpgsql security definer set search_path = public as $$
declare
  new_id bigint;
begin
  if public.comsw_role() is distinct from 'admin' and public.comsw_role() is distinct from 'head' then
    raise exception '적용 권한이 없습니다';
  end if;
  insert into site_snapshots(published_by, rows) values (auth.jwt() ->> 'sub', comsw_build_rows()) returning id into new_id;
  return new_id;
end $$;

create function public.comsw_publish_as_owner() returns bigint
language sql security definer set search_path = public as $$
  insert into site_snapshots(published_by, rows) values ('sql-editor', comsw_build_rows()) returning id
$$;

create function public.comsw_site_rows(p_source text, p_sheet text)
returns table (source_id text, sheet_name text, row_number int, data jsonb)
language sql stable security definer set search_path = public as $$
  select e ->> 'source_id', e ->> 'sheet_name', (e ->> 'row_number')::int, e -> 'data'
  from (select rows from site_snapshots order by id desc limit 1) latest,
       jsonb_array_elements(latest.rows) e
  where e ->> 'source_id' = p_source and e ->> 'sheet_name' = p_sheet
  order by 3
$$;

revoke execute on function public.comsw_sheet(text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.comsw_build_rows() from public, anon, authenticated;
revoke execute on function public.comsw_publish_as_owner() from public, anon, authenticated;
revoke execute on function public.comsw_publish() from public, anon;
grant execute on function public.comsw_publish() to authenticated;
revoke execute on function public.comsw_site_rows(text, text) from public;
grant execute on function public.comsw_site_rows(text, text) to anon, authenticated;
