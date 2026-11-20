# Nightreel — App Store review preparation

**Status:** working notes. Public privacy and support URLs have been created. Do not submit as final review metadata until the disclosure and retention language receives operator/legal review.

## App overview

- Name: Nightreel
- Bundle identifier: `com.kayleighsu.nightreel`
- Category suggestion: Entertainment
- Summary: Track anime, organize your collection, rank favorites and share what you're watching with accepted friends.
- Supported platform: iPhone (Capacitor web app wrapper, iOS simulator build verified; physical-device testing outstanding).
- Accounts: email/password Supabase authentication.
- Features requiring access: camera for scanning friend QR codes (only after the user taps Scan); optional file selection for uploaded anime artwork, avatar and banner.

## Privacy disclosure preparation — verify prior to submission

Observed current implementation:
- Account sign-in uses email and password via Supabase Auth, with a per-user account ID and public username/display name.
- Stores anime entries, ratings, progress, favorites, notes, friendships, direct messages, and uploaded media in Supabase.
- Accepted friends may see shared library data/public notes; direct messages are restricted to participants in an accepted friendship.
- Avatars/banners use private Supabase storage; uploaded cover art is stored in a PUBLIC bucket, and URLs can be viewed by anyone with the link.
- Search/metadata features make requests to external anime catalogue services through Supabase Edge Functions. Inspect any direct Jikan, AniList or other network requests before finalizing disclosure.
- Account deletion can be requested in the app and is handled by a protected Supabase Edge Function; it needs end-to-end testing with a disposable account.
- No advertisement or analytics SDK was identified in the inspected first-party frontend; recheck all bundled scripts/plugins before App Store submission.

**To decide and disclose:** exact categories of data collected and linked to users, purposes, diagnostic/log retention, user-facing data deletion behavior, third-party processors and their countries, tracking definition, minimum user age, contact details, and any analytics added before release.

## Required human inputs

1. **Completed:** Support contact published as `support.nightreel@gmail.com`; support page: `https://kayleighsu.github.io/Nightreel/support.html`.
2. **Needs confirmation:** Legal/operator identity, data retention practices, and privacy notice review. Draft published: `https://kayleighsu.github.io/Nightreel/privacy.html`.
3. A copyright complaint and takedown contact; review whether a DMCA agent registration applies.
4. Owner-only in-app moderation inbox is live, with an unreviewed-report indicator. A ChatGPT task checks for new reports hourly, but automated **Gmail delivery** and a documented moderation response process still need to be arranged.
5. Confirm all default anime images can be used under a valid license, permission or documented applicable copyright exception.
6. Supply a **disposable reviewer account** with representative demo content, or obtain Apple's approval for guest demo use; do not share the owner account credentials.

## Reviewer notes (draft, not for automatic upload)

Nightreel is an anime tracking and friends application. Users sign up with email/password, add titles, set a watch status, track progress, rank favorites and optionally upload custom cover artwork. Accepted friends can see each other's shared collections and message one another. Users can report or block profiles, and account deletion is available in the account dialog. To access the QR scanner, open Profile > Scan a QR > Start Camera. Camera permission is requested only when scanning. The app currently directs password recovery/verification emails to the hosted Nightreel website; the user can then sign into the native application.

## Apple listing links

- Privacy Policy URL: `https://kayleighsu.github.io/Nightreel/privacy.html` (verify and approve content before entering into App Store Connect).
- Support URL: `https://kayleighsu.github.io/Nightreel/support.html`.
- Community Guidelines: `https://kayleighsu.github.io/Nightreel/community-guidelines.html`.

## Remaining device checks

- Login, signup, email confirmation, reset and signout in WKWebView
- Camera QR scanning and iOS permission prompt
- Artwork/avatar/banner uploads and file picker
- Keyboard, iPhone safe area, zoom, carousel swipe, landscape behavior
- Report/block, message notifications, and account deletion on disposable accounts
- External links, WebKit browser security and error screens
- An actual signed `.ipa` uploaded and processed in TestFlight

Official guidance: https://developer.apple.com/app-store/review/guidelines/
