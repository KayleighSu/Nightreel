-- Non-destructive anime catalogue metadata. Personal watch status, ratings, notes,
-- favorites and watched-episode counts are never changed by this migration.
alter table public.anime_entries
 add column if not exists catalog_airing_status text,
 add column if not exists catalog_broadcast text,
 add column if not exists catalog_premiere_at timestamptz,
 add column if not exists catalog_sequel_title text,
 add column if not exists catalog_sequel_mal_id integer,
 add column if not exists catalog_sequel_status text,
 add column if not exists catalog_sequel_premiere_at timestamptz,
 add column if not exists catalog_checked_at timestamptz;
grant update (
 mal_id,mal_url,synopsis,episodes_total,catalog_airing_status,
 catalog_broadcast,catalog_premiere_at,catalog_sequel_title,
 catalog_sequel_mal_id,catalog_sequel_status,catalog_sequel_premiere_at,
 catalog_checked_at
) on public.anime_entries to authenticated;
