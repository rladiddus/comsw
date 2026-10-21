-- 전체수업 시트 행에 25번째 칸(인덱스 24)을 더한다: 그 과목·주차의 승인된 강사 커리큘럼 이미지 후보(줄바꿈으로 이음).
-- 공개 사이트가 방문마다 이 중 하나를 골라 H(대표 이미지)에 넣는다.
-- 특강 및 세미나 행에는 9번째 칸(인덱스 8) = 특강 id (사이트가 이 id로 신청). 기존 열은 그대로.
alter function public.comsw_build_rows() rename to comsw_build_rows_base;

create function public.comsw_build_rows() returns jsonb
language sql stable security definer set search_path = public as $$
  with cand as (
    select sj.name, c.step_label,
           string_agg(c.media_url, E'\n' order by cs.sort_order nulls last, c.sort_order nulls last, c.id) urls
    from instructor_curricula c
    join subjects sj on sj.id = c.subject_id
    join curriculum_sets cs on cs.id = c.set_id
    where c.status = 'approved' and coalesce(btrim(c.media_url), '') <> ''
    group by sj.name, c.step_label
  )
  select coalesce(jsonb_agg(
    case when r ->> 'sheet_name' = '컴수원_전체수업' then
      jsonb_set(r, '{data,values}', (r #> '{data,values}') || to_jsonb(coalesce(
        (select urls from cand where cand.name = r #>> '{data,values,2}' and cand.step_label = r #>> '{data,values,3}'), '')))
    when r ->> 'sheet_name' = '특강 및 세미나' then
      jsonb_set(r, '{data,values}', (r #> '{data,values}') || to_jsonb(coalesce(
        (select sm.id::text from seminars sm where sm.title = r #>> '{data,values,1}'), '')))
    else r end order by ord), '[]'::jsonb)
  from jsonb_array_elements(comsw_build_rows_base()) with ordinality e(r, ord)
$$;

revoke execute on function public.comsw_build_rows() from public, anon, authenticated;
