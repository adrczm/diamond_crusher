# Diamond Crusher

Pelvic floor training and tracking.

A private app for your phone. It guides short daily sessions, teaches the squeeze, tracks a monthly self-check and a few
optional logs, and shows your progress against your own past. It works offline, has no account and no server, and the
release build has no internet permission. Every install starts empty: nothing personal is built into the app.

Diamond Crusher is a training aid. It does not diagnose any condition and is not medical advice.

- **Install on Android:** see [docs/install.md](docs/install.md).
- **Specs:** the build follows the project specs (00 to 10). Requirement IDs such as `ONB-012` or `PRG-006` appear in code comments.

## Stack

React Native with Expo (SDK 54), expo-router, TypeScript. Data lives in an encrypted SQLite database (SQLCipher) whose
key is kept in the phone's secure storage. Backup files are encrypted with AES-256-GCM using a passphrase (PBKDF2-SHA256).

```
app/            screens (expo-router)
src/domain/     rules: safety routing, learn, sessions, progression, schedules, reminders (pure TypeScript, no React)
src/data/       SQLite schema, migrations, repositories, backup file format, key handling
src/features/   services that combine domain rules with the data layer, and shared screen parts
src/platform/   notifications, secure storage, authentication, files, sound and vibration
src/content/en/ all wording, education screens and questionnaire modules
plugins/        Expo config plugins: no network, no cloud backup, secure window, release signing
test/           Jest tests (Node): domain rules, data layer, content checks
```

## Development

```bash
npm ci
npm run typecheck
npm test
```

See [docs/install.md](docs/install.md) for building the APK, and [docs/notes.md](docs/notes.md) for what's simplified in this first version.
