# Using Diamond Crusher on a Mac (Safari)

The web version is the same app, running in Safari. It needs no account and nothing is installed from the App Store.
Your data stays in Safari on your Mac, encrypted, and is never sent anywhere.

## 1. Turn on the web address (once)

The site is published with GitHub Pages every time `main` changes.

1. On GitHub, open the repository's **Settings** → **Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Re-run the latest **Mac web version** workflow on `main` (Actions → Mac web version → Run workflow).

GitHub Pages needs a public repository, or a paid GitHub plan for a private one. The site only contains the app's code,
which has nothing personal in it.

The address is `https://<your GitHub name>.github.io/diamond_crusher/`.

## 2. Open it and add it to the Dock

1. Open the address in Safari.
2. Choose **File** → **Add to Dock** (macOS 14 Sonoma or newer). Diamond Crusher then opens in its own window, like an app.
3. When it asks, allow notifications if you want reminders.

## What's different from the phone

- **Reminders** only show while Diamond Crusher is open, in a Safari tab or from the Dock. Browsers can't wake a closed
  page. The phone app remains the one to rely on for reminders.
- **No app lock.** Fingerprint and face unlock are phone only. Your Mac login protects Safari.
- **Clearing Safari's website data erases the app's data.** Save a backup file now and then (Settings → Your data →
  Save a backup file). The same file opens on the phone, so you can also move between Mac and phone this way.
- **Updates** arrive when you reload the page after a new version is published.
- The Mac and the phone don't sync. Each keeps its own data, as the app has no server.

## How the web version stores data

- The database is SQLite (sql.js, WebAssembly), saved after every change as one AES-256-GCM encrypted file in the
  browser's IndexedDB.
- Its key is itself encrypted with a key the browser keeps and won't hand out (a non-extractable WebCrypto key).
- The page's security policy only lets it load its own files, so it can't send data to other sites.

## Building it yourself

```bash
npm ci
npm run web                                   # development server
DC_WEB_BASE=/diamond_crusher npm run build:web   # static site in dist/
```
