-- Invitations are the Creator's student roster for a tenant: one row per
-- (account, email). `user_id` starts null and gets linked automatically
-- either immediately (if that email already has an account) or the moment
-- they sign up (see the auth trigger in a later migration).
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  user_id uuid references auth.users (id) on delete set null,
  invited_by uuid references auth.users (id),
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (account_id, email)
);

create index invitations_user_id_idx on public.invitations (user_id);
create index invitations_account_id_idx on public.invitations (account_id);

-- Enrollments grant a specific student (via their invitation) access to a
-- specific course. Revoking access is a status flip, never a delete, so
-- history/progress is preserved.
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'revoked')),
  granted_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (course_id, invitation_id)
);

create index enrollments_account_id_idx on public.enrollments (account_id);
create index enrollments_invitation_id_idx on public.enrollments (invitation_id);

alter table public.invitations enable row level security;
alter table public.enrollments enable row level security;

-- Security-definer helper: does the calling student have active access to
-- this course? Used by every student-facing policy across the schema.
create function public.has_active_enrollment(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.enrollments e
    join public.invitations i on i.id = e.invitation_id
    where e.course_id = target_course_id
      and e.status = 'active'
      and i.user_id = auth.uid()
  );
$$;

-- Courses policies (deferred from 0003 until has_active_enrollment existed).
create policy courses_select
  on public.courses for select
  using (
    public.is_account_member(account_id)
    or (status = 'published' and public.has_active_enrollment(id))
  );

create policy courses_insert
  on public.courses for insert
  with check (public.is_account_member(account_id));

create policy courses_update
  on public.courses for update
  using (public.is_account_member(account_id));

create policy courses_delete
  on public.courses for delete
  using (public.is_account_member(account_id));

-- Invitations: Creator manages their own roster; a Student can see the
-- invitation row that links to their own user_id (read-only).
create policy invitations_select
  on public.invitations for select
  using (public.is_account_member(account_id) or user_id = auth.uid());

create policy invitations_insert
  on public.invitations for insert
  with check (public.is_account_member(account_id));

create policy invitations_update
  on public.invitations for update
  using (public.is_account_member(account_id));

create policy invitations_delete
  on public.invitations for delete
  using (public.is_account_member(account_id));

-- Enrollments: Creator manages access grants; a Student can read only their
-- own enrollment rows (to know which courses they can open).
create policy enrollments_select
  on public.enrollments for select
  using (
    public.is_account_member(account_id)
    or exists (
      select 1 from public.invitations i
      where i.id = enrollments.invitation_id and i.user_id = auth.uid()
    )
  );

create policy enrollments_insert
  on public.enrollments for insert
  with check (public.is_account_member(account_id));

create policy enrollments_update
  on public.enrollments for update
  using (public.is_account_member(account_id));

create policy enrollments_delete
  on public.enrollments for delete
  using (public.is_account_member(account_id));
