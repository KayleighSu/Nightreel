-- Store the release format so regular episode counts exclude movies, OVAs and specials.
-- This is separate from the member's manually entered episode totals.
alter table public.anime_entries add column if not exists catalog_format text
  check (catalog_format is null or length(catalog_format) <= 30);
grant update(catalog_format) on public.anime_entries to authenticated;
