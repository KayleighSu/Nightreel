-- User-maintained streaming provider suggestions for each title.
-- Catalogue links remain separate and can refresh independently.
alter table public.anime_entries
  add column if not exists personal_streaming jsonb not null default '[]'::jsonb
  check (jsonb_typeof(personal_streaming)='array' and pg_column_size(personal_streaming)<=8192);
grant update(personal_streaming) on public.anime_entries to authenticated;

-- Persistent per-account read markers and sound preferences for in-app notifications.
create table if not exists public.nightreel_notification_preferences(
 user_id uuid primary key references auth.users(id) on delete cascade,
 last_message_seen_at timestamptz not null default '1970-01-01T00:00:00Z',
 last_request_seen_at timestamptz not null default '1970-01-01T00:00:00Z',
 last_acceptance_seen_at timestamptz not null default '1970-01-01T00:00:00Z',
 sounds_enabled boolean not null default true
);
alter table public.nightreel_notification_preferences enable row level security;
drop policy if exists "read own notification settings" on public.nightreel_notification_preferences;
create policy "read own notification settings" on public.nightreel_notification_preferences
 for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists "insert own notification settings" on public.nightreel_notification_preferences;
create policy "insert own notification settings" on public.nightreel_notification_preferences
 for insert to authenticated with check (user_id=(select auth.uid()));
drop policy if exists "update own notification settings" on public.nightreel_notification_preferences;
create policy "update own notification settings" on public.nightreel_notification_preferences
 for update to authenticated using (user_id=(select auth.uid()))
 with check (user_id=(select auth.uid()));
grant select,insert,update on public.nightreel_notification_preferences to authenticated;

-- Track request acceptances without making the friendship itself publicly readable.
alter table public.friendships add column if not exists accepted_at timestamptz;
create or replace function public.nightreel_track_acceptance()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.status='accepted' and old.status is distinct from 'accepted'
 then new.accepted_at=now(); end if;
 return new;
end;
$$;
drop trigger if exists nightreel_friendship_accepted_at on public.friendships;
create trigger nightreel_friendship_accepted_at before update on public.friendships
 for each row execute function public.nightreel_track_acceptance();

-- Accepted friends can see the account owner's streaming notes, but never private notes.
create or replace function public.get_friend_anime_v7(p_friend_id uuid)
returns table(
  id uuid,user_id uuid,title text,mal_id integer,mal_url text,
  image_url text,synopsis text,year integer,status text,
  episodes_total integer,episodes_watched integer,rating integer,
  favorite boolean,public_notes text,imdb_id text,
  created_at timestamptz,updated_at timestamptz,is_movie boolean,
  movie_runtime_minutes integer,favorite_rank integer,episode_minutes integer,
  catalog_streaming jsonb,catalog_duration_minutes integer,personal_streaming jsonb
)
language sql stable security definer set search_path='' as $$
 select e.id,e.user_id,e.title,e.mal_id,e.mal_url,e.image_url,e.synopsis,
  e.year,e.status,e.episodes_total,e.episodes_watched,e.rating,
  e.favorite,e.public_notes,e.imdb_id,e.created_at,e.updated_at,
  e.is_movie,e.movie_runtime_minutes,e.favorite_rank,e.episode_minutes,
  e.catalog_streaming,e.catalog_duration_minutes,e.personal_streaming
 from public.anime_entries e
 where (select auth.uid()) is not null and p_friend_id<>(select auth.uid())
  and e.user_id=p_friend_id
  and exists(
   select 1 from public.friendships f
   where f.status='accepted'
   and ((f.requester_id=(select auth.uid()) and f.recipient_id=p_friend_id)
     or(f.recipient_id=(select auth.uid()) and f.requester_id=p_friend_id))
  )
 order by e.title asc limit 2000;
$$;
revoke all on function public.get_friend_anime_v7(uuid) from public,anon;
grant execute on function public.get_friend_anime_v7(uuid) to authenticated;
