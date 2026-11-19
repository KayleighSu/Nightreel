-- Catalogue episode counts are separate from each person's manual episode total and progress.
alter table public.anime_entries add column if not exists catalog_episode_total integer
 check (catalog_episode_total is null or catalog_episode_total between 0 and 50000);
grant update(catalog_episode_total) on public.anime_entries to authenticated;
