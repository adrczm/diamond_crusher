// Wording for the web version (Safari on a Mac). Applied once at start-up on the web only; phones keep the main text.
import { DATA, ONBOARDING, PLAN, SETTINGS, UNREADABLE } from './strings';

export function applyWebWording() {
  Object.assign(ONBOARDING, {
    lockUnavailable: 'The app lock is on phones only. On a Mac, your login password protects this browser.',
    welcomeBody: 'Pelvic floor training and tracking, private to this browser. No account, and nothing leaves your Mac unless you export it.',
  });
  Object.assign(PLAN, {
    permissionWhy: 'Reminders need permission to show notifications. You can change this any time.',
    testFix: [
      'Allow notifications for this site in Safari: Safari, Settings, Websites, Notifications.',
      'Reminders only show while Diamond Crusher is open, in a Safari tab or added to the Dock.',
    ],
    mayBeLate: 'On a Mac, reminders only show while Diamond Crusher is open in Safari or in the Dock.',
  });
  Object.assign(DATA, {
    where: 'Only in this browser on this Mac, encrypted. The key is held in the browser’s storage for this site.',
    leavesTitle: 'What leaves your Mac',
    leaves: 'Nothing, unless you export a backup file. The page only loads its own files: no account, no ads and no tracking.',
    backupsTitle: 'Browser data',
    backups: 'Clearing website data in Safari erases the app’s data. Save a backup file regularly, and use one to move to another device.',
    replaceNote: 'Everything in this browser is replaced by the file.',
    keepPhone: 'This Mac',
    deleteBody: 'This erases everything in the app in this browser and cancels all reminders. It can’t be undone.',
    updateNote: 'Before replacing the app folder with a newer download, save a backup file first.',
  });
  // Appearance on a Mac follows the Mac's own setting, not a phone's.
  SETTINGS.themeOptions[0] = { value: 'system', label: 'Match Mac' };
  Object.assign(UNREADABLE, {
    body: 'The data in this browser can’t be read, for example after website data was partly cleared.',
  });
}
