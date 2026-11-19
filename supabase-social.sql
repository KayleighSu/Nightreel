-- Nightreel social migration v1.
-- Apply in the Supabase SQL Editor after supabase.sql. Never expose service_role keys.
-- Privacy: anime_entries.notes remains accessible ONLY to its owner under the original RLS.
-- Friend reads use a SECURITY DEFINER RPC selecting public_notes, never notes.

alter table public.anime_entries
  add column if not exists public_notes text not null default '';
alter table public.anime_entries
  drop constraint if exists anime_public_note_length;
alter table public.anime_entries
  add constraint anime_public_note_length check (char_length(public_notes) <= 5000);

-- Friend requests; both sides can see the relationship, only the recipient can accept.
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  check (requester_id <> recipient_id)
);
create unique index if not exists friendships_unique_pair on public.friendships
  (least(requester_id,recipient_id), greatest(requester_id,recipient_id));
create index if not exists friendships_recipient_idx on public.friendships(recipient_id, status);
create index if not exists friendships_requester_idx on public.friendships(requester_id, status);
alter table public.friendships enable row level security;
revoke all on public.friendships from public, anon, authenticated;
grant select, insert, delete on public.friendships to authenticated;
grant update(status) on public.friendships to authenticated;
drop policy if exists "participants can view friendship" on public.friendships;
create policy "participants can view friendship" on public.friendships
  for select to authenticated using ((select auth.uid()) in (requester_id,recipient_id));
drop policy if exists "send friend request" on public.friendships;
create policy "send friend request" on public.friendships
  for insert to authenticated with check (
    requester_id = (select auth.uid()) and recipient_id <> requester_id and status = 'pending'
  );
drop policy if exists "recipient accepts request" on public.friendships;
create policy "recipient accepts request" on public.friendships
  for update to authenticated
  using (recipient_id = (select auth.uid()) and status='pending')
  with check (recipient_id = (select auth.uid()) and status in ('accepted','declined'));
drop policy if exists "participants can remove friendship" on public.friendships;
create policy "participants can remove friendship" on public.friendships
  for delete to authenticated using ((select auth.uid()) in (requester_id,recipient_id));

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z][a-z0-9_]{2,31}$'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  banner_path text check (banner_path is null or length(banner_path) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from public, anon, authenticated;
grant select, insert on public.profiles to authenticated;
grant update(username,display_name,banner_path) on public.profiles to authenticated;
drop policy if exists "self and friends can view profile" on public.profiles;
create policy "self and friends can view profile" on public.profiles
  for select to authenticated using (
    id=(select auth.uid()) OR exists (
      select 1 from public.friendships f
      where f.status='accepted' and (
        (f.requester_id=id and f.recipient_id=(select auth.uid())) or
        (f.recipient_id=id and f.requester_id=(select auth.uid()))
      )
    )
  );
drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles
  for insert to authenticated with check (id=(select auth.uid()) and
    (banner_path is null or banner_path like (select auth.uid())::text || '/%'));
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated using (id=(select auth.uid()))
  with check (id=(select auth.uid()) and
    (banner_path is null or banner_path like (select auth.uid())::text || '/%'));

-- Auto-provision a neutral handle so account registration does not require public email.
create or replace function public.nightreel_create_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,username,display_name)
  values(new.id, 'user_' || substring(replace(new.id::text,'-',''),1,24), 'Anime fan')
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists nightreel_create_profile_on_signup on auth.users;
create trigger nightreel_create_profile_on_signup
  after insert on auth.users for each row execute function public.nightreel_create_profile();
insert into public.profiles (id,username,display_name)
select id, 'user_' || substring(replace(id::text,'-',''),1,24), 'Anime fan'
from auth.users on conflict (id) do nothing;

create or replace function public.nightreel_touch_profile()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at=now();return new; end;
$$;
drop trigger if exists nightreel_profile_updated_at on public.profiles;
create trigger nightreel_profile_updated_at before update on public.profiles
  for each row execute function public.nightreel_touch_profile();

-- Discovery returns ONLY a username, display name and ID. Email remains private.
create or replace function public.search_nightreel_users(p_query text)
returns table(id uuid,username text,display_name text)
language sql stable security definer set search_path='' as $$
  select p.id,p.username,p.display_name from public.profiles p
  where (select auth.uid()) is not null
    and length(trim(p_query)) between 2 and 32
    and p.id <> (select auth.uid())
    and (p.username ilike '%' || replace(replace(trim(p_query),'%','\%'),'_','\_') || '%' escape '\'
      or p.display_name ilike '%' || replace(replace(trim(p_query),'%','\%'),'_','\_') || '%' escape '\')
  order by p.username limit 20;
$$;
revoke all on function public.search_nightreel_users(text) from public,anon;
grant execute on function public.search_nightreel_users(text) to authenticated;

-- Resolve pending + accepted requests without exposing profiles to strangers.
create or replace function public.get_nightreel_connections()
returns table(id uuid,requester_id uuid,recipient_id uuid,status text,username text,display_name text)
language sql stable security definer set search_path='' as $$
  select f.id,f.requester_id,f.recipient_id,f.status,p.username,p.display_name
  from public.friendships f join public.profiles p
  on p.id = case when f.requester_id=(select auth.uid()) then f.recipient_id else f.requester_id end
  where (select auth.uid()) is not null and
    ((f.requester_id=(select auth.uid())) or (f.recipient_id=(select auth.uid())))
  order by f.created_at desc limit 200;
$$;
revoke all on function public.get_nightreel_connections() from public,anon;
grant execute on function public.get_nightreel_connections() to authenticated;

-- Important: deliberately omit anime_entries.notes (private note).
-- The friendship must be ACCEPTED at query time, even if the caller knows a UUID.
create or replace function public.get_friend_anime(p_friend_id uuid)
returns table(
  id uuid, user_id uuid, title text, mal_id integer, mal_url text,
  image_url text, synopsis text, year integer, status text,
  episodes_total integer, episodes_watched integer, rating integer,
  favorite boolean, public_notes text, imdb_id text,
  created_at timestamptz, updated_at timestamptz
)
language sql stable security definer set search_path='' as $$
  select e.id,e.user_id,e.title,e.mal_id,e.mal_url,e.image_url,e.synopsis,
    e.year,e.status,e.episodes_total,e.episodes_watched,e.rating,
    e.favorite,e.public_notes,e.imdb_id,e.created_at,e.updated_at
  from public.anime_entries e
  where (select auth.uid()) is not null
    and p_friend_id <> (select auth.uid())
    and e.user_id = p_friend_id
    and exists (
      select 1 from public.friendships f
      where f.status='accepted'
      and ((f.requester_id=(select auth.uid()) and f.recipient_id=p_friend_id)
        or (f.recipient_id=(select auth.uid()) and f.requester_id=p_friend_id))
    )
  order by e.title asc limit 2000;
$$;
revoke all on function public.get_friend_anime(uuid) from public,anon;
grant execute on function public.get_friend_anime(uuid) to authenticated;

-- Private banner storage. The original anime images remain on GitHub and are public.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('nightreel-banners','nightreel-banners',false,4194304,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=4194304,
  allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "nightreel banner read" on storage.objects;
create policy "nightreel banner read" on storage.objects
  for select to authenticated using (
    bucket_id='nightreel-banners' and (
      name like (select auth.uid())::text || '/%' or
      exists(
        select 1 from public.friendships f
        where f.status='accepted' and (
          (f.requester_id=(select auth.uid()) and name like f.recipient_id::text || '/%') or
          (f.recipient_id=(select auth.uid()) and name like f.requester_id::text || '/%')
        )
      )
    )
  );
drop policy if exists "nightreel banner upload" on storage.objects;
create policy "nightreel banner upload" on storage.objects
  for insert to authenticated with check(
    bucket_id='nightreel-banners' and name like (select auth.uid())::text || '/%'
  );
drop policy if exists "nightreel banner delete" on storage.objects;
create policy "nightreel banner delete" on storage.objects
  for delete to authenticated using(
    bucket_id='nightreel-banners' and name like (select auth.uid())::text || '/%'
  );
-- Upload a fresh filename instead of upserting; no cross-user overwrite policy is needed.
