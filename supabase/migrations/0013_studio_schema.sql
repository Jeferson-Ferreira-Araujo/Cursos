-- Savia Studio (V2): schema for AI-assisted lesson/course improvements.
-- Nothing here touches or removes V1 tables/data; it only adds new,
-- account-scoped tables that follow the exact same RLS pattern already
-- used everywhere else (is_account_member / has_active_enrollment).

-- Every processed variant of a video. The row created at upload time
-- (kind='original') is never deleted by later processing -- future
-- enhancement jobs (V2.1) will add more rows here and flip which one
-- `is_current` points to, so a Creator can always roll back.
create table public.video_versions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  kind text not null default 'original' check (kind in ('original', 'audio_enhanced', 'video_enhanced', 'trimmed', 'silence_removed')),
  storage_path text not null,
  status text not null default 'ready' check (status in ('processing', 'ready', 'error')),
  is_current boolean not null default false,
  error_message text,
  created_at timestamptz not null default now()
);

create index video_versions_video_id_idx on public.video_versions (video_id);
-- At most one "current" (actively served) version per video.
create unique index video_versions_one_current_idx on public.video_versions (video_id) where is_current;

-- Generic async job queue for every Studio task (transcription, AI text
-- suggestions, cover generation, and later audio/video enhancement).
-- A job always belongs to exactly the video/lesson/course it targets so
-- costs and results can be traced back to a single account.
create table public.video_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  course_id uuid references public.courses (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete cascade,
  video_id uuid references public.videos (id) on delete cascade,
  job_type text not null check (job_type in (
    'transcription', 'title_suggestion', 'description_suggestion',
    'summary_suggestion', 'chapter_suggestion', 'cover_generation'
  )),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  input jsonb not null default '{}',
  output jsonb,
  error_message text,
  attempts integer not null default 0,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index video_processing_jobs_account_idx on public.video_processing_jobs (account_id);
create index video_processing_jobs_lesson_idx on public.video_processing_jobs (lesson_id);
create index video_processing_jobs_course_idx on public.video_processing_jobs (course_id);
create index video_processing_jobs_status_idx on public.video_processing_jobs (status);

-- One transcription per video; regenerating overwrites in place (a new
-- transcription is not a new "version" of the video itself).
create table public.transcriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  language text,
  full_text text,
  segments jsonb not null default '[]',
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'error')),
  error_message text,
  visible_to_students boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (video_id)
);

-- Caption display preference + the rendered subtitle track. Kept separate
-- from `transcriptions` so toggling Topo/Rodapé/Desativada never triggers
-- reprocessing.
create table public.captions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  transcription_id uuid references public.transcriptions (id) on delete set null,
  position text not null default 'off' check (position in ('top', 'bottom', 'optional', 'off')),
  vtt_content text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (video_id)
);

create table public.lesson_chapters (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  start_seconds integer not null,
  title text not null,
  order_index integer not null default 0,
  source text not null default 'manual' check (source in ('ai', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lesson_chapters_lesson_idx on public.lesson_chapters (lesson_id, order_index);

-- AI-generated title/description/summary/key-points, always staged for
-- the Creator to accept/reject/edit -- never applied automatically.
create table public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  target_type text not null check (target_type in ('lesson', 'course')),
  target_id uuid not null,
  suggestion_type text not null check (suggestion_type in ('title', 'description', 'summary', 'key_points')),
  content text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  applied_at timestamptz
);

create index ai_suggestions_target_idx on public.ai_suggestions (target_type, target_id);

-- Candidate cover images (AI-generated or uploaded) for a course. The
-- selected one is mirrored onto courses.cover_path; nothing overwrites
-- that column without the Creator picking a candidate first.
create table public.course_covers (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  storage_path text not null,
  source text not null default 'ai_generated' check (source in ('ai_generated', 'uploaded')),
  prompt text,
  selected boolean not null default false,
  created_at timestamptz not null default now()
);

create index course_covers_course_idx on public.course_covers (course_id);

-- Per-account usage ledger for AI/processing costs. No billing logic yet
-- (see README) -- this just makes future plan/credit limits possible
-- without a schema change.
create table public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  job_id uuid references public.video_processing_jobs (id) on delete set null,
  usage_type text not null check (usage_type in ('transcription_seconds', 'ai_text_generation', 'image_generation')),
  quantity numeric not null default 0,
  created_at timestamptz not null default now()
);

create index ai_usage_events_account_idx on public.ai_usage_events (account_id);

-- A still frame thumbnail per video (generated on-device from the picked
-- file, or uploaded manually) -- separate from course covers.
alter table public.videos add column thumbnail_path text;

alter table public.video_versions enable row level security;
alter table public.video_processing_jobs enable row level security;
alter table public.transcriptions enable row level security;
alter table public.captions enable row level security;
alter table public.lesson_chapters enable row level security;
alter table public.ai_suggestions enable row level security;
alter table public.course_covers enable row level security;
alter table public.ai_usage_events enable row level security;

create trigger transcriptions_set_updated_at before update on public.transcriptions
  for each row execute function public.set_updated_at();
create trigger captions_set_updated_at before update on public.captions
  for each row execute function public.set_updated_at();
create trigger lesson_chapters_set_updated_at before update on public.lesson_chapters
  for each row execute function public.set_updated_at();
create trigger ai_suggestions_set_updated_at before update on public.ai_suggestions
  for each row execute function public.set_updated_at();
create trigger video_processing_jobs_set_updated_at before update on public.video_processing_jobs
  for each row execute function public.set_updated_at();

-- video_versions: Creator manages their own tenant's versions.
create policy video_versions_select on public.video_versions for select
  using (public.is_account_member(account_id));
create policy video_versions_insert on public.video_versions for insert
  with check (public.is_account_member(account_id));
create policy video_versions_update on public.video_versions for update
  using (public.is_account_member(account_id));

-- video_processing_jobs: Creator can create and read their own tenant's
-- jobs. Only the Edge Function (service role, bypasses RLS) updates them.
create policy video_processing_jobs_select on public.video_processing_jobs for select
  using (public.is_account_member(account_id));
create policy video_processing_jobs_insert on public.video_processing_jobs for insert
  with check (public.is_account_member(account_id));

-- transcriptions: Creator has full access. A Student may read the text
-- only when the Creator explicitly turned visible_to_students on, and
-- only for a published course they're enrolled in.
create policy transcriptions_select on public.transcriptions for select
  using (
    public.is_account_member(account_id)
    or (
      visible_to_students
      and exists (
        select 1 from public.lessons l join public.courses c on c.id = l.course_id
        where l.video_id = transcriptions.video_id
          and c.status = 'published'
          and public.has_active_enrollment(l.course_id)
      )
    )
  );
create policy transcriptions_update on public.transcriptions for update
  using (public.is_account_member(account_id));

-- captions: Creator manages; a Student can always read the caption track
-- for a video they're allowed to watch (the `position` value, defaulting
-- to 'off', is what actually hides it in the player).
create policy captions_select on public.captions for select
  using (
    public.is_account_member(account_id)
    or exists (
      select 1 from public.lessons l join public.courses c on c.id = l.course_id
      where l.video_id = captions.video_id
        and c.status = 'published'
        and public.has_active_enrollment(l.course_id)
    )
  );
create policy captions_update on public.captions for update
  using (public.is_account_member(account_id));

-- lesson_chapters: Creator has full CRUD; a Student can read chapters for
-- lessons in a published, enrolled course (navigation aid, not sensitive).
create policy lesson_chapters_select on public.lesson_chapters for select
  using (
    public.is_account_member(account_id)
    or exists (
      select 1 from public.lessons l join public.courses c on c.id = l.course_id
      where l.id = lesson_chapters.lesson_id
        and c.status = 'published'
        and public.has_active_enrollment(l.course_id)
    )
  );
create policy lesson_chapters_insert on public.lesson_chapters for insert
  with check (public.is_account_member(account_id));
create policy lesson_chapters_update on public.lesson_chapters for update
  using (public.is_account_member(account_id));
create policy lesson_chapters_delete on public.lesson_chapters for delete
  using (public.is_account_member(account_id));

-- ai_suggestions: Creator-only (review/accept/reject their own suggestions).
create policy ai_suggestions_select on public.ai_suggestions for select
  using (public.is_account_member(account_id));
create policy ai_suggestions_update on public.ai_suggestions for update
  using (public.is_account_member(account_id));

-- course_covers: Creator-only gallery of candidates for their own courses.
create policy course_covers_select on public.course_covers for select
  using (public.is_account_member(account_id));
create policy course_covers_insert on public.course_covers for insert
  with check (public.is_account_member(account_id));
create policy course_covers_update on public.course_covers for update
  using (public.is_account_member(account_id));
create policy course_covers_delete on public.course_covers for delete
  using (public.is_account_member(account_id));

-- ai_usage_events: Creator can see their own tenant's usage ledger.
create policy ai_usage_events_select on public.ai_usage_events for select
  using (public.is_account_member(account_id));
