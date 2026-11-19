# Nightreel

![Nightreel icon](icons/nightreel-icon.svg)

**Your anime. Your universe.**

Nightreel is a personal anime tracker built around the shows you love. Keep a library, follow upcoming releases, rank your favorites, and compare notes with friends.

**[Open Nightreel](https://kayleighsu.github.io/Nightreel/)**

### Features

- Personal collections with watch status, episode progress, notes, and five-star ratings
- Ranked Top 5 favorites with a spotlight for your #1
- Release Radar for upcoming episodes and seasons
- Movie tracking and watched-hours totals with adjustable runtimes
- Anime search, synopses, streaming links, and custom cover art
- Public profiles, private notes, friends, direct messages, and QR invites
- Custom profile banners and responsive mobile layouts
- Home-screen installation on iOS and Android

### Built with

HTML, CSS, JavaScript, [Supabase](https://supabase.com/) (authentication, PostgreSQL, storage), [Jikan](https://jikan.moe/) and [AniList](https://anilist.co/) catalogue data. Hosted on GitHub Pages.

### Development

Nightreel is a static site. To preview it locally, serve the repository root:

```sh
python -m http.server 8000
```

Open `http://localhost:8000`. Account authentication and hosted storage require a configured Supabase project and permitted redirect origins. The browser-side `config.js` contains only public connection settings; server credentials must never be added to this repository.

Database setup and incremental changes live in `supabase/`. User collections and messages live in Supabase, **not** in this GitHub repository.

---

Made for the anime that stay with you.
