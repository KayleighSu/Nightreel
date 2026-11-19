-- Anime covers are shareable artwork, not private profile photos.
-- Uploaded files are publicly readable; only the owning account may create/remove them.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values ('nightreel-covers','nightreel-covers',true,4194304,
   array['image/jpeg','image/png','image/webp'])
 on conflict(id) do update
 set public=true,file_size_limit=4194304,
     allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "Nightreel cover uploads by owner" on storage.objects;
create policy "Nightreel cover uploads by owner" on storage.objects
 for insert to authenticated with check (
   bucket_id='nightreel-covers' and
   (storage.foldername(name))[1]=(select auth.uid())::text
 );
drop policy if exists "Nightreel cover removal by owner" on storage.objects;
create policy "Nightreel cover removal by owner" on storage.objects
 for delete to authenticated using (
   bucket_id='nightreel-covers' and
   (storage.foldername(name))[1]=(select auth.uid())::text
 );
drop policy if exists "Nightreel cover updates by owner" on storage.objects;
-- No upserts/overwrites; new images receive unique filenames.
