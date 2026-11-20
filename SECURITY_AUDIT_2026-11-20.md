# Nightreel Supabase Security Audit — 20 November 2026

**Project:** `hgnbpiqlwrkomxjqceyk`  
**Scope:** Connected production Postgres schema, RLS, grants, five publicly callable SECURITY DEFINER functions, selected storage policies, and deployed account-deletion function.  
**Method:** Live database catalog inspection; read-only role/JWT-subject simulation; a rejected invalid favorites operation; inspection of deployed Edge Function source.  
**Limitations:** Not a third-party penetration test. Did not use genuine authenticated client sessions, create/delete users, test file uploads, or inspect every hosted infrastructure/auth setting. Normal app use still requires end-to-end regression testing.

## Overall

**No confirmed cross-account read or arbitrary-account modification was found in the tested paths. Three concrete permission weaknesses were remediated.** Supabase's Security Advisor still reports five intentionally authenticated-callable SECURITY DEFINER functions and disabled leaked-password protection. Warnings are not equivalent to a demonstrated exploit, and they should remain acknowledged until replaced or independently assessed.

## Remediations applied during this audit

1. Revoked client-role `TRUNCATE`, `TRIGGER`, and `REFERENCES` privileges on all tables in the `public` schema. The app doesn't need these permissions for library, social or moderation actions.
2. Removed arbitrary report-review status injection: authenticated users can no longer supply `reviewed_at` when submitting reports. The column remains updateable only by rows passing the moderator RLS policy.
3. Restricted the `nightreel_reports` client INSERT grant to `reporter_id`, `reported_user_id`, `category`, `reason` only. `id`, `created_at` and `reviewed_at` are server-controlled. The current Nightreel report form submits exactly the four permitted fields.

**Verification:** `has_column_privilege` checks confirmed the four expected INSERT fields are granted while the three server-managed fields are denied. The earlier unnecessary table grants are absent; ordinary report UPDATE is limited by column grant and moderator RLS.

## Function-by-function findings

| Function | Business reason | Observed access restriction | Assessment |
|---|---|---|---|
| `get_friend_anime_v6` | Share friend anime data | Requires signed-in caller, target not self, accepted friendship, target user_id match; only selected friend-view columns, no private `notes` | No unauthorized access demonstrated; security-definer exposure intentionally retained |
| `get_friend_anime_v7` | Share friend anime data + selected streaming preferences | Same accepted-friend checks; does not select private `notes`; does include `user_streaming` intended for friend view | No unauthorized access demonstrated; security-definer exposure intentionally retained |
| `get_nightreel_connections` | Look up friendship connections and other party's username | Requires signed-in caller to be either friendship participant, limits results | No unauthorized access demonstrated; security-definer exposure intentionally retained |
| `rank_my_favorites` | Atomic ordering of a user's favorites | Binds `auth.uid()`; checks supplied IDs exactly equal own favorite IDs; every UPDATE scoped by user ID and favorite status; limits array size | Invalid arbitrary favorites array rejected with SQLSTATE 22023; security-definer exposure intentionally retained |
| `search_nightreel_users` | Public-ish signed-in user discovery | Requires signed-in caller, query length 2–32, excludes self/blocked users, returns only ID/username/display name, limit 20 | Controlled profile discovery is intended; security-definer exposure intentionally retained |

All five have fixed, empty `search_path` and schema-qualified relation references. None grants callable access to anonymous users. The obsolete `get_friend_anime` through `_v5` functions are also no longer callable by anonymous/signed-in users.

**Why warnings remain:** Supabase flags callable SECURITY DEFINER functions categorically. Swapping these to SECURITY INVOKER or revoking their authenticated EXECUTE privileges without changing the architecture can break legitimate cross-user friend/social features. Retained intentionally after source and authorization review; revise only with app regression coverage.

## Role and RLS tests

- All seven exposed `public` base tables have RLS enabled; no unprotected public base tables or public views were detected.
- An arbitrary simulated signed-in identity retrieved **0 rows** from another user's friend-library RPC v6/v7, connections, messages and reports.
- Simulated authenticated friend in an existing accepted friendship successfully retrieved friend-library entries (104 at test time) and one connection.
- Moderator RLS previously confirmed Dazai's moderator role and a simulated non-moderator's inability to read the moderator inbox.
- Anonymous callers lack EXECUTE permissions on the privileged SQL functions; no public SECURITY DEFINER function was anonymously callable.
- Authenticated `rank_my_favorites` rejected an arbitrary favorites list with `Favorites changed. Refresh and try again.`.
- Authentication identity was simulated using `SET LOCAL ROLE authenticated` and a transaction-local `request.jwt.claim.sub`. Positive friend test established JWT subject **before** switching into the RLS-scoped role, avoiding a false negative.
- No real users' account, friendship, library or moderation data were changed by the testing.

## Storage and deletion

- `nightreel-covers` is deliberately public; URLs can be opened by anyone who knows them. This behavior is prominently disclosed in upload UI and the privacy notice.
- Private avatar/banner read policies require owner or accepted friendship; upload/delete paths are scoped to the user's ID prefix. Block removal should remove friendship-dependent access.
- Deployed `delete-account` function verifies JWTs, confirms the explicit phrase, derives the deletion target from its verified token, removes user-owned storage, then calls Auth admin deletion. FK relationships cascade to library, messages, profiles, friendships, blocks, reports, moderator roles.
- User independently reported a successful real-world account deletion with automatic sign-out and absence of the deleted account in the dashboard. Uploaded-media cleanup remains unverified for a test account with media; no account was deleted in this audit.

## Still open (not proven vulnerabilities)

1. **Five intentional Security Advisor `SECURITY DEFINER` warnings** remain. A full adversarial assessment with real authenticated test sessions and API requests would strengthen assurance.
2. **Leaked-password protection** remains disabled because saving the toggle prompts for a paid plan. This is an optional supplementary defense, not evidence of a breach.
3. **Real-device/client regressions** are still needed after permission changes: file a fresh report, mark it reviewed, confirm friend library and profile search, favorites ranking, and native uploads.
4. **Abuse/operational controls:** Consider report-submission rate limits, reliable staff response to reports, and handling retained reports about accounts subsequently deleted.
5. **Broader security:** No full mobile binary reverse engineering, dependency vulnerability scan, genuine-token penetration testing, or external audit of all Auth and storage service configurations was performed.

Official advisory remediation: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable  
Official breached-password guide: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Release recommendation

**No launch-blocking exploit was confirmed within the tested Supabase surfaces.** The security review of the five functions and related database policies is complete at the source/SQL simulation level. Before public release, perform the listed genuine-client regression tests and decide whether to commission an independent audit if significant growth or elevated risk warrants it. Don't pay merely to make an advisory badge disappear.
