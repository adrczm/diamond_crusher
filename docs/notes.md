# Version 1 notes: what's simplified, and what's left for later

These are the places where the first build takes a simpler route than the specs describe, or leaves something out on purpose.

## Content and licences

- **ICIQ questionnaires are not included.** They need a non-commercial registration at iciq.net first. Until then the
  monthly check uses the self-check and the app's own questions, all labelled "App question, not validated". When a
  licence is granted, the module JSON goes in `src/content/en/questionnaires/`, its hash in `manifest.json`
  (`node scripts/hash-modules.js`), and its licence status is set to `granted`.
- **Female profile content is marked TODO**, as the specs say. The structure is in place; the wording shows a banner.

## Behaviour

- **Notification buttons open the app.** "Snooze 30 min" and "Done already" work, but Android brings the app to the
  front first. Handling them fully in the background needs a native module.
- **Backup encryption runs in JavaScript.** Protecting or opening a backup file (600,000 PBKDF2 rounds) can take from
  10 seconds to about a minute on a phone. A progress bar shows while it runs. A native crypto module can speed this up later.
- **The session pauses when the screen turns off or the app leaves the screen.** Cues don't keep playing in the
  background (spec 09, open question 6).
- **Reminders are rescheduled a week ahead** each time the app opens or something changes. If the app isn't opened for
  more than a week, reminders stop until it is (the spec's rolling window).
- **The safety history uses screening outcomes** to decide which past days were restricted when counting programme weeks.
- **Time pickers are typed** (HH:MM) rather than a clock dial.

## Checks before relying on it

Things the specs say to confirm on a real phone (07 and 09 open questions):

- The app lock after adding a new fingerprint or face (the key may become unreadable; keep a backup file).
- Reminder delivery with battery optimisation on (Samsung and some other phones stop reminders).
- Screenshots are blocked in the app (FLAG_SECURE); the recent-apps preview is blank.
- The database file is unreadable without the key (SQLCipher).

## Design

- **The look follows Shopify Polaris.** React Native can't use Polaris's React components, so the app uses Polaris's
  design tokens (generated into `src/ui/polaris.ts` from `@shopify/polaris-tokens`) and the Inter typeface, with its own
  components styled to match. Touch targets stay at 48 px or more, larger than Polaris's desktop sizes.
- Polaris's dark theme is still experimental and leaves some colours at their light values. `src/ui/theme.ts` overrides
  those few (link, success, emphasis, input and border colours) so text stays readable in dark mode.
