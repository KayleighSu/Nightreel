# Nightreel release verification — 2026-11-20

This records **checks actually performed** on the live connected Supabase project and GitHub repository. It is not a penetration test or App Store approval.

## Read-only database authorization tests

Conducted inside read-only transactions with `SET LOCAL ROLE authenticated` and a simulated JWT subject. No user records were altered.

| Check | Observed |
| --- | --- |
| Owner/Dazai moderator session reads `nightreel_moderators` | 1 visible moderator record |
| Owner/Dazai moderator session reads `nightreel_reports` | 1 report visible during test |
| Arbitrary unrecognized signed-in account reads `nightreel_moderators` | 0 rows |
| Arbitrary unrecognized signed-in account reads `nightreel_reports` | 0 rows |
| Arbitrary unrecognized signed-in account reads a non-friend's anime using `get_friend_anime_v7` | 0 rows |
| Arbitrary unrecognized signed-in account reads `get_nightreel_connections` | 0 rows |
| Signed-in account searches profiles using `search_nightreel_users` | Found a public profile, as intentionally designed |
| Anonymous access to `nightreel_reports` | Denied at SQL table privilege layer |
| Signed-in role may UPDATE report `reason` | No |
| Signed-in role may UPDATE report `reviewed_at` | Yes, but row-level policy limits update to moderators |

Security review also confirmed five active `SECURITY DEFINER` functions (friend library v6/v7, connections, favorites ranking, user search) are explicitly scoped to authenticated identities in their definitions. They are still flagged by Supabase's Security Advisor and require more comprehensive authenticated-account and adversarial tests before a public launch. Their permissions were not changed during this check.

Leaked-password protection is reported disabled in Supabase Auth; this should be reconsidered before production release.

## Account deletion

- Confirmed the deployed `delete-account` Edge Function has JWT verification enabled.
- Inspected handler: it derives the deletion target from the bearer token's user identity and checks the explicit `DELETE MY ACCOUNT` confirmation phrase.
- Checked database foreign-key definitions: anime entries, profiles, friendships, messages, blocks, reports and moderator roles cascade on Auth user deletion.
- **Not tested on a live disposable user account.** Need to verify Auth deletion, media deletion, UI signout, and backups/retention disclosures on a test account.
- Reports referencing a deleted account cascade away. Decide whether moderation/audit retention policy needs a different treatment before launch.

## Build and publication

- GitHub Pages deployment was successful as checked on November 20.
- Latest prior unsigned iOS Simulator compilation succeeded.
- Updated `.github/workflows/ios-simulator.yml` so JavaScript, CSS, HTML, icon, image and policy updates automatically trigger a fresh simulator check; run result should be verified before marking this change as passed.
- Signed physical-device build and TestFlight upload are **not yet tested**, pending Apple Developer enrollment and credentials.

## Prelaunch requirements still open

1. Have a disposable account perform reporting, blocking, review-marking and permanent deletion end-to-end.
2. Verify moderation reports and security policies using two or more real, signed-in test accounts, including attempted unauthorized updates.
3. Verify native iPhone camera, photo picker, safe area, login, email verification, password reset, outbound links and keyboard.
4. Finish App Store Connect screenshots, App Privacy disclosures, support URL, age rating, and review account.
5. Review media rights, legal contact/retention disclosures and copyright handling.
6. Configure and test actual email notifications if desired. ChatGPT hourly report monitoring is separate from support Gmail.
