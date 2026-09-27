-- Videos: provider-agnostic metadata row. `provider`/`provider_ref` let the
-- storage/streaming backend be swapped later without touching the domain
-- model, the RLS rules, or the app screens.
create table public.videos (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  provider text not null default 'supabase_storage',
  storage_path text not null,
  original_filename text not null,
  mime_type text,
  size_bytes bigint,
  duration_seconds integer,
  status text not null default 'uploading' check (status in ('uploading', 'processing', 'ready', 'error')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index videos_account_id_idx on public.videos (account_id);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  video_id uuid references public.videos (id) on delete set null,
  title text not null,
  description text not null default '',
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lessons_course_id_order_idx on public.lessons (course_id, order_index);

alter table public.videos enable row level security;
alter table public.lessons enable row level security;

create trigger videos_set_updated_at before update on public.videos
  for each row execute function public.set_updated_at();
create trigger lessons_set_updated_at before update on public.lessons
  for each row execute function public.set_updated_at();

-- Videos: Creator manages their own tenant's videos. A Student may only read
-- the metadata row of a video attached to a lesson inside a published course
-- they are enrolled in (needed to know what to request a signed URL for).
create policy videos_select
  on public.videos for select
  using (
    public.is_account_member(account_id)
    or exists (
      select 1
      from public.lessons l
      join public.courses c on c.id = l.course_id
      where l.video_id = videos.id
        and c.status = 'published'
        and public.has_active_enrollment(l.course_id)
    )
  );

create policy videos_insert
  on public.videos for insert
  with check (public.is_account_member(account_id));

create policy videos_update
  on public.videos for update
  using (public.is_account_member(account_id));

create policy videos_delete
  on public.videos for delete
  using (public.is_account_member(account_id));

-- Lessons: same shape as courses (Creator: full access on own tenant;
-- Student: read-only, only inside a published + enrolled course).
create policy lessons_select
  on public.lessons for select
  using (
    public.is_account_member(account_id)
    or (
      public.has_active_enrollment(course_id)
      and exists (select 1 from public.courses c where c.id = lessons.course_id and c.status = 'published')
    )
  );

create policy lessons_insert
  on public.lessons for insert
  with check (public.is_account_member(account_id));

create policy lessons_update
  on public.lessons for update
  using (public.is_account_member(account_id));

create policy lessons_delete
  on public.lessons for delete
  using (public.is_account_member(account_id));
