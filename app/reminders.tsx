// Reminders settings (08 REM-001 to REM-024; 09 ARCH-041 to ARCH-049). The content is RemindersContent, which Settings
// also shows in its right panel on the widest Mac layout (Q3).
import { SETTINGS } from '../src/content/en/strings';
import { RemindersContent } from '../src/features/screens/RemindersContent';
import { Screen } from '../src/ui/kit';

export default function RemindersScreen() {
  return (
    <Screen title={SETTINGS.reminders}>
      <RemindersContent />
    </Screen>
  );
}
