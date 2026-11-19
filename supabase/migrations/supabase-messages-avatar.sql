-- Nightreel: direct messages between accepted friends + private profile pictures.
-- Public usernames, anime lists, and original artwork are left unchanged.
create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null check(char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  check(sender_id <> recipient_id)
);
create index if not exists dm_sender_recipient_created_idx on public.direct_messages(sender_id,recipient_id,created_at desc);
create index if not exists dm_recipient_sender_created_idx on public.direct_messages(recipient_id,sender_id,created_at desc);
alter table public.direct_messages enable row level security;
revoke all on public.direct_messages from public,anon,authenticated;
grant select on public.direct_messages to authenticated;
grant insert(recipient_id,body) on public.direct_messages to authenticated;

drop policy if exists "friend participants can read messages" on public.direct_messages;
create policy "friend participants can read messages"
 on public.direct_messages for select to authenticated
 using (
 (select auth.uid()) in (sender_id,recipient_id) and
 exists(
   select 1 from public.friendships f
   where f.status='accepted' and (
     (f.requester_id=sender_id and f.recipient_id=recipient_id) or
     (f.requester_id=recipient_id and f.recipient_id=sender_id)
   )
 )
);
drop policy if exists "friends can send messages" on public.direct_messages;
create policy "friends can send messages" on public.direct_messages
 for insert to authenticated with check (
   sender_id=(select auth.uid()) and
   exists (
     select 1 from public.friendships f
     where f.status='accepted' and (
       (f.requester_id=sender_id and f.recipient_id=recipient_id) or
       (f.requester_id=recipient_id and f.recipient_id=sender_id)
     )
   )
 );
alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles drop constraint if exists profiles_avatar_path_check;
alter table public.profiles add constraint profiles_avatar_path_check
 check (avatar_path is null or (length(avatar_path) <= 200 and avatar_path like id::text || '/%'));
grant update(avatar_path) on public.profiles to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values ('nightreel-avatars','nightreel-avatars',false,2097152,array['image/jpeg','image/png','image/webp'])
 on conflict(id) do update set public=false,file_size_limit=2097152,
 allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "nightreel avatar read" on storage.objects;
create policy "nightreel avatar read" on storage.objects
 for select to authenticated
 using(bucket_id='nightreel-avatars' and (
    name like (select auth.uid())::text || '/%' or
    exists(
      select 1 from public.friendships f
      where f.status='accepted' and (
        (f.requester_id=(select auth.uid()) and name like f.recipient_id::text || '/%') or
        (f.recipient_id=(select auth.uid()) and name like f.requester_id::text || '/%')
      )
    )
 ));
drop policy if exists "nightreel avatar write" on storage.objects;
create policy "nightreel avatar write" on storage.objects
 for insert to authenticated
 with check(bucket_id='nightreel-avatars' and name like (select auth.uid())::text || '/%');
drop policy if exists "nightreel avatar remove" on storage.objects;
create policy "nightreel avatar remove" on storage.objects
 for delete to authenticated
 using(bucket_id='nightreel-avatars' and name like (select auth.uid())::text || '/%');
