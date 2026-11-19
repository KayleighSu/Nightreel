-- Watch links and catalogue runtimes are non-personal metadata.
alter table public.anime_entries
  add column if not exists catalog_duration_minutes integer
    check (catalog_duration_minutes is null or catalog_duration_minutes between 1 and 600),
  add column if not exists catalog_streaming jsonb not null default '[]'::jsonb
    check (jsonb_typeof(catalog_streaming)='array' and pg_column_size(catalog_streaming) < 8192),
  add column if not exists episode_minutes_manual boolean not null default false;
-- Existing manually changed durations cannot be silently overwritten.
update public.anime_entries set episode_minutes_manual=true where episode_minutes <> 24;
grant update(catalog_duration_minutes,catalog_streaming,episode_minutes_manual)
 on public.anime_entries to authenticated;

-- An automatic lookup must not change the most recently user-edited artwork.
-- A manual duration override is a user edit.
create or replace function public.nightreel_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not new.favorite then new.favorite_rank := null; end if;
  if row(old.title,old.mal_url,old.image_url,old.year,old.status,
         old.episodes_total,old.episodes_watched,old.rating,old.favorite,
         old.notes,old.public_notes,old.imdb_id,old.is_movie,
         old.movie_runtime_minutes,old.episode_minutes_manual,
         case when old.episode_minutes_manual then old.episode_minutes else null end)
     is distinct from
     row(new.title,new.mal_url,new.image_url,new.year,new.status,
         new.episodes_total,new.episodes_watched,new.rating,new.favorite,
         new.notes,new.public_notes,new.imdb_id,new.is_movie,
         new.movie_runtime_minutes,new.episode_minutes_manual,
         case when new.episode_minutes_manual then new.episode_minutes else null end) then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;

-- Read-only friend profiles may show public stream links and watched hours,
-- but not private notes or data from non-friends.
create or replace function public.get_friend_anime_v6(p_friend_id uuid)
returns table(
  id uuid,user_id uuid,title text,mal_id integer,mal_url text,
  image_url text,synopsis text,year integer,status text,
  episodes_total integer,episodes_watched integer,rating integer,
  favorite boolean,public_notes text,imdb_id text,
  created_at timestamptz,updated_at timestamptz,is_movie boolean,
  movie_runtime_minutes integer,favorite_rank integer,episode_minutes integer,
  catalog_streaming jsonb,catalog_duration_minutes integer
)
language sql stable security definer set search_path = '' as $$
  select e.id,e.user_id,e.title,e.mal_id,e.mal_url,e.image_url,e.synopsis,
         e.year,e.status,e.episodes_total,e.episodes_watched,e.rating,
         e.favorite,e.public_notes,e.imdb_id,e.created_at,e.updated_at,
         e.is_movie,e.movie_runtime_minutes,e.favorite_rank,e.episode_minutes,
         e.catalog_streaming,e.catalog_duration_minutes
  from public.anime_entries e
  where (select auth.uid()) is not null
    and p_friend_id <> (select auth.uid())
    and e.user_id=p_friend_id
    and exists(
      select 1 from public.friendships f where f.status='accepted'
        and ((f.requester_id=(select auth.uid()) and f.recipient_id=p_friend_id)
          or (f.recipient_id=(select auth.uid()) and f.requester_id=p_friend_id))
    )
  order by e.title asc limit 2000;
$$;
revoke all on function public.get_friend_anime_v6(uuid) from public,anon;
grant execute on function public.get_friend_anime_v6(uuid) to authenticated;
