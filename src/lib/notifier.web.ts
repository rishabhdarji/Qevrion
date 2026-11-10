import { useEffect } from 'react';

import type * as Phone from './notifier';

// The desktop web preview's stand-in for notifier.ts; the iPhone never loads this file.
// A browser tab cannot hold scheduled notifications, so here they live in memory: the
// scheduler, the settings and the debug panel can all be looked at, and the test
// notification "arrives" as a browser question whose OK stands for the tap.

type Item = Phone.Held & { body: string; eventId: string | null };

let access: Phone.ReminderAccess = 'ask';
let items: Item[] = [];
let nextId = 1;
const delivered = new Set<() => void>();
let tapped: ((tap: Phone.Tap) => void) | null = null;

export const readAccess: typeof Phone.readAccess = async () => access;

export const requestAccess: typeof Phone.requestAccess = async () => {
  if (access === 'ask') {
    access = window.confirm('Preview: allow Qevrion to send notifications?') ? 'granted' : 'denied';
  }
  return access;
};

export const held: typeof Phone.held = async () => {
  // What the iPhone would have delivered by now is no longer waiting.
  items = items.filter((item) => item.fireAt === null || item.fireAt > Date.now());
  return [...items].sort((a, b) => (a.fireAt ?? Infinity) - (b.fireAt ?? Infinity));
};

function add(item: Omit<Item, 'osNotificationId' | 'ours'>): string {
  const osNotificationId = `preview-${nextId++}`;
  items.push({ ...item, osNotificationId, ours: true });
  return osNotificationId;
}

export const schedule: typeof Phone.schedule = async (fire) =>
  add({ test: false, title: fire.title, body: fire.body, fireAt: fire.fireAt, kind: fire.kind, eventId: fire.eventId });

export const scheduleTest: typeof Phone.scheduleTest = async (content, seconds) => {
  const id = add({ test: true, ...content, fireAt: Date.now() + seconds * 1000, kind: 'test' });
  setTimeout(() => {
    items = items.filter((item) => item.osNotificationId !== id);
    delivered.forEach((listener) => listener());
    if (window.confirm(`${content.title}\n${content.body}\n\nOK stands for tapping it.`)) {
      tapped?.({ eventId: content.eventId });
    }
  }, seconds * 1000);
  return id;
};

export const cancel: typeof Phone.cancel = async (osNotificationId) => {
  items = items.filter((item) => item.osNotificationId !== osNotificationId);
};

export const onDelivered: typeof Phone.onDelivered = (listener) => {
  delivered.add(listener);
};

export const useNotificationTap: typeof Phone.useNotificationTap = (onTap) => {
  useEffect(() => {
    tapped = onTap;
    return () => {
      tapped = null;
    };
  }, [onTap]);
};
