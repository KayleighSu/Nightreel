-- Nightreel display name + generated username repair.
-- Applied to Nightreel Supabase on 2026-11-19.
-- The user's display name is supplied at signup; the immutable unique
-- username is generated from their auth UUID.
create or replace function public.nightreel_create_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare chosen_name text;
begin
  chosen_name := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  if char_length(chosen_name) < 1 or char_length(chosen_name) > 60 then
    raise exception 'Display name is required (1–60 characters)';
  end if;
  insert into public.profiles(id,username,display_name)
  values(new.id,'user_' || substring(replace(new.id::text,'-',''),1,24),chosen_name)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Repair existing test accounts, but explicitly leave Dazai/Dazai alone.
-- These former usernames are the names the users had chosen.
update public.profiles
set display_name=username,
    username='user_' || substring(replace(id::text,'-',''),1,24),
    updated_at=now()
where username in ('Test','Test2')
  and lower(btrim(display_name))='anime fan';

-- Users may change their public display name, not their unique ID.
revoke update (username) on public.profiles from authenticated;
