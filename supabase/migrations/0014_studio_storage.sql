-- lesson-thumbnails: public read (a still frame is not sensitive on its
-- own), Creator-scoped write, same path convention as course-covers:
-- {account_id}/{video_id}.{ext}
insert into storage.buckets (id, name, public, file_size_limit)
values ('lesson-thumbnails', 'lesson-thumbnails', true, 5242880)
on conflict (id) do nothing;

create policy lesson_thumbnails_creator_write
  on storage.objects for all
  using (
    bucket_id = 'lesson-thumbnails'
    and public.is_account_member(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'lesson-thumbnails'
    and public.is_account_member(((storage.foldername(name))[1])::uuid)
  );

create policy lesson_thumbnails_public_read
  on storage.objects for select
  using (bucket_id = 'lesson-thumbnails');
