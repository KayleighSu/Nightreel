-- Editable custom or latest-anime banner crops for desktop and mobile.
-- Only the profile owner can edit these fields through the existing profile RLS policy.
alter table public.profiles
 add column if not exists banner_desktop_x integer not null default 50 check (banner_desktop_x between 0 and 100),
 add column if not exists banner_desktop_y integer not null default 50 check (banner_desktop_y between 0 and 100),
 add column if not exists banner_desktop_zoom numeric(4,2) not null default 1 check (banner_desktop_zoom between 1 and 3),
 add column if not exists banner_mobile_x integer not null default 50 check (banner_mobile_x between 0 and 100),
 add column if not exists banner_mobile_y integer not null default 50 check (banner_mobile_y between 0 and 100),
 add column if not exists banner_mobile_zoom numeric(4,2) not null default 1 check (banner_mobile_zoom between 1 and 3);
grant update(
 banner_desktop_x,banner_desktop_y,banner_desktop_zoom,
 banner_mobile_x,banner_mobile_y,banner_mobile_zoom
) on public.profiles to authenticated;
