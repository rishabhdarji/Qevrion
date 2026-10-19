import type { QevrionEvent } from '../types';
import { dayStart, startOfDay } from './dates';
import {
  draftToFields,
  eventToDraft,
  moveStart,
  newDraft,
  validateDraft,
  type EventDraft,
} from './eventDraft';

const HOUR = 3_600_000;
const evening = new Date(2026, 9, 17, 19).getTime();

const draft = (patch: Partial<EventDraft> = {}): EventDraft => ({
  title: 'Dinner',
  allDay: false,
  start: evening,
  end: evening + 2 * HOUR,
  locationText: '',
  host: '',
  url: '',
  notes: '',
  photo: null,
  place: null,
  ...patch,
});

describe('newDraft', () => {
  it('starts on the next full hour of the local clock and runs two hours', () => {
    const fresh = newDraft(new Date(2026, 9, 17, 18, 20).getTime());
    expect(fresh.start).toBe(evening);
    expect(fresh.end).toBe(evening + 2 * HOUR);
    expect(newDraft(evening).start).toBe(evening + HOUR);
  });
});

describe('validateDraft', () => {
  it('passes a titled event that ends after it starts', () => {
    expect(validateDraft(draft())).toEqual({});
  });

  it('wants a title that is more than spaces', () => {
    expect(validateDraft(draft({ title: '   ' }))).toHaveProperty('title');
  });

  it('wants a start', () => {
    expect(validateDraft(draft({ start: NaN }))).toHaveProperty('start');
  });

  it('wants the end after the start, not at it or before it', () => {
    expect(validateDraft(draft({ end: evening }))).toHaveProperty('end');
    expect(validateDraft(draft({ end: evening - HOUR }))).toHaveProperty('end');
  });

  it('lets an all-day event start and end on the same day, but not end earlier', () => {
    expect(validateDraft(draft({ allDay: true, end: evening - 5 * HOUR }))).toEqual({});
    expect(validateDraft(draft({ allDay: true, end: evening - 24 * HOUR }))).toHaveProperty('end');
  });
});

describe('draftToFields', () => {
  it('trims text and leaves an empty link empty', () => {
    const fields = draftToFields(draft({ title: '  Dinner ', locationText: ' 14 Alder Row ', url: ' ' }));
    expect(fields).toMatchObject({ title: 'Dinner', locationText: '14 Alder Row', url: null });
    expect(fields).toMatchObject({ startsAt: evening, endsAt: evening + 2 * HOUR, allDay: false });
  });

  it('makes a bare address into a link and leaves a full one alone', () => {
    expect(draftToFields(draft({ url: 'partiful.com/e/abc' })).url).toBe('https://partiful.com/e/abc');
    expect(draftToFields(draft({ url: 'http://example.com' })).url).toBe('http://example.com');
  });

  it('keeps a picked address with where it is, but only while the field still holds it', () => {
    const place = { full: '350 5th Avenue, New York, NY', lat: 40.7484, lng: -73.9857 };
    const picked = draftToFields(draft({ locationText: ' 350 5th Avenue, New York, NY ', place }));
    expect(picked.place).toEqual({ lat: 40.7484, lng: -73.9857 });
    // Typed over afterwards: the address is looked up again as usual.
    const changed = draftToFields(draft({ locationText: '350 5th Avenue, Floor 86', place }));
    expect(changed.place).toBeUndefined();
    expect(draftToFields(draft({ locationText: '14 Alder Row' })).place).toBeUndefined();
  });

  it('saves an all-day event from the start of its first day to the end of its last', () => {
    const fields = draftToFields(draft({ allDay: true, end: evening + 48 * HOUR }));
    expect(fields.startsAt).toBe(startOfDay(2026, 9, 17));
    expect(fields.endsAt).toBe(startOfDay(2026, 9, 20));
  });
});

describe('eventToDraft', () => {
  it('opens an all-day event on its last day, not the day after', () => {
    const fields = draftToFields(draft({ allDay: true, end: evening + 48 * HOUR }));
    const opened = eventToDraft({ ...fields, url: 'https://example.com' } as QevrionEvent);
    expect(opened.end).toBe(startOfDay(2026, 9, 19));
    expect(opened.url).toBe('https://example.com');
    // Saving it again without touching anything changes nothing.
    expect(draftToFields(opened)).toMatchObject({ startsAt: fields.startsAt, endsAt: fields.endsAt });
  });
});

describe('moveStart', () => {
  it('carries the end along so a timed event keeps its length', () => {
    const moved = moveStart(draft(), evening + 3 * HOUR);
    expect(moved.end - moved.start).toBe(2 * HOUR);
  });

  it('moves an all-day event by whole days, across every clock change of the year', () => {
    for (let day = 1; day <= 365; day++) {
      const first = startOfDay(2026, 0, day);
      // A two-day event, moved one day later.
      const moved = moveStart(draft({ allDay: true, start: first, end: dayStart(first, 1) }), dayStart(first, 1));
      expect(dayStart(moved.end)).toBe(startOfDay(2026, 0, day + 2));
    }
  });
});
