-- V4 방학 특강 공통 4단계(2026-11-19, 사용자 결정 B안): 특강마다 과목 공통 4단계(문구·대표 이미지)를 따로 정리해 홈페이지 방학 특강에 보여 준다.
-- 운영 DB에는 사용자가 직접 실행한다. 20261119050000(v4_site) 다음. 확정 전에는 공개 자료가 그대로다.
-- - 원본: 그 특강에 확정된(검수 완료) 강사 자료만, 대표 이미지도 그 자료의 이미지 중에서만. 일반 수업 공통과 따로(v4_vacation_steps).
-- - 공개: 그 특강 탭(instructor_curriculum 소스, 특강 이름 시트)에서 공통을 확정한 과목은 강사 줄 대신 공통 4줄.
--   강사 이름(A)은 그 과목 강사들, 준비물(H)·수업 시간(I)은 첫 강사 줄 값 그대로. 홈페이지 방학 특강 페이지는 손대지 않는다.

create table public.v4_vacation_steps (
  set_id uuid not null references public.curriculum_sets on delete cascade,
  subject_id uuid not null references public.subjects on delete cascade,
  step int not null check (step between 1 and 4),
  summary text not null,
  image_url text,
  primary key (set_id, subject_id, step)
);
create table public.v4_vacation_meta (
  set_id uuid not null references public.curriculum_sets on delete cascade,
  subject_id uuid not null references public.subjects on delete cascade,
  sources jsonb not null,
  confirmed_at timestamptz not null default now(),
  confirmed_by text,
  primary key (set_id, subject_id)
);
grant select on public.v4_vacation_steps, public.v4_vacation_meta to authenticated;
alter table public.v4_vacation_steps enable row level security;
alter table public.v4_vacation_meta enable row level security;
create policy staff_read on public.v4_vacation_steps for select to authenticated using (public.comsw_role() in ('admin', 'head'));
create policy staff_read on public.v4_vacation_meta for select to authenticated using (public.comsw_role() in ('admin', 'head'));

alter function public.comsw_build_rows() rename to comsw_build_rows_before_v4_vacation;
create function public.comsw_build_rows() returns jsonb
language sql stable security definer set search_path = public as $$
  with src as (
    select r, o from jsonb_array_elements(comsw_build_rows_before_v4_vacation()) with ordinality e(r, o)
  ), common as (
    select cs.name sheet, sj.name subject, vs.step, vs.summary, vs.image_url
    from v4_vacation_steps vs join curriculum_sets cs on cs.id = vs.set_id join subjects sj on sj.id = vs.subject_id
  ), marked as (
    select r, o,
      exists(select 1 from common c where c.sheet = r ->> 'sheet_name' and c.subject = r #>> '{data,values,1}') is_common,
      row_number() over (partition by r ->> 'source_id', r ->> 'sheet_name', r #>> '{data,values,1}' order by o) = 1 first_row
    from src
  ), teachers as (
    select r ->> 'sheet_name' sheet, r #>> '{data,values,1}' subject,
           string_agg(distinct nullif(r #>> '{data,values,0}', ''), ', ') names
    from marked where is_common and r ->> 'source_id' = 'instructor_curriculum' group by 1, 2
  ), out as (
    select r, o, 0 k from marked where not (is_common and r ->> 'source_id' = 'instructor_curriculum')
    union all
    select jsonb_set(m.r, '{data,values}', jsonb_build_array(
             coalesce(t.names, ''), m.r #>> '{data,values,1}', c.step || '단계', '', c.summary, coalesce(c.image_url, ''),
             '', coalesce(m.r #>> '{data,values,7}', ''), coalesce(m.r #>> '{data,values,8}', ''))), m.o, c.step
    from marked m
    join common c on c.sheet = m.r ->> 'sheet_name' and c.subject = m.r #>> '{data,values,1}'
    left join teachers t on t.sheet = m.r ->> 'sheet_name' and t.subject = m.r #>> '{data,values,1}'
    where m.is_common and m.first_row and m.r ->> 'source_id' = 'instructor_curriculum'
  ), numbered as (
    select r, o, k, row_number() over (partition by r ->> 'source_id', r ->> 'sheet_name' order by o, k) + 1 rn from out
  )
  select coalesce(jsonb_agg(
    case when r ->> 'source_id' = 'instructor_curriculum' then jsonb_set(r, '{row_number}', to_jsonb(rn)) else r end
    order by o, k), '[]'::jsonb)
  from numbered
$$;
revoke execute on function public.comsw_build_rows() from public, anon, authenticated;
revoke execute on function public.comsw_build_rows_before_v4_vacation() from public, anon, authenticated;

-- 특강 과목 공통 4단계 확정. p_sources = [{id, updated_at}] 그 특강의 검수 완료 강사 줄, p_steps = [{summary, image_url}] 4개.
create function public.comsw_v4_confirm_vacation_common(p_set uuid, p_subject uuid, p_sources jsonb, p_steps jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform comsw_private.v4_guard();
  if not exists(select 1 from public.vacation_set_subjects v join public.curriculum_sets cs on cs.id = v.set_id
                where v.set_id = p_set and v.subject_id = p_subject and cs.is_vacation) then
    raise exception '이 방학 특강에 없는 과목입니다' using errcode = 'P0001';
  end if;
  if jsonb_array_length(coalesce(p_sources, '[]'::jsonb)) = 0 then raise exception '참고할 강사 자료를 골라주세요' using errcode = 'P0001'; end if;
  if exists(select 1 from jsonb_array_elements(p_sources) x
            where not exists(select 1 from public.instructor_curricula c
                             where c.id = (x->>'id')::uuid and c.subject_id = p_subject and c.set_id = p_set and c.status = 'approved'
                               and c.updated_at = (x->>'updated_at')::timestamptz)) then
    raise exception '고른 강사 자료가 이 특강의 검수 완료본이 아니거나 그사이 바뀌었습니다. 새로 불러온 뒤 다시 해주세요' using errcode = 'P0001';
  end if;
  if jsonb_array_length(coalesce(p_steps, '[]'::jsonb)) <> 4
     or exists(select 1 from jsonb_array_elements(p_steps) x where btrim(coalesce(x->>'summary', '')) = '' or length(x->>'summary') > 2000) then
    raise exception '4단계 문구를 모두 채워주세요' using errcode = 'P0001';
  end if;
  if exists(select 1 from jsonb_array_elements(p_steps) x
            where coalesce(x->>'image_url', '') <> ''
              and not exists(select 1 from public.instructor_curricula c join jsonb_array_elements(p_sources) s on c.id = (s->>'id')::uuid
                             where c.media_url = x->>'image_url')) then
    raise exception '대표 이미지는 고른 강사 자료의 이미지 중에서 골라주세요' using errcode = 'P0001';
  end if;
  delete from public.v4_vacation_steps where set_id = p_set and subject_id = p_subject;
  insert into public.v4_vacation_steps(set_id, subject_id, step, summary, image_url)
    select p_set, p_subject, n, btrim(x->>'summary'), nullif(x->>'image_url', '')
    from jsonb_array_elements(p_steps) with ordinality e(x, n);
  insert into public.v4_vacation_meta(set_id, subject_id, sources, confirmed_by) values (p_set, p_subject, p_sources, auth.jwt() ->> 'sub')
    on conflict (set_id, subject_id) do update set sources = excluded.sources, confirmed_at = now(), confirmed_by = excluded.confirmed_by;
  perform comsw_private.v4_publish();
end $$;

revoke all on function public.comsw_v4_confirm_vacation_common(uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.comsw_v4_confirm_vacation_common(uuid, uuid, jsonb, jsonb) to authenticated;
