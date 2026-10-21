-- 컴수원 관리 플랫폼 콘텐츠 테이블. 시트 ↔ 테이블 대응은 2단계 계획 문서 참조.

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  name_en text,
  description text,
  image_url text,
  drive_folder_id text,
  is_active boolean not null default true,
  sort_order int
);

create table public.site_categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  is_active boolean not null default true,
  sort_order int
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  duration text,
  dept_curriculum text,
  program text,
  level text,
  sort_order int
);

create table public.subject_departments (
  subject_id uuid not null references public.subjects on delete cascade,
  department_id uuid not null references public.departments on delete cascade,
  primary key (subject_id, department_id)
);

create table public.subject_weeks (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects on delete cascade,
  week_label text not null,
  written text,
  summary text,
  image_url text,
  sort_order int
);

create table public.instructors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gender text,
  career text,
  message text,
  photo_url text,
  account_uid text unique,
  is_listed boolean not null default true,
  sort_order int
);

create table public.instructor_departments (
  instructor_id uuid not null references public.instructors on delete cascade,
  department_id uuid not null references public.departments on delete cascade,
  primary key (instructor_id, department_id)
);

create table public.instructor_subjects (
  instructor_id uuid not null references public.instructors on delete cascade,
  subject_id uuid not null references public.subjects on delete cascade,
  sort_order int,
  primary key (instructor_id, subject_id)
);

create table public.curriculum_sets (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  department_id uuid references public.departments on delete set null,
  sort_order int
);

create table public.instructor_curricula (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.curriculum_sets on delete cascade,
  instructor_id uuid not null references public.instructors on delete cascade,
  subject_id uuid not null references public.subjects on delete cascade,
  step_label text not null,
  written text,
  summary text,
  media_url text,
  supplies text,
  supplies_detail text,
  class_time text,
  status text not null default 'pending' check (status in ('approved', 'pending')),
  sort_order int,
  updated_at timestamptz not null default now()
);

create table public.roadmap_tracks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  department_id uuid references public.departments on delete set null,
  sort_order int
);

create table public.roadmap_steps (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.roadmap_tracks on delete cascade,
  position int not null check (position >= 1),
  source_text text,
  summary text,
  unique (track_id, position)
);

create table public.roadmap_step_subjects (
  step_id uuid not null references public.roadmap_steps on delete cascade,
  subject_id uuid not null references public.subjects on delete cascade,
  sort_order int,
  primary key (step_id, subject_id)
);

create table public.course_prep_items (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects on delete cascade,
  category text not null check (category in ('textbook', 'supply', 'ai')),
  content text,
  link_url text,
  image_url text,
  extra text,
  sort_order int
);

create table public.seminars (
  id uuid primary key default gen_random_uuid(),
  title text unique not null,
  subtitle text,
  datetime_text text,
  instructor text,
  place text,
  capacity int,
  poster_url text,
  sort_order int
);

create table public.seminar_applications (
  id uuid primary key default gen_random_uuid(),
  seminar_id uuid not null references public.seminars on delete cascade,
  name text not null,
  phone text not null,
  created_at timestamptz not null default now(),
  unique (seminar_id, name, phone)
);

create table public.recruitment_posts (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments on delete cascade,
  company text,
  job_title text,
  location text,
  employment_type text,
  requirements text,
  duties text,
  salary text,
  how_to_apply text,
  deadline text,
  contact text,
  experience text,
  notes text,
  link_url text,
  updated_text text,
  sort_order int
);

create table public.main_media (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  caption text,
  is_active boolean not null default true,
  sort_order int
);

create table public.menus (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  is_active boolean not null default true,
  side text not null default 'right' check (side in ('left', 'right')),
  sort_order int
);

create table public.loading_items (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  text text,
  is_active boolean not null default true,
  font_family text,
  font_size text,
  font_weight text,
  sort_order int
);

create table public.site_settings (
  key text primary key,
  value text
);

create table public.site_snapshots (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  published_by text,
  rows jsonb not null
);
