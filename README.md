# NIGHTREEL · A personal anime archive

A polished, responsive anime tracker you can host as a website and share with a friend. **Each person creates their own account** and gets an independent, private library with their own watch statuses, ratings, favorites, progress, and notes. The database enforces that privacy using Supabase Row Level Security (RLS).

## What works

- Email/password **sign-up**, **log-in**, **log-out**, email verification, password reset and session persistence (with Supabase configured).
- Private per-account anime collection: add, edit, delete, search, filter, sort, and favorite.
- Watch status, episode progress, 1–10 rating, notes, cover image and optional year.
- Live search against the [Jikan API](https://jikan.moe/) (unofficial MyAnimeList API) to quickly fill in anime titles, cover art, and episode counts. **Manual entry** also works when Jikan is unavailable or a title isn't listed.
- **IMDb**: use a direct title page if a valid IMDb ID/link has been supplied; otherwise show an IMDb **search** link for that title. It deliberately doesn't pretend a search result is the verified title page.
- Export/import **JSON**, import **CSV**, and import anime titles directly from an old `Tracker.html` file. Exports are portable between accounts, but never automatically shared.
- Responsive desktop/mobile design.
- When Supabase isn't configured, a clearly labeled **local preview mode** with sample anime so you can explore the interface. **Preview mode is not a real multiuser service.**

## 1. Set up Supabase (necessary for separate logins)

1. Create a Supabase project at https://supabase.com/dashboard.
2. Open **SQL Editor** in that project, open the included `supabase.sql`, paste the whole script, and click **Run**. This creates the `anime_entries` table and its ownership policies.
3. Go to **Project Settings → API Keys** (sometimes called **Connect → API Keys**). Copy the **Project URL** and a **publishable** (`sb_publishable_...`) or legacy **anon** key. In `config.js`, fill in:

   ```js
   window.NIGHTREEL_CONFIG = {
     supabaseUrl: 'https://YOUR-PROJECT.supabase.co',
     supabaseAnonKey: 'YOUR_PUBLISHABLE_OR_ANON_KEY',
   };
   ```

   **Never use the `service_role`, `sb_secret_...`, database password, or any other privileged secret in client-side code.** A public website inherently exposes `config.js`; the limited publishable key is designed for this and the SQL RLS policies protect each user's rows.
4. In **Authentication → Providers → Email**, ensure email/password login is enabled. Email confirmation can be enabled (recommended). Verify that Supabase email sending is configured appropriately if you plan to have people other than yourself sign up. Supabase's built-in email delivery may be limited for production; you may need a custom SMTP provider.
5. Under **Authentication → URL Configuration**, add the exact URL where you will host the app to **Site URL** and **Redirect URLs**, for example `https://YOURNAME.github.io/nightreel/`. This is required for confirmation and reset links.

## 2. Host the website

**GitHub Pages (free static hosting):**

1. Create a GitHub repository called `nightreel` and upload the files in this folder to the **repository root** (not inside another folder): `index.html`, `styles.css`, `app.js`, `config.js`, `favicon.svg`.
2. In **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`, then Save.
3. The live address will usually be `https://YOURNAME.github.io/nightreel/`. Add that address to your Supabase Authentication URL Configuration, as explained above.
4. Open that link, **Create account**, and confirm your email if required. Send the **same site URL** to your friend: they can register independently and have their own private anime collection.

No backend server to manage and no Node installation is required. When Supabase is configured, the browser imports the Supabase client from a CDN; it requires internet access. These instructions assume the Supabase project URL has the standard `.supabase.co` domain.

### Local development

To preview the unconfigured app, double-click `index.html`, or serve the folder with `python -m http.server 8000` and open `http://localhost:8000`. For real login testing, use a hosted URL with the correct Supabase redirect settings. **Password-recovery links should be tested on your real HTTPS hosted domain.** Local sample edits are stored only in your browser via `localStorage` until Supabase is configured.

## 3. Bring your old tracker entries over

The original PC files weren't available when this version was made, so **your original custom list has not been imported**. The six visible entries in preview mode are examples, not recovered watch history.

### Best method: transfer your original ratings, progress and notes

The old tracker kept the cards in the HTML and personal ratings, episode progress, and notes in your browser's **localStorage**. Because those values aren't in the HTML file itself, the new app cannot read them from another website automatically.

1. On your Windows PC, open the **original** `Tracker.html` in the **same browser/profile** you used before.
2. Open the browser's Developer Tools Console (`F12` → **Console**).
3. Open the included file `legacy-export-snippet.js` in a text editor, copy its full content, paste it into that Console and run it. Review the code before running it. The script reads the old `.anime-item` cards and relevant localStorage entries and downloads `old-anime-tracker-export.json` **locally**, without uploading anything to a server.
4. Open Nightreel, sign in, click **Import**, and choose `old-anime-tracker-export.json`.

The original 1–5 star ratings are converted to Nightreel's 1–10 scale by doubling the rating. Watch statuses are inferred from saved episode progress and checkbox state; verify them after import. If the old browser data was deleted or you switched browser profiles, it might no longer be recoverable this way.

### Alternative: import the old HTML file directly

If you only have `Tracker.html`, sign into Nightreel and click **Import** → select `Tracker.html`. Nightreel reads titles from `.anime-item h2` cards and imports any directly linked IMDb title and accessible cover image URL. **This cannot restore ratings, notes, or episode progress that were saved separately in localStorage.** For the fullest restore, import the JSON above **first** rather than the HTML, because duplicates are skipped.

### Standard JSON / CSV import

Nightreel accepts JSON arrays, JSON exports containing an `entries` array, and CSV with these column headings:

`title,status,episodes_watched,episodes_total,rating,favorite,notes,imdb_id,image_url,year,mal_id`

- `title` is required; `name` or `anime` also works as a column header.
- Statuses: `plan_to_watch`, `watching`, `completed`, `on_hold`, `dropped`.
- Ratings: 1–10; favorite: true/false.
- Import skips existing matching MyAnimeList IDs, or matching titles if there is no MyAnimeList ID.
- Always export a backup before a bulk import. Don't delete the original `Tracker.html`, `Tracker.js`, or the old browser profile until you confirm the migration succeeded.

## Key distinctions and limitations

- This is a **multi-account private collection**, **not** a social network: friends have separate lists, and there is no browsing of each other's lists by default. Public profiles or optional sharing can be added later.
- Your entries live in your own Supabase project, not in GitHub. GitHub Pages only serves the interface.
- Jikan is an external free API. It can be temporarily unavailable or rate-limited. Search is optional; manual entry remains available.
- IMDb has no unrestricted official public title-search API included here. Direct page links are generated only from IDs you provide; other titles link to an IMDb search results page.
- Poster images are fetched from the saved external URLs. Avoid using private image links.
- For wider public launch, review Supabase project settings, abuse prevention, password requirements, email sending, privacy notices, and usage limits.

## Files

- `index.html` — app markup
- `styles.css` — visual design and responsive layout
- `app.js` — interface, login flow, catalogue search, collections, JSON/CSV import/export
- `config.js` — your Supabase public configuration (fill in before hosting)
- `supabase.sql` — database table, validation, indexes and private-owner RLS policies
- `favicon.svg` — app icon
- `import-template.csv` — an empty import template
- `legacy-export-snippet.js` — optional one-time browser-console export of the original localStorage ratings, notes, and progress

Made for anime you love, and the endings that don't love you back.

## Nightreel v2 · Photo cards, real accounts and friends

The original 83 anime and their 83 hand-selected background images are preserved in `original-collection.js`, referencing the untouched original `KayleighSu/anime-tracker` repository. The app now overlays information on dimmed artwork, offers five-star ratings (stored on the 10-point scale), flips cards to show a summary from the Jikan/MyAnimeList catalogue, and sorts by title A–Z by default.

### Auth and data setup

**This repository already targets a separate Nightreel Supabase project.** Do not re-use or modify ToteHome's database. Only the public Supabase project URL and **publishable** key belong in `config.js`. Never expose a database password, service-role key, or `sb_secret_` key in GitHub.

The Supabase schema is stored in `supabase.sql`, `supabase-social.sql`, and `supabase-security-hardening.sql`. Each must be applied **once**, in that order, to a new project. They are already installed on the existing Nightreel project. Avoid re-running migrations unnecessarily.

In the [Nightreel Supabase dashboard](https://supabase.com/dashboard/project/hgnbpiqlwrkomxjqceyk), finish **Authentication → URL Configuration**:
- **Site URL:** `https://kayleighsu.github.io/Nightreel/`
- **Additional Redirect URL:** `https://kayleighsu.github.io/Nightreel/` (exact URL)
- In **Authentication → Providers → Email**, keep email confirmation enabled.
- Set a strong **server-side minimum password length** (12+ characters recommended) and review authentication rate limits and attack-protection options. Front-end password validation alone does **not** enforce password security.
- Email sending on Supabase's built-in provider may have limitations and quotas. Configure supported SMTP as needed before wider rollout.

**Test with two newly created accounts**: each signs up, confirms email, logs in, changes their public display name/username, imports anime using **Original collection** (if desired), rates entries, and adds both public and private notes. Search for the second username, send request, accept in second account, and verify read-only profile sharing. Check that private notes, email addresses, and edit buttons are never exposed through friend views; attempting direct cross-user database modification must fail via RLS.

### Friends and privacy

- Profiles: searchable usernames and display names only. Friend requests require explicit recipient approval.
- Only **accepted friends** can view full profiles, custom banners, the anime list, ratings, episode progress, and **public notes**.
- **Private notes** stay in `anime_entries.notes`. The friend-facing `get_friend_anime` RPC never selects that column and checks friendship server-side.
- An owner can add/edit/remove their own anime and change their own profile. A friend cannot edit either, enforced by RLS and column grants.
- Custom banners are limited to JPG/PNG/WebP, 4 MB, and owner-namespaced paths in a **private** Supabase Storage bucket; only accepted friends can retrieve signed links. The default banner is the most recently edited anime's background.
- Three authenticated-only, security-definer RPC functions are intentionally used to provide selective friend/search data while preventing direct cross-user access. They validate `auth.uid()`, limit results, and expose no private-note field. Supabase's security advisor flags these as requiring review; do not treat the flag as a guarantee of safety or disable it without a substitute.
- To revoke friend access, remove that friendship. Previously generated short-lived banner URLs may remain usable until they expire.

### Limits / verification

The interface code and schema have been syntax-checked and the database RLS/column restrictions have been checked. **Two-account end-to-end verification and mobile-browser acceptance testing are still required before describing this as production-ready.** Card descriptions are fetched from Jikan/MyAnimeList, not scraped from IMDb; IMDb title links remain available. Because these are remote catalogue descriptions, availability is dependent on Jikan and matching by title may need manual correction. The app uses a pinned Supabase JS CDN version.

## Messaging, friend QR codes and profile pictures

- **Messages:** Accepted friends can exchange messages via the envelope icon. Database RLS checks the participants and accepted friendship for every read/write. Only recipient_id and body are client-insertable; the sender is taken from the authenticated session. Recent messages are polled while a chat is open. Messages are **not** end-to-end encrypted.
- **Top-right profile menu:** Shows a public username and profile photo instead of the user's email. Includes profile editing, QR, scanner, Messages, photo upload, and logout.
- **Profile photos:** JPG/PNG/WebP up to 2 MB, stored in the *private* nightreel-avatars bucket. Signed access is limited to the owner and accepted friends.
- **Friend QR:** Contains only the public username and a Nightreel link; no email, session ID, or authentication token. Scanning a QR lets someone send a request, not automatically become a friend.
- **Scan QR:** In-app camera reader; fallback supports a QR image upload or pasted link. Camera permission is required.
- **Mobile:** Styles load after the original CSS. Cards use a single full-width column at phone widths, and the compact header keeps profile/messages controls visible.
- **Applied migrations:** supabase-messages-avatar.sql and supabase-messages-policy-fix.sql in the dedicated Nightreel Supabase project.
- **Important:** Keep the avatar bucket private and message RLS enforced. Test actual Safari/iOS sign-in, camera access, friend requests, private messages and image upload before a public launch.
