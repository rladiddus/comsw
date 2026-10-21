-- 권한은 반드시 public.comsw_role()로 판단한다 (로그인 여부만 보는 정책 금지).

do $$
declare
  t text;
begin
  foreach t in array array[
    'departments', 'site_categories', 'subjects', 'subject_departments', 'subject_weeks',
    'instructors', 'instructor_departments', 'instructor_subjects', 'curriculum_sets',
    'instructor_curricula', 'roadmap_tracks', 'roadmap_steps', 'roadmap_step_subjects',
    'course_prep_items', 'seminars', 'seminar_applications', 'recruitment_posts',
    'main_media', 'menus', 'loading_items', 'site_settings'
  ] loop
    -- 프로젝트 기본 권한에 기대지 않고 명시한다. 실제 접근은 아래 RLS가 정한다.
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy staff_all on public.%I for all to authenticated
         using (public.comsw_role() in (''admin'', ''head''))
         with check (public.comsw_role() in (''admin'', ''head''))', t);
  end loop;

  foreach t in array array[
    'departments', 'site_categories', 'subjects', 'subject_departments', 'curriculum_sets', 'instructors'
  ] loop
    execute format(
      'create policy teacher_read on public.%I for select to authenticated
         using (public.comsw_role() = ''teacher'')', t);
  end loop;
end $$;

grant select on public.site_snapshots to authenticated;
alter table public.site_snapshots enable row level security;
create policy staff_read on public.site_snapshots for select to authenticated
  using (public.comsw_role() in ('admin', 'head'));

create function public.comsw_my_instructor_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from public.instructors where account_uid = auth.jwt() ->> 'sub'
$$;

create policy teacher_own_select on public.instructor_curricula for select to authenticated
  using (public.comsw_role() = 'teacher' and instructor_id in (select public.comsw_my_instructor_ids()));
create policy teacher_own_insert on public.instructor_curricula for insert to authenticated
  with check (public.comsw_role() = 'teacher' and status = 'pending'
              and instructor_id in (select public.comsw_my_instructor_ids()));
-- 선생님은 확인 대기(pending) 제출물만 고치고 지운다. 공개된(approved) 내용은 관리자 승인 전까지 그대로 둔다.
create policy teacher_own_update on public.instructor_curricula for update to authenticated
  using (public.comsw_role() = 'teacher' and status = 'pending'
         and instructor_id in (select public.comsw_my_instructor_ids()))
  with check (public.comsw_role() = 'teacher' and status = 'pending'
              and instructor_id in (select public.comsw_my_instructor_ids()));
create policy teacher_own_delete on public.instructor_curricula for delete to authenticated
  using (public.comsw_role() = 'teacher' and status = 'pending'
         and instructor_id in (select public.comsw_my_instructor_ids()));
