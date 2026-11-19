-- Per-account favorites rankings, without guessing personal favorites.
-- NULL ranks remain alphabetical until the owner explicitly saves an order.
alter table public.anime_entries
  add column if not exists favorite_rank integer
  check (favorite_rank is null or favorite_rank between 1 and 2000);

-- Unfavoriting releases the previous slot. Changing ranks alone does not change
-- the latest-personal-edit timestamp or the Stay Obsessed banner artwork.
create or replace function public.nightreel_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not new.favorite then new.favorite_rank := null; end if;
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

-- One atomic owner-only reorder. No direct UPDATE privilege on favorite_rank.
create or replace function public.rank_my_favorites(p_order uuid[])
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_total integer;
  v_count integer;
  v_distinct integer;
begin
  if v_user is null then
    raise exception 'Sign in to rank your favorites' using errcode = '28000';
  end if;
  if p_order is null or cardinality(p_order) > 2000 then
    raise exception 'Invalid favorites order' using errcode = '22023';
  end if;
  -- Hold the current favorites stable while checking the supplied list.
  perform 1 from public.anime_entries as e
  where e.user_id = v_user and e.favorite is true for update;
  select count(*) into v_total
    from public.anime_entries e where e.user_id = v_user and e.favorite is true;
  select count(*),count(distinct id) into v_count,v_distinct
    from unnest(p_order) as chosen(id);
  if v_total <> v_count or v_distinct <> v_count then
    raise exception 'Favorites changed. Refresh and try again.' using errcode='22023';
  end if;
  if exists(
    select 1 from unnest(p_order) as chosen(id)
    where not exists (
      select 1 from public.anime_entries e
      where e.id = chosen.id and e.user_id = v_user and e.favorite is true
    )
  ) then
    raise exception 'Invalid favorite in ranking' using errcode='42501';
  end if;
  update public.anime_entries e
    set favorite_rank = ordered.ord::integer
    from unnest(p_order) with ordinality as ordered(id,ord)
    where e.id = ordered.id and e.user_id=v_user and e.favorite is true;
  return v_total;
end;
$$;
revoke all on function public.rank_my_favorites(uuid[]) from public,anon;
grant execute on function public.rank_my_favorites(uuid[]) to authenticated;

-- Friends can see the ordering but never change it. Do not expose private notes.
create or replace function public.get_friend_anime_v4(p_friend_id uuid)
returns table(
  id uuid,user_id uuid,title text,mal_id integer,mal_url text,
  image_url text,synopsis text,year integer,status text,
  episodes_total integer,episodes_watched integer,rating integer,
  favorite boolean,public_notes text,imdb_id text,
  created_at timestamptz,updated_at timestamptz,is_movie boolean,
  movie_runtime_minutes integer,favorite_rank integer
)
language sql stable security definer set search_path = '' as $$
  select e.id,e.user_id,e.title,e.mal_id,e.mal_url,e.image_url,e.synopsis,
         e.year,e.status,e.episodes_total,e.episodes_watched,e.rating,
         e.favorite,e.public_notes,e.imdb_id,e.created_at,e.updated_at,
         e.is_movie,e.movie_runtime_minutes,e.favorite_rank
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
revoke all on function public.get_friend_anime_v4(uuid) from public,anon;
grant execute on function public.get_friend_anime_v4(uuid) to authenticated;
