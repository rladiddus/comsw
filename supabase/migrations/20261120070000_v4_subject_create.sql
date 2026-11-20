-- V4 과목 생성(2026-11-20 사용자 결정): '학과·과목'에서 만들면 일반 과목, '방학 특강'에서 만들면 방학 특강 과목(is_vacation).
-- 이름이 같아도 만든 곳이 다르면 다른 과목 → 이름은 같은 종류 안에서만 겹치지 않게(일반끼리, 방학 특강끼리).
-- 방학 특강 과목은 '학과 커리큘럼'(컴수원_전체수업)에 넣지 않는다(sort_order 없음) — 같은 이름 일반 과목과 섞이지 않게.
-- 공통 준비물(기준 과목 묶음)은 일반 과목끼리만. 운영 DB에는 사용자가 직접 실행한다. 20261120060000 다음.
do $$
declare c text;
begin
  -- 이름만으로 겹치지 않게 하던 규칙(보통 subjects_name_key)을 이름을 몰라도 찾아서 지운다
  for c in select conname from pg_constraint
           where conrelid = 'public.subjects'::regclass and contype = 'u'
             and pg_get_constraintdef(oid) = 'UNIQUE (name)' loop
    execute format('alter table public.subjects drop constraint %I', c);
  end loop;
end $$;
alter table public.subjects add constraint subjects_name_kind_key unique (name, is_vacation);

create function public.comsw_v4_create_subject(p_name text, p_vacation boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare n text := btrim(coalesce(p_name, '')); v boolean := coalesce(p_vacation, false); id uuid;
begin
  perform comsw_private.v4_guard();
  if length(n) not between 1 and 60 then raise exception '과목 이름을 확인해주세요(1~60자)' using errcode = 'P0001'; end if;
  if exists(select 1 from public.subjects where name = n and is_vacation = v) then
    raise exception '같은 이름의 % 과목이 이미 있습니다(삭제된 과목에 있으면 복원해주세요)', case when v then '방학 특강' else '일반' end using errcode = 'P0001';
  end if;
  insert into public.subjects(name, is_vacation, sort_order)
    values (n, v, case when v then null else (select coalesce(max(sort_order), -1) + 1 from public.subjects where not is_vacation) end)
    returning subjects.id into id;
  perform comsw_private.v4_publish();
  return id;
end $$;
revoke all on function public.comsw_v4_create_subject(text, boolean) from public, anon;
grant execute on function public.comsw_v4_create_subject(text, boolean) to authenticated;

-- 공통 준비물 확정: 기준 과목 묶음은 일반 과목끼리만(같은 이름 방학 특강 과목은 건드리지 않음)
create or replace function public.comsw_v4_confirm_prep(p_base text, p_items jsonb)
returns int language plpgsql security definer set search_path = '' as $$
declare members uuid[];
begin
  perform comsw_private.v4_guard();
  select array_agg(id) into members from public.subjects
    where deleted_at is null and not is_vacation and comsw_private.v4_base(name) = btrim(coalesce(p_base, ''));
  if members is null then raise exception '과목이 없습니다' using errcode = 'P0001'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) x
            where coalesce(x->>'category', '') not in ('textbook', 'supply', 'ai')
               or btrim(coalesce(x->>'content', '')) = '' or length(x->>'content') > 500
               or (coalesce(x->>'link_url', '') <> '' and (x->>'link_url' !~* '^https?://' or length(x->>'link_url') > 2000))) then
    raise exception '준비물 칸(분류·내용·링크는 http(s))을 확인해주세요' using errcode = 'P0001';
  end if;
  delete from public.course_prep_items where subject_id = any(members);
  insert into public.course_prep_items(subject_id, category, content, link_url, department_id, sort_order)
    select m, x->>'category', btrim(x->>'content'), nullif(x->>'link_url', ''), nullif(x->>'department_id', '')::uuid, n
    from unnest(members) m cross join jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality e(x, n);
  perform comsw_private.v4_publish();
  return array_length(members, 1);
end $$;
