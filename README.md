# Gut Tracker

A small offline-first PWA to track food, bloating, bowel movements, and sleep —
designed to collect data for a gastroenterologist visit.

- **Local-only**: data lives in your browser's IndexedDB, nothing leaves the
  device unless you export it.
- **Installable**: open in a mobile browser and choose "Add to Home Screen".
- **Offline**: a service worker caches the shell so the app works without a
  connection.
- **Exports**: CSV (one row per entry, columns for each metric), JSON
  (full backup), and a printable HTML summary you can save as PDF.

## What you can log

- **Food** — description, portion (small / medium / large), tags
  (dairy, gluten, spicy, fatty, fried, high-fibre, caffeine, alcohol, sugar,
  processed) and free-text notes.
- **Bloating** — severity 0–10, pain 0–10, location, notes.
- **Bowel movements** — Bristol stool scale 1–7, urgency (none / mild /
  urgent), and flags for blood, mucus, pain, incomplete evacuation, straining.
- **Sleep** — bedtime, wake time, hours slept (auto), quality 1–5,
  number of night wake-ups.

## Run locally

It's pure static HTML/CSS/JS. Serve the directory with anything:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

A service worker requires `http://localhost` (not `file://`).

## Deploy

Drop the directory on any static host — GitHub Pages, Netlify, Cloudflare
Pages, etc. No build step.

## Files

- `index.html` — app shell, tab navigation, entry dialog markup.
- `styles.css` — light/dark theme, mobile layout.
- `db.js` — small IndexedDB wrapper for the `entries` store.
- `app.js` — view switching, entry forms, history rendering, exports.
- `sw.js` — service worker (cache-first for app shell).
- `manifest.webmanifest` — PWA manifest.
- `icons/` — app icon (SVG + 192/512 PNG).
