-- Two buckets:
--   lesson-videos  (private) -- path: {account_id}/{course_id}/{video_id}/{filename}
--   course-covers  (public read) -- path: {account_id}/{course_id}/{filename}
-- Object paths always start with the account_id, which is how every write
-- policy below scopes access to the tenant that owns the folder.
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('lesson-videos', 'lesson-videos', false, 2147483648),
  ('course-covers', 'course-covers', true, 10485760)
on conflict (id) do nothing;

-- lesson-videos: Creator can read/write/delete anything inside their own
-- account_id folder. A Student can only read a video object once it is
-- attached to a lesson in a published, actively-enrolled course.
create policy lesson_videos_creator_all
  on storage.objects for all
  using (
    bucket_id = 'lesson-videos'
    and public.is_account_member(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'lesson-videos'
    and public.is_account_member(((storage.foldername(name))[1])::uuid)
  );

create policy lesson_videos_student_read
  on storage.objects for select
  using (
    bucket_id = 'lesson-videos'
    and exists (
      select 1
      from public.videos v
      join public.lessons l on l.video_id = v.id
      join public.courses c on c.id = l.course_id
      where v.id = ((storage.foldername(name))[3])::uuid
        and c.status = 'published'
        and public.has_active_enrollment(c.id)
    )
  );

-- course-covers: Creator manages their own tenant's cover images. Reads are
-- public (bucket is public) since cover art is not sensitive.
create policy course_covers_creator_write
  on storage.objects for all
  using (
    bucket_id = 'course-covers'
    and public.is_account_member(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'course-covers'
    and public.is_account_member(((storage.foldername(name))[1])::uuid)
  );

create policy course_covers_public_read
  on storage.objects for select
  using (bucket_id = 'course-covers');
