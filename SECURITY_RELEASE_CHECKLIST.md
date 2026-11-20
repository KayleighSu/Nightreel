# Nightreel security and App Store release checklist

## Completed / verified (2026-11-20)

- Row Level Security enabled on all four public app tables: `anime_entries`, `friendships`, `direct_messages`, `profiles`.
- App uses a Supabase publishable key, not a service-role key; user passwords are handled by Supabase Auth.
- Revoked `authenticated`, `anon` and `PUBLIC` execution of obsolete friend-anime RPCs v1 through v5. The website uses v6 and v7. Verified with `has_function_privilege`.
- Native iOS origins are allowed for JWT-protected `anime-search` and `anime-catalog` functions, while keeping the web origin available.
- `nightreel-avatars` and `nightreel-banners` are private storage buckets with image-only MIME restrictions.

## Not completed: must be addressed before public App Store launch

- **Supabase Security Advisor: leaked-password protection disabled.** Enable under Authentication > Providers/Sign-in > Email (requires a supporting Supabase plan; generally Pro or higher). Do not upgrade a paid plan without authorization.
- **Five active SECURITY DEFINER functions remain:** `get_friend_anime_v6`, `get_friend_anime_v7`, `get_nightreel_connections`, `rank_my_favorites`, `search_nightreel_users`. Their sources include auth and friendship checks, but their elevated privileges require adversarial tests before declaring them safe.
- **User-uploaded anime cover bucket is PUBLIC:** `nightreel-covers` URLs can be retrieved by anyone who knows a URL, even though authenticated write/delete operations are owner-scoped. Migrating to private storage requires signed URL handling for artwork on both web and native; do not flip the bucket setting without implementing that.
- Verify authentication (email confirmation, password recovery, token storage and redirects), password strength, sign-in rate limits and CAPTCHA/anti-abuse as appropriate.
- Add in-app account deletion, reporting/blocking, moderation and an accessible legal/privacy/support page.
- Obtain appropriate licenses for default anime artwork or receive legal review of the intended limited thumbnail/citation usage. Provide upload copyright representations and a DMCA takedown workflow for user content.
- Perform multi-account RLS/RPC tests (strangers, pending requests, accepted friends, former friends, blocked users) and app security penetration testing.
- Validate bundled iOS app with Xcode on an actual iPhone and TestFlight. No signed IPA or App Store submission has been built in this repository.

Reference: https://supabase.com/docs/guides/security/production-checklist
