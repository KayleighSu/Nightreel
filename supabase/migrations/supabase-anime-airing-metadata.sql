-- Optional exact next-airing data when a trusted anime catalogue provides it.
alter table public.anime_entries
 add column if not exists catalog_next_episode_at timestamptz,
 add column if not exists catalog_next_episode_number integer,
 add column if not exists catalog_source text;
grant update(catalog_next_episode_at,catalog_next_episode_number,catalog_source)
 on public.anime_entries to authenticated;
