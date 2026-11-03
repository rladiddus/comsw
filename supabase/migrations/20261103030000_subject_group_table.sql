-- V3 과목 그룹(2026-11-03, 사용자와 합의). 운영 DB에는 사용자가 직접 실행한다(20261103020000 다음에).
-- 대표 과목(subjects.parent_id, 과목 한 줄이 대표)을 '그룹'(과목이 아닌 이름만 있는 묶음)으로 바꾼다.
-- 그룹은 관리 화면 정리용: 과목 목록·커리큘럼·공개 사이트에 나오지 않고, 그룹 이름은 과목 이름과 겹쳐도 된다.
-- 이미 묶은 대표 과목이 있으면 같은 이름의 그룹을 만들고 대표 과목과 하위 과목을 모두 그 그룹에 넣는다(대표 과목도 과목으로 남음).
create table public.subject_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.subject_groups to authenticated;
alter table public.subject_groups enable row level security;
create policy staff_all on public.subject_groups for all to authenticated
  using (public.comsw_role() in ('admin', 'head'))
  with check (public.comsw_role() in ('admin', 'head'));

-- 그룹을 지우면 과목은 남고 그룹 연결만 풀린다.
alter table public.subjects add column group_id uuid references public.subject_groups on delete set null;

insert into public.subject_groups(name)
  select distinct p.name from public.subjects p where exists(select 1 from public.subjects c where c.parent_id = p.id);
update public.subjects s set group_id = g.id
  from public.subjects p join public.subject_groups g on g.name = p.name
  where s.parent_id = p.id or (s.id = p.id and exists(select 1 from public.subjects c where c.parent_id = p.id));

drop trigger subjects_parent_one_level on public.subjects;
drop function comsw_private.check_subject_parent();
alter table public.subjects drop constraint subjects_parent_not_self;
alter table public.subjects drop column parent_id;
