-- Movies can optionally record a real runtime, used only for the watch-time estimate.
-- Existing titles, status, favorites and watched counts are unaffected.
alter table public.anime_entries
 add column if not exists movie_runtime_minutes integer
 check (movie_runtime_minutes is null or movie_runtime_minutes between 1 and 1200);
grant update(movie_runtime_minutes) on public.anime_entries to authenticated;

create or replace function public.nightreel_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  if row(old.title,old.mal_url,old.image_url,old.year,old.status,
         old.episodes_total,old.episodes_watched,old.rating,old.favorite,
         old.notes,old.public_notes,old.imdb_id,old.is_movie,old.movie_runtime_minutes)
     is distinct from
     row(new.title,new.mal_url,new.image_url,new.year,new.status,
         new.episodes_total,new.episodes_watched,new.rating,new.favorite,
         new.notes,new.public_notes,new.imdb_id,new.is_movie,new.movie_runtime_minutes) then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;

-- Friend-safe read model includes the movie flag and optional runtime,
-- never the owner's private notes. Exact accepted friendship checked in SQL.
create or replace function public.get_friend_anime_v3(p_friend_id uuid)
returns table(
  id uuid, user_id uuid, title text, mal_id integer, mal_url text,
  image_url text, synopsis text, year integer, status text,
  episodes_total integer, episodes_watched integer, rating integer,
  favorite boolean, public_notes text, imdb_id text,
  created_at timestamptz, updated_at timestamptz, is_movie boolean,
  movie_runtime_minutes integer
)
language sql stable security definer set search_path = '' as $$
  select e.id,e.user_id,e.title,e.mal_id,e.mal_url,e.image_url,e.synopsis,
         e.year,e.status,e.episodes_total,e.episodes_watched,e.rating,
         e.favorite,e.public_notes,e.imdb_id,e.created_at,e.updated_at,
         e.is_movie,e.movie_runtime_minutes
  from public.anime_entries e
  where (select auth.uid()) is not null
    and p_friend_id <> (select auth.uid())
    and e.user_id=p_friend_id
    and exists(
      select 1 from public.friendships f
      where f.status='accepted'
        and ((f.requester_id=(select auth.uid()) and f.recipient_id=p_friend_id)
          or (f.recipient_id=(select auth.uid()) and f.requester_id=p_friend_id))
    )
  order by e.title asc limit 2000;
$$;
revoke all on function public.get_friend_anime_v3(uuid) from public,anon;
grant execute on function public.get_friend_anime_v3(uuid) to authenticated;
