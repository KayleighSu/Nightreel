-- Some official premiere announcements provide only a month or year.
-- Preserve the actual confirmed window rather than inventing a day.
alter table public.anime_entries
 add column if not exists catalog_sequel_window text
 check (catalog_sequel_window is null or length(catalog_sequel_window) <= 40);
grant update(catalog_sequel_window) on public.anime_entries to authenticated;
