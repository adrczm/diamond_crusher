// Confirmation dialogs. React Native's Alert does nothing in a browser, so the web version uses the browser's own
// confirm box, which offers Cancel and OK: OK runs the first button that isn't "cancel".
import { Alert as RNAlert, Platform, type AlertButton } from 'react-native';

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    if (Platform.OS !== 'web') return RNAlert.alert(title, message, buttons);
    const action = buttons?.find((b) => b.style !== 'cancel');
    const text = message ? `${title}\n\n${message}` : title;
    if (!action) return void window.alert(text);
    if (window.confirm(text)) void action.onPress?.();
    else buttons?.find((b) => b.style === 'cancel')?.onPress?.();
  },
};
