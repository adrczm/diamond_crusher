# Accessibility debt register

A living list of known accessibility gaps. Add a row when a gap is found; close it with the PR that fixes it. Review
it before each release. Source: design review of 29 September 2026
(`research/design-strategy/design-review-2026-09-29.md` in the project files).

Severity: **H** blocks a task for some people, **M** makes a task hard, **L** is friction.

## Open

| ID | Gap | WCAG | Where | Sev | Next step |
|---|---|---|---|---|---|
| AD-01 | A form left open past the app-lock timeout is lost when the app re-locks (sessions and timed tests are protected) | 3.3.4 (spirit) | `app/_layout.tsx` gate | M | Draw the lock screen over the app instead of unmounting it |
| AD-02 | Quiet buttons (and Close) are link-coloured text with no underline | 1.4.1 (advisory) | `src/ui/kit.tsx` Button quiet | L | Underline on web, or a border on hover and focus |
| AD-03 | The phone time picker is 24-hour only | Preference | `src/ui/TimeField.tsx` | L | Add an AM/PM segment when the locale uses 12-hour time |
| AD-04 | Week start defaults to Monday everywhere | Preference | migration 0001 default | L | Seed from the locale on first run |
| AD-05 | "5 s" is read as "5 s" by screen readers | 1.3.1 | durations in content | L | Accessible label "5 seconds" next to the short form |
| AD-06 | Screening question count changes as follow-ups appear | 3.2.4 | `ScreeningFlow.tsx` | L | Show "Question n" or the maximum |
| AD-07 | Self-check has no progress bar and no Back between steps | 2.4.8 | `app/selfcheck.tsx` | L | Use `StepProgress` |
| AD-08 | Sync pairing is saved before the numbers are compared | 3.3.4 | `syncService.ts` | M | Keep the peer pending until "They match" |
| AD-09 | Export, import and delete are hidden states of one page; Back leaves the page | 2.4.8 | `app/data.tsx` | L | Make them routes |
| AD-10 | Surgery date is typed as YYYY-MM-DD and bad input disappears | 3.3.1 | `ScreeningFlow.tsx` | M | Date steppers, or an error message |
| AD-11 | Weekly summaries: only the newest one can be opened | 2.4.5 | `app/summary.tsx` | L | List past weeks on Progress |
| AD-12 | Charts have only their title as a text alternative | 1.1.1 | `src/ui/charts.tsx` | M | A summary label with the latest value and target |
| AD-13 | Chart axis text is fixed at 11 px and does not scale | 1.4.4 | `src/ui/charts.tsx` | M | Scale with the font scale, capped at 1.5 |
| AD-14 | Sub-pages (About, Summary) hide the phone tab bar | 2.4.5 | `src/ui/layout.ts` phoneTab | L | Light the parent tab |
| AD-15 | Keyboard focus order and focus after a route change are not tested on the Mac | 2.4.3 | web build | M | Keyboard-only walk-through before release |
| AD-16 | No accessibility statement | EN 301 549 cl. 12 | About, README | L | Short statement, with the portrait-only exception |
| AD-17 | Notification action buttons and channel names are English text in platform code | 3.1 (i18n) | `src/platform/notifications.ts` | L | Move into content (spec 08 texts) |
| AD-18 | Nothing on the phone is tested by hand before a release (vibration, haptics, tab bar, steppers) | – | process | H | Device checklist in `docs/install.md` |

## Closed in 1.3.0

| ID | Gap | WCAG |
|---|---|---|
| AD-C1 | Answer groups and steppers had no accessible name | 1.3.1, 4.1.2 |
| AD-C2 | Warning, error and information banners differed by colour only | 1.4.1 |
| AD-C3 | Status messages (saved, failed) were not announced | 4.1.3 |
| AD-C4 | Group and step titles were not headings | 1.3.1, 2.4.6 |
| AD-C5 | The running session could not scroll at large text | 1.4.4, 1.4.10 |
| AD-C6 | No text size on the Mac | 1.4.4 |
| AD-C7 | Tab labels were cut at large text | 1.4.4 |
| AD-C8 | Big timer numbers grew past their circle | 1.4.4 |
| AD-C9 | The Mac browser tab never named the page | 2.4.2 |
| AD-C10 | Repeated "Start" buttons on Check-ins had no context | 2.4.6 |
| AD-C11 | Reduce motion was read after the first frame | 2.3.3 |
| AD-C12 | Timed self-check kept counting while the phone was locked | 2.2.1 |
| AD-C13 | Learn the squeeze had no sound or vibration | 1.3.3 (sensory) |
| AD-C14 | Voice mode did not say which block was next | 1.3.3 |
| AD-C15 | Back left a running session without asking | 3.3.4 |
| AD-C16 | Copy in screen code escaped the wording checks | 3.1.5 (plain language) |
| AD-C17 | Vibration switch shown on the Mac, where it cannot work | 3.2.4 |
