-- One row per (lesson, student). Denormalizes account_id/course_id so the
-- RLS checks below stay O(1) and don't need to traverse joins.
create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  student_user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  last_position_seconds integer not null default 0,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (lesson_id, student_user_id)
);

create index lesson_progress_student_idx on public.lesson_progress (student_user_id);
create index lesson_progress_course_idx on public.lesson_progress (course_id, student_user_id);

alter table public.lesson_progress enable row level security;

create trigger lesson_progress_set_updated_at
  before update on public.lesson_progress
  for each row execute function public.set_updated_at();

-- Student: full read/write access to their own progress rows, but only for
-- courses they currently hold an active enrollment for. Creator: read-only
-- visibility into their own students' progress.
create policy lesson_progress_select
  on public.lesson_progress for select
  using (
    student_user_id = auth.uid()
    or public.is_account_member(account_id)
  );

create policy lesson_progress_insert
  on public.lesson_progress for insert
  with check (
    student_user_id = auth.uid()
    and public.has_active_enrollment(course_id)
  );

create policy lesson_progress_update
  on public.lesson_progress for update
  using (
    student_user_id = auth.uid()
    and public.has_active_enrollment(course_id)
  );
