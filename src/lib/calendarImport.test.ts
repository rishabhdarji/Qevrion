import { collect, isPartifulEvent, toImported, type CalendarEvent } from './calendarImport';
import { startOfDay } from './dates';

// Invented events in the shape the iPhone calendar hands over. Times are written with
// local clock times, as iOS gives them, so every expectation holds in any time zone;
// `npm run test:zones` runs six.

const local = (...date: [number, number, number, number?, number?, number?]) =>
  new Date(...date).toISOString();
const evening = local(2026, 9, 17, 19);

const raw = (extra: CalendarEvent = {}): CalendarEvent => ({
  id: 'event-1',
  calendarId: 'calendar-1',
  title: 'Rooftop dinner',
  location: 'The Glasshouse',
  notes: 'Bring a jumper.',
  startDate: evening,
  endDate: local(2026, 9, 17, 22),
  allDay: false,
  recurrenceRule: null,
  status: 'confirmed' as CalendarEvent['status'],
  ...extra,
});

const link = 'https://partiful.com/e/EXAMPLE123';

describe('toImported', () => {
  it('keys a one-off event by its calendar and its id', () => {
    expect(toImported(raw())).toEqual({
      sourceId: 'calendar-1|event-1',
      title: 'Rooftop dinner',
      startsAt: Date.parse(evening),
      endsAt: new Date(2026, 9, 17, 22).getTime(),
      allDay: false,
      locationText: 'The Glasshouse',
      host: '',
      url: null,
      description: 'Bring a jumper.',
    });
  });

  it('keys an occurrence by its original start, so a moved one keeps its key', () => {
    const moved = raw({
      recurrenceRule: { frequency: 'weekly' } as CalendarEvent['recurrenceRule'],
      originalStartDate: evening,
      startDate: local(2026, 9, 18, 20),
      endDate: local(2026, 9, 18, 23),
    });
    expect(toImported(moved)?.sourceId).toBe(`calendar-1|event-1|${new Date(evening).toISOString()}`);
    expect(toImported(moved)?.startsAt).toBe(new Date(2026, 9, 18, 20).getTime());
  });

  it('treats a detached occurrence as one even without a rule, and falls back to its start', () => {
    expect(toImported(raw({ isDetached: true, originalStartDate: evening }))?.sourceId).toBe(
      `calendar-1|event-1|${new Date(evening).toISOString()}`,
    );
    expect(toImported(raw({ isDetached: true }))?.sourceId).toBe(
      `calendar-1|event-1|${new Date(evening).toISOString()}`,
    );
  });

  it('gives an event with no id an empty key, which the importer skips', () => {
    expect(toImported(raw({ id: undefined }))?.sourceId).toBe('');
    expect(toImported(raw({ calendarId: null, recurrenceRule: {} as CalendarEvent['recurrenceRule'] }))?.sourceId).toBe('');
  });

  it('ends a one-day all-day event at the next midnight, not at 23:59:59', () => {
    const day = toImported(
      raw({ allDay: true, startDate: local(2026, 9, 17), endDate: local(2026, 9, 17, 23, 59, 59) }),
    );
    expect(day).toMatchObject({ allDay: true, startsAt: startOfDay(2026, 9, 17), endsAt: startOfDay(2026, 9, 18) });
  });

  it('runs a three-day all-day event to the midnight after its last day', () => {
    const festival = toImported(
      raw({ allDay: true, startDate: local(2026, 9, 17), endDate: local(2026, 9, 19, 23, 59, 59) }),
    );
    expect(festival).toMatchObject({ startsAt: startOfDay(2026, 9, 17), endsAt: startOfDay(2026, 9, 20) });
  });

  it('keeps an all-day end that is already a midnight after the start', () => {
    const exact = toImported(raw({ allDay: true, startDate: local(2026, 9, 17), endDate: local(2026, 9, 19) }));
    expect(exact).toMatchObject({ startsAt: startOfDay(2026, 9, 17), endsAt: startOfDay(2026, 9, 19) });
    // The same midnight as the start is no length at all: one day, then.
    const none = toImported(raw({ allDay: true, startDate: local(2026, 9, 17), endDate: local(2026, 9, 17) }));
    expect(none).toMatchObject({ endsAt: startOfDay(2026, 9, 18) });
  });

  it('puts a place written on several lines on one', () => {
    expect(toImported(raw({ location: 'The Glasshouse\n14 Alder Row, Springfield' }))?.locationText).toBe(
      'The Glasshouse, 14 Alder Row, Springfield',
    );
    expect(toImported(raw({ location: '  The Glasshouse ,\r\n\r\n  14 Alder Row\n' }))?.locationText).toBe(
      'The Glasshouse, 14 Alder Row',
    );
  });

  it('takes the link from the link field first, then the notes, then the place', () => {
    const other = 'https://example.com/tickets';
    expect(toImported(raw({ url: other, notes: link }))?.url).toBe(other);
    expect(toImported(raw({ url: null, notes: `RSVP at ${link}.`, location: `${link}/other` }))?.url).toBe(link);
    expect(toImported(raw({ notes: null, location: `The Glasshouse (${link})` }))?.url).toBe(link);
  });

  it('ignores a link that is not a plain web link, or only looks like Partiful', () => {
    expect(toImported(raw({ url: 'webcal://example.com/cal', notes: link }))?.url).toBe(link);
    expect(toImported(raw({ notes: 'https://partiful.com@example.com/e/EXAMPLE123' }))?.url).toBeNull();
    expect(toImported(raw({ notes: 'https://partiful.com.example.com/e/EXAMPLE123' }))?.url).toBeNull();
    // Any other link in the notes is the description's business, not the button's.
    expect(toImported(raw({ notes: 'Menu: https://example.com/menu' }))?.url).toBeNull();
  });

  it("keeps the organiser's name, but never an email address", () => {
    const organizer = (name?: string) => ({ name }) as CalendarEvent['organizer'];
    expect(toImported(raw({ organizer: organizer('Maya Okafor') }))?.host).toBe('Maya Okafor');
    expect(toImported(raw({ organizer: organizer('maya@example.com') }))?.host).toBe('');
    expect(toImported(raw({ organizer: organizer() }))?.host).toBe('');
    expect(toImported(raw({ organizer: null }))?.host).toBe('');
  });

  it('copes with text that is null, and drops a cancelled event', () => {
    expect(toImported(raw({ notes: null, location: null, title: null }))).toMatchObject({
      description: '',
      locationText: '',
      title: '',
    });
    expect(toImported(raw({ status: 'cancelled' as CalendarEvent['status'] }))).toBeNull();
  });
});

describe('isPartifulEvent', () => {
  it('looks for partiful.com in the link, the notes and the place', () => {
    expect(isPartifulEvent(raw({ url: link }))).toBe(true);
    expect(isPartifulEvent(raw({ notes: 'See partiful.com/e/EXAMPLE123' }))).toBe(true);
    expect(isPartifulEvent(raw({ location: link }))).toBe(true);
    expect(isPartifulEvent(raw())).toBe(false);
  });
});

describe('collect', () => {
  const party = raw({ id: 'party', notes: link });
  const dinner = raw({ id: 'dinner' });
  const cancelled = raw({ id: 'gone', notes: link, status: 'cancelled' as CalendarEvent['status'] });

  it('hands over every event, and leaves a cancelled one out of both lists', () => {
    const { incoming, present, filtered } = collect([party, dinner, cancelled], false);
    expect(incoming.map((event) => event.sourceId)).toEqual(['calendar-1|party', 'calendar-1|dinner']);
    expect(present).toEqual(['calendar-1|party', 'calendar-1|dinner']);
    expect(filtered).toBe(0);
  });

  it('with the switch on, brings in only Partiful events but still counts the rest as present', () => {
    const { incoming, present, filtered } = collect([party, dinner, cancelled], true);
    expect(incoming.map((event) => event.sourceId)).toEqual(['calendar-1|party']);
    expect(present).toEqual(['calendar-1|party', 'calendar-1|dinner']);
    expect(filtered).toBe(1);
  });
});
