// Web build of reminders (Safari on a Mac). Browsers can't schedule a notification for later, so reminders are timers
// that fire while the app is open (in a tab or added to the Dock). Nothing goes through a push server (ARCH-040).
import type { PlannedNotification } from '../domain/reminders';

export const CATEGORY_SESSION = 'dc_session';
export const ACTION_START = 'start';
export const ACTION_SNOOZE = 'snooze';
export const ACTION_DONE = 'done_already';

export type Permission = 'granted' | 'denied' | 'undetermined';

export interface Scheduled {
  id: string;
  key: string | null;
}

export interface Response {
  action: string;
  data: Record<string, unknown>;
  title: string;
  body: string;
}

// setTimeout can't wait longer than about 24.8 days.
const MAX_DELAY = 2 ** 31 - 1;

const timers = new Map<string, { key: string | null; handle: ReturnType<typeof setTimeout> }>();
const listeners = new Set<(r: Response) => void>();

function supported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

function show(title: string, body: string, data: Record<string, unknown>) {
  if (!supported() || Notification.permission !== 'granted') return;
  const n = new Notification(title, { body, tag: String(data.key ?? '') });
  n.onclick = () => {
    window.focus();
    n.close();
    for (const cb of listeners) cb({ action: ACTION_START, data, title, body });
  };
}

function later(id: string, key: string | null, at: number, fire: () => void) {
  const delay = Math.max(0, at - Date.now());
  if (delay > MAX_DELAY) return;
  cancelTimer(id);
  timers.set(id, {
    key,
    handle: setTimeout(() => {
      timers.delete(id);
      fire();
    }, delay),
  });
}

function cancelTimer(id: string) {
  const t = timers.get(id);
  if (t) clearTimeout(t.handle);
  timers.delete(id);
}

export async function configureNotifications(_lockScreen: 'private' | 'secret'): Promise<void> {
  // No channels or lock screen on the web.
}

export async function getPermission(): Promise<Permission> {
  if (!supported()) return 'denied';
  return Notification.permission === 'granted' ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'undetermined';
}

export async function requestPermission(): Promise<Permission> {
  if (!supported()) return 'denied';
  const p = await Notification.requestPermission();
  return p === 'granted' ? 'granted' : p === 'denied' ? 'denied' : 'undetermined';
}

export async function listScheduled(): Promise<Scheduled[]> {
  return [...timers.entries()].map(([id, t]) => ({ id, key: t.key }));
}

export async function schedule(n: PlannedNotification): Promise<string> {
  const id = n.key.replace(/[^A-Za-z0-9_-]/g, '_');
  const data = { key: n.key, kind: n.kind, reminderId: n.reminderId, slotNo: n.slotNo, at: n.at.toISOString() };
  later(id, n.key, n.at.getTime(), () => show(n.title, n.body, data));
  return id;
}

export async function cancel(id: string): Promise<void> {
  cancelTimer(id);
}

export async function cancelAll(): Promise<void> {
  for (const id of [...timers.keys()]) cancelTimer(id);
}

/** REM-013: test notification after 10 s. */
export async function sendTest(): Promise<void> {
  later('test', 'test', Date.now() + 10_000, () => show('Diamond Crusher', 'Test reminder. It works.', { key: 'test', kind: 'test' }));
}

/** Snooze: a one-off 30 minutes from now (REM-015). */
export async function snooze(data: Record<string, unknown>, title: string, body: string): Promise<void> {
  const key = `snooze:${Date.now()}`;
  later(key.replace(':', '_'), key, Date.now() + 30 * 60_000, () => show(title, body, { ...data, key }));
}

export function onResponse(cb: (r: Response) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function lastResponse(): Promise<Response | null> {
  return null;
}
