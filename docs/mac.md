# Using Diamond Crusher on a Mac (Safari)

The Mac version is the same app, running in Safari from a folder on your Mac. It needs no account, no App Store and
nothing to install. Your data stays in Safari on your Mac, encrypted, and is never sent anywhere.

## 1. Download

- **From Releases:** open the repository's **Releases** page and download the newest `diamond-crusher-mac-….zip`.
- **From any build:** Actions → **Mac web version** → the newest run with a green tick → **Artifacts**. GitHub wraps it
  in a second zip, so unzip twice.

Unzip it and move the **Diamond Crusher** folder somewhere it can stay, such as your Applications or Documents folder.

## 2. Start it

1. Double-click **Start Diamond Crusher**.
2. The first time, macOS says it can't check the file, because it didn't come from the App Store. Open
   **System Settings** → **Privacy & Security**, scroll down, and click **Open Anyway** next to "Start Diamond
   Crusher". Then double-click it again and confirm.
3. Safari opens the app at `http://localhost:47820/`. A small Terminal window stays open while it runs; close it to stop.

To make it feel like an app, choose **File** → **Add to Dock** in Safari (macOS 14 Sonoma or newer). Double-click
Start Diamond Crusher first each time, then use the Dock icon.

## How it works

- The folder holds the app's files, a tiny web server (`app-server.pl`) and the launcher.
- The server uses Perl, which comes with macOS. It only answers this Mac (127.0.0.1) and only serves the app folder.
- Safari keeps your data for `http://localhost:47820`. Always start it with the launcher so the address stays the same.

## What's different from the phone

- **Reminders** only show while Diamond Crusher is open in Safari. Browsers can't wake a closed page. The phone app
  remains the one to rely on for reminders.
- **No app lock.** Fingerprint and face unlock are phone only. Your Mac login protects Safari.
- **Clearing Safari's website data erases the app's data.** Save a backup file now and then (Settings → Your data →
  Save a backup file). The same file opens on the phone, so you can also move between Mac and phone this way.
- **Updating:** save a backup file first, then replace the Diamond Crusher folder with the new download. Your data stays
  in Safari.
- The Mac and the phone don't sync. Each keeps its own data, as the app has no server.

## How the web version stores data

- The database is SQLite (sql.js, WebAssembly), saved after every change as one AES-256-GCM encrypted file in Safari's
  IndexedDB.
- Its key is itself encrypted with a key the browser keeps and won't hand out (a non-extractable WebCrypto key).
- The page's security policy only lets it load its own files, so it can't send data to other sites.

## Building it yourself

```bash
npm ci
npm run web          # development server
npm run build:mac    # build/diamond-crusher-mac-<version>.zip
```
