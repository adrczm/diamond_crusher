// Local notifications only: no push token, no server (ARCH-040, REM-010).
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { PlannedNotification } from '../domain/reminders';

export const CATEGORY_SESSION = 'dc_session';
export const ACTION_START = 'start';
export const ACTION_SNOOZE = 'snooze';
export const ACTION_DONE = 'done_already';

export type Permission = 'granted' | 'denied' | 'undetermined';

let configured = false;

/** ARCH-048: neutral channels, private on the lock screen. REM-022: optional "hide on lock screen". */
export async function configureNotifications(lockScreen: 'private' | 'secret'): Promise<void> {
  if (!configured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
    await Notifications.setNotificationCategoryAsync(CATEGORY_SESSION, [
      { identifier: ACTION_START, buttonTitle: 'Start', options: { opensAppToForeground: true } },
      { identifier: ACTION_SNOOZE, buttonTitle: 'Snooze 30 min', options: { opensAppToForeground: true } },
      { identifier: ACTION_DONE, buttonTitle: 'Done already', options: { opensAppToForeground: true } },
    ]);
    configured = true;
  }
  if (Platform.OS === 'android') {
    const visibility =
      lockScreen === 'secret' ? Notifications.AndroidNotificationVisibility.SECRET : Notifications.AndroidNotificationVisibility.PRIVATE;
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      lockscreenVisibility: visibility,
      showBadge: false,
    });
    await Notifications.setNotificationChannelAsync('checks', {
      name: 'Checks',
      importance: Notifications.AndroidImportance.LOW,
      lockscreenVisibility: visibility,
      showBadge: false,
    });
  }
}

export async function getPermission(): Promise<Permission> {
  const p = await Notifications.getPermissionsAsync();
  return p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
}

export async function requestPermission(): Promise<Permission> {
  const p = await Notifications.requestPermissionsAsync();
  return p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
}

export interface Scheduled {
  id: string;
  key: string | null;
}

export async function listScheduled(): Promise<Scheduled[]> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all.map((n) => ({ id: n.identifier, key: (n.content.data?.key as string | undefined) ?? null }));
}

export async function schedule(n: PlannedNotification): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    identifier: n.key.replace(/[^A-Za-z0-9_-]/g, '_'),
    content: {
      title: n.title,
      body: n.body,
      data: { key: n.key, kind: n.kind, reminderId: n.reminderId, slotNo: n.slotNo, at: n.at.toISOString() },
      categoryIdentifier: n.kind === 'session' ? CATEGORY_SESSION : undefined,
      sound: false,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: n.at, channelId: n.channel },
  });
}

export async function cancel(id: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(id);
}

export async function cancelAll(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.dismissAllNotificationsAsync();
}

/** REM-013 / ARCH-050: test notification after 10 s. */
export async function sendTest(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Diamond Crusher', body: 'Test reminder. It works.', data: { key: 'test', kind: 'test' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 10, channelId: 'reminders' },
  });
}

/** Snooze: a one-off 30 minutes from now (REM-015). */
export async function snooze(data: Record<string, unknown>, title: string, body: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: { ...data, key: `snooze:${Date.now()}` }, categoryIdentifier: CATEGORY_SESSION },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 30 * 60, channelId: 'reminders' },
  });
}

export interface Response {
  action: string;
  data: Record<string, unknown>;
  title: string;
  body: string;
}

function toResponse(r: Notifications.NotificationResponse): Response {
  const action = r.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER ? ACTION_START : r.actionIdentifier;
  return {
    action,
    data: (r.notification.request.content.data ?? {}) as Record<string, unknown>,
    title: r.notification.request.content.title ?? '',
    body: r.notification.request.content.body ?? '',
  };
}

export function onResponse(cb: (r: Response) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((r) => cb(toResponse(r)));
  return () => sub.remove();
}

export async function lastResponse(): Promise<Response | null> {
  const r = await Notifications.getLastNotificationResponseAsync();
  if (!r) return null;
  await Notifications.clearLastNotificationResponseAsync();
  return toResponse(r);
}
