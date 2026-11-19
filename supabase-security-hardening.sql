-- Harden the signup trigger: it must be callable by PostgreSQL's auth trigger,
-- never directly through the public REST API.
revoke all on function public.nightreel_create_profile() from public, anon, authenticated;
-- Restrict non-owner edits to core ownership and timestamp columns.
revoke update on public.anime_entries from authenticated;
grant update(title,mal_id,mal_url,image_url,synopsis,year,status,episodes_total,episodes_watched,rating,favorite,notes,public_notes,imdb_id)
on public.anime_entries to authenticated;
-- The friendship owner/recipient IDs and profile owner ID remain non-updatable.
