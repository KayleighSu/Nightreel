# Nightreel — iOS App

This repository contains a **Capacitor 8 iPhone app build configuration** for the existing Nightreel website. It is **not** a signed IPA or an App Store submission. GitHub Pages continues to run from the project root.

## Build on macOS

Requires Node.js (supported LTS), Xcode, an iOS simulator or device, and Apple developer signing credentials for device distribution.

1. Clone the repository and open Terminal in its root.
2. Run `npm install`.
3. Run `npm run ios:add` **only once** to generate the native `ios/` project.
   - Generate a native icon from the existing 512px Nightreel artwork: `mkdir -p assets && sips -z 1024 1024 icons/nightreel-icon-512.png --out assets/icon.png && npx --yes @capacitor/assets generate --ios --iconBackgroundColor '#17151f'` (run after creating `ios/`).
4. After each Nightreel website change, run `npm run ios:sync`.
5. Run `npm run ios:open` to open the native project in Xcode.
6. Set the app's Bundle Identifier, Signing Team and capabilities in Xcode. Build and test on a real iPhone.
7. When ready, create an App Store Connect listing, complete Apple's privacy questions and content rights review, test through TestFlight, then archive and submit.

The iOS app identifier initially uses `com.kayleighsu.nightreel`. Change it **before** your first App Store upload if you want a different permanent Bundle ID.

### How it works

`scripts/prepare-ios.mjs` copies the deployed website's local assets into a temporary `www/` directory; Capacitor bundles these into the iOS app. **Do not add API secrets** to `config.js`. The publishable Supabase key can be visible in a client; RLS and restricted RPCs enforce access.

The Supabase Edge Functions `anime-search` and `anime-catalog` have been configured to accept both the GitHub Pages origin and Capacitor's `capacitor://localhost` origin.

### Outstanding work before publishing

- Confirm Supabase Auth sign-in, signup, verification emails and password-reset redirects work inside WKWebView on a device. Configure an app URL scheme/universal link and Supabase redirect allowlist for native recovery flows; don't ship untested authentication.
- Implement account deletion, report/block and UGC moderation as applicable to Apple's review policies.
- Verify iPhone safe-area layout, file picker, scroll behavior, swipe carousel, image uploads and notifications.
- Add production push notifications; web notification sounds do not substitute for APNs when the app is closed.
- Replace or license copyrighted artwork where necessary. Offer clear rights and removal procedures for user uploads.
- Configure privacy policy, support contact, App Store screenshots, rating, permissions, app icon and splash branding.
- Run a full authenticated security test with separate accounts before launch.

**Important:** Changing the web site does not automatically update the locally bundled App Store binary. Repeat `npm run ios:sync` and release a new build when needed.


## Apple Developer and TestFlight setup (November 2026)

1. In [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list), register an explicit App ID with Bundle ID `com.kayleighsu.nightreel`, unless you choose a different identifier **before first upload**.
2. In [App Store Connect — Apps](https://appstoreconnect.apple.com/apps), add an iOS app: app name **Nightreel**, choose the same Bundle ID, choose a unique SKU (e.g. `nightreel-ios-v1`), and select your language.
3. For a **Mac build**, open Xcode, select the Nightreel App target, choose your Apple Developer Team in **Signing & Capabilities**, verify Bundle ID, version and icon, then run on a real iPhone. Archive via Product > Archive and choose **Distribute App > App Store Connect** to upload.
4. For a **Windows-first check**, GitHub Actions includes an opt-in **iOS simulator build check (manual)** workflow. In GitHub > Actions, manually run the workflow to compile on a macOS runner and retrieve an unsigned simulator artifact. **That artifact is not installable via TestFlight** and is not an App Store package. Running macOS-hosted Actions may consume billed runner minutes.
5. Once a signed device build has been uploaded, open **TestFlight** in App Store Connect and invite internal testers.

### Safety and account management

- The app now has password-confirmed account deletion backed by a JWT-authenticated Supabase Edge Function. Do not exercise this with the owner account while testing; use a disposable test account.
- Friend profiles support reporting and blocking. The `nightreel_reports` table is reviewable by project administrators in Supabase; establish a documented response/moderation workflow before inviting public users.
- **Sign-up verification / password reset during the first iOS beta:** email links return to the Nightreel website, not directly to the iOS app. Once confirmed or reset on the web, users can sign into the installed app. Native universal/deep linking can be added after device testing.
- Configure a support contact and publish accurate privacy, data retention and community/content terms before App Store review.
