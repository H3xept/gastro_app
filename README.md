# Gastro Tracker

A lightweight, offline-first **Progressive Web App** for tracking food, bloating, bowel movements, and sleep — built for collecting data to share with a gastroenterologist.

- **No accounts, no servers.** Everything is stored locally on your device using IndexedDB.
- **Installable.** Works as a standalone app on iOS and Android.
- **Offline.** Once loaded, it works without a network connection.
- **Doctor-friendly export.** Download your data as CSV (Excel/Sheets) or JSON, or print a clean PDF.

## What you can log

| Type | Captured fields |
| --- | --- |
| 🍽️ Food | What you ate or drank, meal tag (breakfast/lunch/…), portion, time, notes |
| 🎈 Bloating | Severity (1–10), location, time, notes |
| 🚽 Bowel movement | Bristol stool scale (1–7), urgency, blood / pain / incomplete / mucus flags, time, notes |
| 🌙 Sleep | Bedtime, wake time, quality (1–5), wake-ups, notes |

## Run locally

It's plain HTML/CSS/JS — no build step. Any static server works:

```bash
# Python
python3 -m http.server 8080

# Node
npx serve .
```

Then open <http://localhost:8080>. Service workers require `http://localhost` or HTTPS, so opening the file directly via `file://` won't enable offline / install.

## Deploy

Drop the files on any static host (GitHub Pages, Netlify, Vercel, Cloudflare Pages, …). For GitHub Pages, enable Pages on the branch and visit `https://<user>.github.io/gastro_app/`.

## Install on your phone

- **iOS Safari:** Share → *Add to Home Screen*.
- **Android Chrome:** Menu → *Install app* (or *Add to Home Screen*).

The app runs full-screen, works offline, and shows up in your launcher like a native app.

## Sharing with your doctor

1. Open **Export**.
2. Pick a date range (defaults to the last 14 days).
3. Tap **Download CSV** for a spreadsheet, **Download JSON** for a complete backup, or **Print / Save as PDF** for a printable summary.

## Backup & restore

Settings → *Import JSON backup* will merge entries from a previously exported `.json` file. Use this to move data to a new device.

## Privacy

There is **no network code** in the app aside from loading its own files and the service worker cache. All data lives in your browser's IndexedDB; clearing site data wipes everything.

## Stack

- Vanilla HTML, CSS, JavaScript (no frameworks, no dependencies)
- IndexedDB for storage
- Service Worker for offline support
- Web App Manifest for installability
