import { formatTime } from './dates';
import {
  atMinutes,
  buildFireTimes,
  cleanOffsets,
  diffSchedule,
  MAX_SCHEDULED,
  nearest,
  offsetLabel,
  offsetsSummary,
  reconcile,
  signature,
  type FireTime,
  type Pending,
  type Recorded,
  type ReminderEvent,
  type ReminderSettings,
} from './reminders';

// Times are written on the local clock, so the same expectations hold in every zone
// `npm run test:zones` runs. 1 June 2026 is a Monday.

const MIN = 60_000;
const HOUR = 60 * MIN;
const at = (day: number, hour = 0, minute = 0) => new Date(2026, 5, day, hour, minute).getTime();

const SETTINGS: ReminderSettings = {
  defaultOffsets: [1440, 120, 30],
  digestEnabled: true,
  digestTime: 480,
  weeklyPreviewEnabled: true,
  weeklyPreviewTime: 1080,
};
const REMINDERS_ONLY: ReminderSettings = {
  ...SETTINGS,
  digestEnabled: false,
  weeklyPreviewEnabled: false,
};

function event(id: string, startsAt: number, patch: Partial<ReminderEvent> = {}): ReminderEvent {
  return {
    id,
    title: `Event ${id}`,
    startsAt,
    endsAt: startsAt + 2 * HOUR,
    allDay: false,
    locationText: '',
    removedFromSource: false,
    reminderOffsets: null,
    ...patch,
  };
}

function allDay(id: string, day: number, days = 1): ReminderEvent {
  return event(id, at(day), { allDay: true, endsAt: at(day + days) });
}

/** 150 events, two or three a day at 10:00, 14:30 and 19:00, from 2 June on. */
function fakeEvents(count = 150): ReminderEvent[] {
  const slots = [
    [10, 0],
    [14, 30],
    [19, 0],
  ];
  return Array.from({ length: count }, (_, i) => {
    const [hour, minute] = slots[i % 3];
    // Every fifth day has no third event, so days differ.
    return event(`e${i}`, at(2 + Math.floor(i / 3), hour, minute), {
      locationText: i % 2 ? `${i} Alder Row` : '',
    });
  });
}

/** Stands in for the iPhone: holds what is scheduled and counts what was asked of it. */
function fakePhone() {
  const held = new Map<string, FireTime | 'test' | 'foreign'>();
  let nextId = 1;
  let most = 0;
  const phone = {
    scheduled: 0,
    cancelled: 0,
    failNext: 0,
    held,
    get most() {
      return most;
    },
    resetCounts() {
      phone.scheduled = 0;
      phone.cancelled = 0;
    },
    /** Notifications of ours that iOS holds, test ones left out. */
    ours: () => [...held.values()].filter((v): v is FireTime => typeof v === 'object'),
    /** What iOS does by itself as time passes: delivered ones are no longer pending. */
    deliverUntil(now: number) {
      for (const [id, fire] of held) if (typeof fire === 'object' && fire.fireAt <= now) held.delete(id);
    },
    os: {
      pending: async (): Promise<Pending[]> =>
        [...held].map(([osNotificationId, value]) => ({
          osNotificationId,
          ours: value !== 'foreign',
          test: value === 'test',
        })),
      schedule: async (fire: FireTime) => {
        if (phone.failNext > 0) {
          phone.failNext -= 1;
          throw new Error('iOS said no');
        }
        const id = `os-${nextId++}`;
        held.set(id, fire);
        phone.scheduled += 1;
        most = Math.max(most, [...held.values()].filter((v) => v !== 'foreign').length);
        return id;
      },
      cancel: async (id: string) => {
        if (held.delete(id)) phone.cancelled += 1;
      },
    },
  };
  return phone;
}

function fakeStore(rows: Recorded[] = []) {
  return {
    rows,
    list: () => rows,
    replace(next: Recorded[]) {
      rows = next;
      this.rows = next;
    },
  };
}

function setUp() {
  const phone = fakePhone();
  const store = fakeStore();
  const run = (
    events: ReminderEvent[],
    now: number,
    more: { settings?: ReminderSettings; allowed?: boolean; reserve?: number } = {},
  ) =>
    reconcile({
      events,
      settings: more.settings ?? SETTINGS,
      now,
      allowed: more.allowed ?? true,
      os: phone.os,
      store,
      reserve: more.reserve,
    });
  return { phone, store, run };
}

describe('buildFireTimes', () => {
  it('gives each event its three default reminders', () => {
    const fires = buildFireTimes([event('a', at(10, 18, 30))], REMINDERS_ONLY, at(1));
    expect(fires.map((f) => [f.id, f.fireAt])).toEqual([
      ['r:a:1440', at(9, 18, 30)],
      ['r:a:120', at(10, 16, 30)],
      ['r:a:30', at(10, 18, 0)],
    ]);
    expect(fires.every((f) => f.eventId === 'a' && f.kind === 'reminder')).toBe(true);
  });

  it('leaves out anything whose time has passed', () => {
    const fires = buildFireTimes([event('a', at(10, 18, 30))], REMINDERS_ONLY, at(10, 16, 30));
    expect(fires.map((f) => f.id)).toEqual(['r:a:30']);
    expect(buildFireTimes([event('a', at(10, 18, 30))], SETTINGS, at(10, 18, 30))).toEqual([]);
  });

  it("uses an event's own reminders in place of the defaults", () => {
    const own = event('a', at(10, 18), { reminderOffsets: [60] });
    const none = event('b', at(10, 20), { reminderOffsets: [] });
    const usual = event('c', at(10, 22));
    const ids = buildFireTimes([own, none, usual], REMINDERS_ONLY, at(1)).map((f) => f.id);
    expect(ids.filter((id) => id.startsWith('r:a'))).toEqual(['r:a:60']);
    expect(ids.filter((id) => id.startsWith('r:b'))).toEqual([]);
    expect(ids.filter((id) => id.startsWith('r:c'))).toHaveLength(3);
  });

  it('follows the default reminders when they change', () => {
    const settings = { ...REMINDERS_ONLY, defaultOffsets: [15, 15, 0] };
    const fires = buildFireTimes([event('a', at(10, 18))], settings, at(1));
    expect(fires.map((f) => [f.id, f.fireAt])).toEqual([
      ['r:a:15', at(10, 17, 45)],
      ['r:a:0', at(10, 18)],
    ]);
    expect(fires[1].body).toMatch(/^Starting now/);
  });

  it('says how long, when and where', () => {
    const [day, hours] = buildFireTimes(
      [event('a', at(10, 18, 30), { title: 'Rooftop dinner', locationText: '14 Alder Row' })],
      REMINDERS_ONLY,
      at(1),
    );
    expect(day.title).toBe('Rooftop dinner');
    expect(day.body).toMatch(/^In 1 day · /);
    expect(day.body).toContain(formatTime(at(10, 18, 30)));
    expect(hours.body).toBe(`In 2 hours · ${formatTime(at(10, 18, 30))} · 14 Alder Row`);
  });

  it('reminds of an all-day event from 9:00 AM, and only a day or more ahead', () => {
    const fires = buildFireTimes([allDay('a', 10)], REMINDERS_ONLY, at(1));
    expect(fires.map((f) => [f.id, f.fireAt])).toEqual([['r:a:1440', at(9, 9)]]);
    expect(fires[0].body).toContain('All day');
  });

  it('skips events their calendar no longer has', () => {
    const gone = event('a', at(10, 18), { removedFromSource: true });
    expect(buildFireTimes([gone], SETTINGS, at(1))).toEqual([]);
  });

  it('adds a morning digest on each day that has events', () => {
    const events = [event('a', at(10, 18, 30)), event('b', at(10, 12)), event('c', at(12, 9))];
    const digests = buildFireTimes(events, SETTINGS, at(1)).filter((f) => f.kind === 'digest');
    expect(digests.map((f) => f.fireAt)).toEqual([at(10, 8), at(12, 8)]);
    expect(digests[0].title).toBe('2 events today');
    expect(digests[0].body).toBe(`First at ${formatTime(at(10, 12))}: Event b`);
    expect(digests[1].title).toBe('1 event today');
    expect(digests[1].body).toBe(`Event c at ${formatTime(at(12, 9))}`);
    expect(digests.every((f) => f.eventId === null)).toBe(true);
  });

  it('moves the digest with its time, and drops it when it is off', () => {
    const events = [event('a', at(10, 18))];
    const late = buildFireTimes(events, { ...SETTINGS, digestTime: 9 * 60 + 15 }, at(1));
    expect(late.find((f) => f.kind === 'digest')?.fireAt).toBe(at(10, 9, 15));
    const off = buildFireTimes(events, { ...SETTINGS, digestEnabled: false }, at(1));
    expect(off.some((f) => f.kind === 'digest')).toBe(false);
  });

  it('counts an all-day event in the digest of each of its days', () => {
    const digests = buildFireTimes([allDay('a', 10, 3), event('b', at(11, 19))], SETTINGS, at(1))
      .filter((f) => f.kind === 'digest');
    expect(digests.map((f) => [f.fireAt, f.title])).toEqual([
      [at(10, 8), '1 event today'],
      [at(11, 8), '2 events today'],
      [at(12, 8), '1 event today'],
    ]);
    expect(digests[0].body).toBe('Event a, all day');
  });

  it("previews the coming week on Sunday evening, Monday through Sunday", () => {
    // 7 June 2026 is a Sunday; the week it previews is 8 to 14 June.
    const events = [
      event('sun', at(7, 12)),
      event('mon', at(8, 9)),
      event('nextSun', at(14, 20)),
      event('after', at(15, 9)),
    ];
    const weekly = buildFireTimes(events, SETTINGS, at(1)).filter((f) => f.kind === 'weekly');
    // The event on Sunday the 7th belongs to the preview of 31 May, already past.
    expect(weekly.map((f) => [f.fireAt, f.title])).toEqual([
      [at(7, 18), '2 events this coming week'],
      [at(14, 18), '1 event this coming week'],
    ]);
    expect(weekly[0].body).toMatch(/^First: Event mon · /);
    const off = buildFireTimes(events, { ...SETTINGS, weeklyPreviewEnabled: false }, at(1));
    expect(off.some((f) => f.kind === 'weekly')).toBe(false);
    const earlier = buildFireTimes(events, { ...SETTINGS, weeklyPreviewTime: 17 * 60 }, at(1));
    expect(earlier.find((f) => f.kind === 'weekly')?.fireAt).toBe(at(7, 17));
  });

  it('comes back soonest first with no id twice', () => {
    const fires = buildFireTimes(fakeEvents(), SETTINGS, at(1));
    expect(fires.map((f) => f.fireAt)).toEqual([...fires.map((f) => f.fireAt)].sort((a, b) => a - b));
    expect(new Set(fires.map((f) => f.id)).size).toBe(fires.length);
  });
});

describe('wording', () => {
  it('names an offset', () => {
    expect([5, 30, 60, 120, 1440, 2880, 10080, 90].map(offsetLabel)).toEqual([
      '5 minutes',
      '30 minutes',
      '1 hour',
      '2 hours',
      '1 day',
      '2 days',
      '1 week',
      '90 minutes',
    ]);
  });

  it('sums up a set of reminders', () => {
    expect(offsetsSummary([30, 1440, 120])).toBe('1 day, 2 hours and 30 minutes before');
    expect(offsetsSummary([60])).toBe('1 hour before');
    expect(offsetsSummary([0])).toBe('At the start');
    expect(offsetsSummary([0, 60])).toBe('1 hour and at the start');
    expect(offsetsSummary([])).toBe('None');
  });

  it('tidies offsets', () => {
    expect(cleanOffsets([120, 30, 30, -5, 1.5, 0])).toEqual([0, 30, 120]);
  });

  it('finds a time of day', () => {
    expect(atMinutes(at(10, 15, 42), 480)).toBe(at(10, 8));
  });
});

describe('diffSchedule', () => {
  const fire = (id: string, fireAt: number, title = id): FireTime => ({
    id,
    eventId: null,
    kind: 'reminder',
    fireAt,
    title,
    body: '',
  });
  const row = (f: FireTime, osNotificationId: string): Recorded => ({
    id: f.id,
    eventId: f.eventId,
    kind: f.kind,
    fireAt: f.fireAt,
    osNotificationId,
    signature: signature(f),
  });
  const held = (osNotificationId: string, more: Partial<Pending> = {}): Pending => ({
    osNotificationId,
    ours: true,
    test: false,
    ...more,
  });

  it('leaves alone what is already right', () => {
    const a = fire('a', 100);
    expect(diffSchedule([a], [row(a, 'os-1')], [held('os-1')])).toEqual({
      keep: [row(a, 'os-1')],
      add: [],
      cancel: [],
    });
  });

  it('replaces one whose time or wording changed', () => {
    const before = fire('a', 100);
    for (const after of [fire('a', 200), fire('a', 100, 'Renamed')]) {
      const diff = diffSchedule([after], [row(before, 'os-1')], [held('os-1')]);
      expect(diff).toEqual({ keep: [], add: [after], cancel: ['os-1'] });
    }
  });

  it('cancels what is no longer wanted and adds what is new', () => {
    const a = fire('a', 100);
    const b = fire('b', 200);
    expect(diffSchedule([b], [row(a, 'os-1')], [held('os-1')])).toEqual({
      keep: [],
      add: [b],
      cancel: ['os-1'],
    });
  });

  it('schedules again one that iOS has lost', () => {
    const a = fire('a', 100);
    expect(diffSchedule([a], [row(a, 'os-1')], [])).toEqual({ keep: [], add: [a], cancel: [] });
  });

  it('forgets one that has fired without cancelling anything', () => {
    const a = fire('a', 100);
    expect(diffSchedule([], [row(a, 'os-1')], [])).toEqual({ keep: [], add: [], cancel: [] });
  });

  it('cancels one of ours the table lost track of, and nothing else', () => {
    const pending = [held('lost'), held('test', { test: true }), held('other', { ours: false })];
    expect(diffSchedule([], [], pending).cancel).toEqual(['lost']);
  });
});

describe('the scheduler with 150 events', () => {
  const events = fakeEvents();
  const now = at(1);

  it('has far more to schedule than iOS will hold', () => {
    const all = buildFireTimes(events, SETTINGS, now);
    // 150 events with three reminders each, 50 days with a digest, and a preview on
    // each of the 7 Sundays from 7 June to 19 July.
    expect(all.length).toBe(450 + 50 + 7);
  });

  it('schedules only the nearest 60 and records each one', async () => {
    const { phone, store, run } = setUp();
    const result = await run(events, now);
    const all = buildFireTimes(events, SETTINGS, now);
    expect(result).toEqual({ planned: all.length, scheduled: 60, added: 60, cancelled: 0 });
    expect(phone.ours().map((f) => f.id).sort()).toEqual(nearest(all).map((f) => f.id).sort());
    // Nothing left out fires before anything scheduled.
    const last = Math.max(...phone.ours().map((f) => f.fireAt));
    expect(all.slice(MAX_SCHEDULED).every((f) => f.fireAt >= last)).toBe(true);
    expect(store.rows).toHaveLength(60);
    expect(new Set(store.rows.map((r) => r.osNotificationId)).size).toBe(60);
    for (const recorded of store.rows) {
      const fire = phone.held.get(recorded.osNotificationId);
      expect(fire).toMatchObject({ id: recorded.id, fireAt: recorded.fireAt });
    }
    expect([...new Set(store.rows.map((r) => r.kind))].sort()).toEqual(['digest', 'reminder']);
    // Sunday's preview is not among the nearest 60 on Monday. By Friday it is.
    phone.deliverUntil(at(5));
    await run(events, at(5));
    expect(store.rows.filter((r) => r.kind === 'weekly').map((r) => r.fireAt)).toEqual([at(7, 18)]);
  });

  it('does nothing when run again', async () => {
    const { phone, store, run } = setUp();
    await run(events, now);
    const before = [...store.rows];
    phone.resetCounts();
    const again = await run(events, now);
    expect(again).toMatchObject({ scheduled: 60, added: 0, cancelled: 0 });
    expect([phone.scheduled, phone.cancelled]).toEqual([0, 0]);
    expect(store.rows).toEqual(before);
  });

  it('rolls the window forward as notifications fire, cancelling nothing', async () => {
    const { phone, store, run } = setUp();
    await run(events, now);
    const later = at(4, 12);
    phone.deliverUntil(later);
    const fired = 60 - phone.held.size;
    expect(fired).toBeGreaterThan(5);
    phone.resetCounts();
    const result = await run(events, later);
    expect(result).toMatchObject({ scheduled: 60, added: fired, cancelled: 0 });
    expect([phone.scheduled, phone.cancelled]).toEqual([fired, 0]);
    expect(store.rows.every((r) => r.fireAt > later)).toBe(true);
    expect(phone.ours().map((f) => f.id).sort()).toEqual(
      nearest(buildFireTimes(events, SETTINGS, later)).map((f) => f.id).sort(),
    );
  });

  it('replaces only the reminders of an event that was edited', async () => {
    const { phone, run } = setUp();
    await run(events, now);
    // e1 is at 14:30 on 2 June: its 2-hour and 30-minute reminders are in the window
    // (the day-before one would have fired at 14:30 on 1 June, also ahead of `now`).
    const renamed = events.map((e) => (e.id === 'e1' ? { ...e, title: 'Renamed' } : e));
    const inWindow = phone.ours().filter((f) => f.eventId === 'e1').length;
    expect(inWindow).toBe(3);
    phone.resetCounts();
    const result = await run(renamed, now);
    expect(result).toMatchObject({ scheduled: 60, added: 3, cancelled: 3 });
    expect([phone.scheduled, phone.cancelled]).toEqual([3, 3]);
    expect(phone.ours().filter((f) => f.eventId === 'e1').every((f) => f.title === 'Renamed')).toBe(true);
  });

  it('moves an event that was moved, and lets the next in line take a freed place', async () => {
    const { phone, run } = setUp();
    await run(events, now);
    // Put e1 months away: its three leave the window and three later ones come in.
    const moved = events.map((e) => (e.id === 'e1' ? event('e1', at(200, 10)) : e));
    phone.resetCounts();
    const result = await run(moved, now);
    expect(result.scheduled).toBe(60);
    expect(phone.ours().some((f) => f.eventId === 'e1')).toBe(false);
    // Its day's digest now counts one event fewer, so that is replaced too.
    expect([phone.scheduled, phone.cancelled]).toEqual([4, 4]);
  });

  it('drops the reminders of a deleted event', async () => {
    const { phone, run } = setUp();
    await run(events, now);
    phone.resetCounts();
    const result = await run(events.filter((e) => e.id !== 'e0'), now);
    expect(result.scheduled).toBe(60);
    expect(phone.ours().some((f) => f.eventId === 'e0')).toBe(false);
    expect(phone.cancelled).toBe(phone.scheduled);
  });

  it('follows a change to the default reminders', async () => {
    const { phone, run } = setUp();
    await run(events, now);
    phone.resetCounts();
    const settings = { ...SETTINGS, defaultOffsets: [1440, 120, 15] };
    const result = await run(events, now, { settings });
    expect(result.scheduled).toBe(60);
    // The 30-minute reminders go and 15-minute ones come; day and 2-hour ones stay.
    expect(phone.ours().some((f) => f.id.endsWith(':30'))).toBe(false);
    expect(phone.ours().some((f) => f.id.endsWith(':15'))).toBe(true);
    expect(phone.scheduled).toBeLessThan(30);
    expect(phone.cancelled).toBeLessThan(30);
  });

  it('follows a change to the digest time without touching the reminders', async () => {
    const { phone, run } = setUp();
    await run(events, now);
    const digests = phone.ours().filter((f) => f.kind === 'digest').length;
    phone.resetCounts();
    await run(events, now, { settings: { ...SETTINGS, digestTime: 7 * 60 } });
    const kept = phone.ours().filter((f) => f.kind === 'digest');
    expect(kept.every((f) => new Date(f.fireAt).getHours() === 7)).toBe(true);
    // Each digest in the window is replaced; an earlier digest can push one reminder
    // out of the far end and pull nothing new in.
    expect(phone.cancelled).toBeGreaterThanOrEqual(digests);
    expect(phone.cancelled).toBeLessThanOrEqual(digests + 2);
  });

  it('never has iOS hold more than 60, whatever happens', async () => {
    const { phone, run } = setUp();
    let time = now;
    let current = events;
    for (let step = 0; step < 40; step++) {
      time += 7 * HOUR;
      phone.deliverUntil(time);
      // Something changes on most steps: a rename, a move, a deletion, a setting.
      if (step % 4 === 0) current = current.map((e, i) => (i === step ? { ...e, title: `v${step}` } : e));
      if (step % 4 === 1) current = current.filter((_, i) => i !== step);
      if (step % 4 === 2) current = current.map((e, i) => (i === step + 3 ? { ...e, reminderOffsets: [10, 5] } : e));
      const settings = step % 4 === 3 ? { ...SETTINGS, defaultOffsets: [60 + step] } : SETTINGS;
      const result = await run(current, time, { settings });
      expect(result.scheduled).toBeLessThanOrEqual(MAX_SCHEDULED);
      expect(phone.ours().length).toBe(result.scheduled);
    }
    expect(phone.most).toBe(MAX_SCHEDULED);
  });

  it('schedules everything when there is less than a window of it', async () => {
    const { phone, run } = setUp();
    const few = events.slice(0, 5);
    const result = await run(few, now);
    expect(result.scheduled).toBe(result.planned);
    expect(phone.ours()).toHaveLength(result.planned);
    expect(result.planned).toBeLessThan(MAX_SCHEDULED);
  });

  it('cancels everything when notifications are not allowed', async () => {
    const { phone, store, run } = setUp();
    await run(events, now);
    const result = await run(events, now, { allowed: false });
    expect(result).toMatchObject({ planned: 0, scheduled: 0, cancelled: 60 });
    expect(phone.held.size).toBe(0);
    expect(store.rows).toEqual([]);
  });

  it('leaves a place for a test notification, and takes it back afterwards', async () => {
    const { phone, run } = setUp();
    await run(events, now);
    expect((await run(events, now, { reserve: 1 })).scheduled).toBe(59);
    phone.held.set('test-1', 'test');
    // While the test is waiting, a run in between keeps to 59 without being told.
    expect((await run(events, now)).scheduled).toBe(59);
    expect(phone.held.size).toBe(60);
    expect(phone.held.has('test-1')).toBe(true);
    phone.held.delete('test-1');
    expect((await run(events, now)).scheduled).toBe(60);
  });

  it("never touches another app's notifications", async () => {
    const { phone, run } = setUp();
    phone.held.set('someone-else', 'foreign');
    await run(events, now);
    await run([], now);
    expect([...phone.held.keys()]).toEqual(['someone-else']);
  });

  it('recovers when the table is lost but iOS still holds the notifications', async () => {
    const { phone, store, run } = setUp();
    await run(events, now);
    store.replace([]);
    const result = await run(events, now);
    // The 60 it can no longer account for are cancelled and scheduled afresh: never 120.
    expect(result).toMatchObject({ scheduled: 60, added: 60, cancelled: 60 });
    expect(phone.ours()).toHaveLength(60);
    expect(phone.most).toBe(60);
  });

  it('tries again next time when iOS refuses one', async () => {
    const { phone, store, run } = setUp();
    phone.failNext = 2;
    expect((await run(events, now)).scheduled).toBe(58);
    expect(store.rows).toHaveLength(58);
    expect(await run(events, now)).toMatchObject({ scheduled: 60, added: 2, cancelled: 0 });
  });
});
