-- Applied to Nightreel's production Supabase project on 2026-11-20.
-- The active website and iPhone app use v6/v7 only.
-- Keep these obsolete SECURITY DEFINER endpoints inaccessible to browser users.
REVOKE EXECUTE ON FUNCTION public.get_friend_anime(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_friend_anime_v2(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_friend_anime_v3(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_friend_anime_v4(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_friend_anime_v5(uuid) FROM PUBLIC, anon, authenticated;
