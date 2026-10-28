-- Photo wall storage.
-- Private bucket: only signed-in crew phones can see photos (via short-lived signed links).
-- Each player uploads into their own folder: photos/<PLAYER_ID>/<uuid>.jpg (+ <uuid>_t.jpg thumbnail).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "crew can view photos" on storage.objects for select to authenticated
  using (bucket_id = 'photos');

create policy "upload into my own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = public.my_player());

create policy "delete my photos or GM" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and ((storage.foldername(name))[1] = public.my_player() or public.is_gm()));

-- Photo rows: captions max 80 characters
alter table public.photos add constraint photos_caption_len check (caption is null or char_length(caption) <= 80);
