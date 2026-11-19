-- Run once in the SQL Editor of your own Supabase project.
-- Passwords and authentication are managed by Supabase Auth.
create table if not exists public.anime_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  mal_id integer,
  mal_url text,
  image_url text,
  synopsis text,
  year integer check (year is null or year between 1900 and 2200),
  status text not null default 'plan_to_watch' check (status in ('untracked','plan_to_watch','watching','completed','on_hold','dropped')),
  episodes_total integer check (episodes_total is null or episodes_total between 0 and 50000),
  episodes_watched integer not null default 0 check (episodes_watched between 0 and 50000),
  rating integer check (rating is null or rating between 1 and 10),
  favorite boolean not null default false,
  notes text not null default '' check (char_length(notes) <= 5000),
  imdb_id text check (imdb_id is null or imdb_id ~ '^tt[0-9]{7,10}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint watched_not_past_total check (
    episodes_total is null or episodes_total = 0 or episodes_watched <= episodes_total
  )
);

create index if not exists anime_entries_user_updated_idx on public.anime_entries (user_id, updated_at desc);
create unique index if not exists anime_entries_user_mal_idx on public.anime_entries (user_id, mal_id) where mal_id is not null;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.anime_entries to authenticated;
revoke all on public.anime_entries from anon;
alter table public.anime_entries enable row level security;
drop policy if exists "read own anime" on public.anime_entries;
create policy "read own anime" on public.anime_entries for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "insert own anime" on public.anime_entries;
create policy "insert own anime" on public.anime_entries for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "update own anime" on public.anime_entries;
create policy "update own anime" on public.anime_entries for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "delete own anime" on public.anime_entries;
create policy "delete own anime" on public.anime_entries for delete to authenticated using ((select auth.uid()) = user_id);
create or replace function public.nightreel_set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists anime_entries_set_updated_at on public.anime_entries;
create trigger anime_entries_set_updated_at before update on public.anime_entries
  for each row execute function public.nightreel_set_updated_at();
