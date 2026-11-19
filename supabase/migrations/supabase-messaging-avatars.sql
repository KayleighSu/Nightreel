-- Nightreel direct messages and friend-visible profile pictures
-- Messaging is limited to mutually accepted friendships.
alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles drop constraint if exists profiles_avatar_path_check;
alter table public.profiles add constraint profiles_avatar_path_check check (avatar_path is null or length(avatar_path) <= 200);
grant update(avatar_path) on public.profiles to authenticated;
drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles for insert to authenticated
  with check (id=(select auth.uid())
    and (banner_path is null or banner_path like (select auth.uid())::text || '/%')
    and (avatar_path is null or avatar_path like (select auth.uid())::text || '/%'));
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update to authenticated
  using (id=(select auth.uid()))
  with check (id=(select auth.uid())
    and (banner_path is null or banner_path like (select auth.uid())::text || '/%')
    and (avatar_path is null or avatar_path like (select auth.uid())::text || '/%'));

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);
create index if not exists direct_messages_sender_time_idx on public.direct_messages(sender_id, created_at desc);
create index if not exists direct_messages_recipient_time_idx on public.direct_messages(recipient_id, created_at desc);
alter table public.direct_messages enable row level security;
revoke all on public.direct_messages from anon, public, authenticated;
grant select,insert on public.direct_messages to authenticated;
drop policy if exists "participants read accepted friend messages" on public.direct_messages;
create policy "participants read accepted friend messages" on public.direct_messages
 for select to authenticated using (
  ((select auth.uid()) in (sender_id, recipient_id))
  and exists (select 1 from public.friendships f where f.status='accepted'
     and ((f.requester_id=sender_id and f.recipient_id=recipient_id)
       or (f.recipient_id=sender_id and f.requester_id=recipient_id)))
 );
drop policy if exists "accepted friends send messages" on public.direct_messages;
create policy "accepted friends send messages" on public.direct_messages
 for insert to authenticated with check (
  sender_id=(select auth.uid()) and recipient_id <> sender_id
  and exists (select 1 from public.friendships f where f.status='accepted'
    and ((f.requester_id=sender_id and f.recipient_id=recipient_id)
       or (f.recipient_id=sender_id and f.requester_id=recipient_id)))
 );

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('nightreel-avatars','nightreel-avatars',false,2097152,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
 set public=false,file_size_limit=2097152,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists "nightreel avatar read" on storage.objects;
create policy "nightreel avatar read" on storage.objects
 for select to authenticated using (
  bucket_id='nightreel-avatars' and
  (name like (select auth.uid())::text || '/%' or exists (
    select 1 from public.friendships f where f.status='accepted' and (
      (f.requester_id=(select auth.uid()) and name like f.recipient_id::text || '/%')
      or (f.recipient_id=(select auth.uid()) and name like f.requester_id::text || '/%')
    )
  ))
 );
drop policy if exists "nightreel avatar upload" on storage.objects;
create policy "nightreel avatar upload" on storage.objects
 for insert to authenticated with check (
  bucket_id='nightreel-avatars' and name like (select auth.uid())::text || '/%'
 );
drop policy if exists "nightreel avatar delete" on storage.objects;
create policy "nightreel avatar delete" on storage.objects
 for delete to authenticated using (
  bucket_id='nightreel-avatars' and name like (select auth.uid())::text || '/%'
 );
