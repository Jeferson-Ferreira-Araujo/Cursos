-- Courses table only, without RLS policies yet: `has_active_enrollment`
-- (needed by the read policy) is defined once enrollments/invitations exist
-- in the next migration.
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  title text not null,
  description text not null default '',
  cover_path text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index courses_account_id_idx on public.courses (account_id);

alter table public.courses enable row level security;

create trigger courses_set_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at();
