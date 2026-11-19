-- Catalogue refresh must not count as the member editing an anime.
-- Keep "Stay Obsessed" based on personal edits, not background metadata.
create or replace function public.nightreel_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
 if row(
   old.title,old.mal_url,old.image_url,old.year,old.status,
   old.episodes_total,old.episodes_watched,old.rating,old.favorite,
   old.notes,old.public_notes,old.imdb_id
 ) is distinct from row(
   new.title,new.mal_url,new.image_url,new.year,new.status,
   new.episodes_total,new.episodes_watched,new.rating,new.favorite,
   new.notes,new.public_notes,new.imdb_id
 ) then
   new.updated_at := now();
 else
   new.updated_at := old.updated_at;
 end if;
 return new;
end;
$$;
