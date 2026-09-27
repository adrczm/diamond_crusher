// Wording for the web version (Safari on a Mac). Applied once at start-up on the web only; phones keep the main text.
import { DATA, ONBOARDING, PLAN, SETTINGS, UNREADABLE } from './strings';

export function applyWebWording() {
  Object.assign(ONBOARDING, {
    lockUnavailable: 'The app lock is available on phones only. On a Mac, your login password protects this browser.',
    welcomeBody: 'Pelvic floor training and tracking that stays in this browser. No account. Nothing leaves your Mac unless you export it.',
  });
  Object.assign(PLAN, {
    permissionWhy: 'Reminders need permission to show notifications. You can change this at any time.',
    testFix: [
      'Allow notifications for this site in Safari: Safari, Settings, Websites, Notifications.',
      'Reminders show only while Diamond Crusher is open, in a Safari tab or in the Dock.',
    ],
    mayBeLate: 'On a Mac, reminders show only while Diamond Crusher is open in Safari or in the Dock.',
  });
  Object.assign(DATA, {
    where: 'The app keeps your data only in this browser on this Mac, encrypted. The browser’s storage for this site holds the key.',
    leavesTitle: 'What leaves your Mac',
    leaves: 'Nothing, unless you export a backup file or sync by code with your other device. The page loads only its own files. It has no account, no ads and no tracking.',
    backupsTitle: 'Browser data',
    backups: 'If you clear website data in Safari, you erase the app’s data. Save a backup file often. Use a backup file to move to another device.',
    replaceNote: 'The file replaces everything in this browser.',
    keepPhone: 'This Mac',
    deleteBody: 'This erases all app data in this browser and cancels all reminders. You cannot undo this.',
    updateNote: 'Save a backup file before you replace the app folder with a newer download.',
    noBackupWarn: 'No backup file yet. If Safari clears its website data, you lose all your records.',
  });
  // Appearance on a Mac follows the Mac's own setting, not a phone's.
  SETTINGS.themeOptions[0] = { value: 'system', label: 'Match Mac' };
  Object.assign(UNREADABLE, {
    body: 'The app cannot read the data in this browser. This can happen if Safari cleared part of the website data.',
  });
}
