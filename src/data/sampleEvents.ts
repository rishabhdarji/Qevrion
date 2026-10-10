import { covers } from '@/theme';
import type { QevrionEvent } from '@/types';

// Invented events for Round 1. Hosts and venues are made up. Times are set relative to
// the moment the app loads so the hero always has a live countdown and Archive always
// has past events. Round 2 replaces this with the database.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const loadedAt = Date.now();

/** A local clock time `days` from today. */
function on(days: number, hour: number, minute = 0): number {
  const date = new Date(loadedAt + days * DAY);
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
}

type Draft = Pick<QevrionEvent, 'title' | 'startsAt' | 'locationText' | 'host' | 'cover'> &
  Partial<QevrionEvent> & { hours: number };

function sample(index: number, { hours, ...draft }: Draft): QevrionEvent {
  return {
    id: `sample-${index + 1}`,
    source: 'calendar',
    endsAt: draft.startsAt + hours * HOUR,
    description:
      'Doors open half an hour before the start. Come as you are and bring a friend if you like.',
    url: null,
    isPartiful: false,
    keyDetails: [],
    isSample: true,
    hasConflict: false,
    ...draft,
  };
}

const drafts: Draft[] = [
  {
    title: 'Rooftop Supper Club',
    // Just over two days out, on the half hour, so the hero reads "2d 5h left".
    startsAt: Math.ceil((loadedAt + 2 * DAY + 5 * HOUR) / (30 * MINUTE)) * 30 * MINUTE,
    hours: 3,
    locationText: 'The Glasshouse, 14 Alder Row',
    host: 'Maya Okafor',
    cover: covers.plum,
    isPartiful: true,
    url: 'https://partiful.com/e/sample',
    description:
      'Four courses under the string lights, cooked by a different guest chef each month.\n\n' +
      '6:30 PM welcome drinks\n7:15 PM seated dinner\n9:30 PM dessert on the terrace\n\n' +
      'Dress code: smart casual, and bring a layer because the roof gets breezy. ' +
      'Tickets are $45 and cover everything. RSVP by Thursday.',
    keyDetails: ['Smart casual', '$45 ticket', 'Bring a layer', 'RSVP by Thursday', 'Dinner included'],
  },
  {
    title: 'Gallery Night: New Prints',
    startsAt: on(3, 18, 30),
    hours: 2.5,
    locationText: 'Harbour Print Studio',
    host: 'Tomas Lind',
    cover: covers.teal,
    hasConflict: true,
    keyDetails: ['Free entry', 'Drinks provided'],
  },
  {
    title: 'Board Game Social',
    startsAt: on(3, 19, 30),
    hours: 3,
    locationText: 'Meeple Corner Café',
    host: 'Priya Nair',
    cover: covers.ember,
    isPartiful: true,
    url: 'https://partiful.com/e/sample',
    hasConflict: true,
    keyDetails: ['Bring a game', '18+'],
  },
  {
    title: 'Sunday Long Run and Brunch',
    startsAt: on(5, 8),
    hours: 3,
    locationText: 'Canal Bridge steps',
    host: 'Northside Run Club',
    cover: covers.moss,
    keyDetails: ['8 miles, easy pace', 'Bring water'],
  },
  {
    title: 'Jazz in the Courtyard',
    startsAt: on(9, 19),
    hours: 2.5,
    locationText: 'The Old Brewery Yard',
    host: 'Quiet Hours Collective',
    cover: covers.indigo,
    isPartiful: true,
    url: 'https://partiful.com/e/sample',
  },
  {
    title: 'Product Design Meetup',
    startsAt: on(16, 18),
    hours: 2,
    locationText: 'Workshop 6, Foundry Lane',
    host: 'Local Makers',
    cover: covers.slate,
  },
  {
    title: "Housewarming at Dev's",
    startsAt: on(24, 20),
    hours: 4,
    locationText: 'Flat 3, 27 Wren Street',
    host: 'Dev Kapoor',
    cover: covers.rose,
    isPartiful: true,
    url: 'https://partiful.com/e/sample',
  },
  {
    title: 'Winter Market Opening Night',
    startsAt: on(38, 17),
    hours: 4,
    locationText: 'Station Square',
    host: 'Market Friends',
    cover: covers.ochre,
  },
  {
    title: 'Supper for Twelve',
    startsAt: on(52, 19, 30),
    hours: 3.5,
    locationText: 'Table and Vine',
    host: 'Elena Marsh',
    cover: covers.plum,
  },
  // Past events for Archive.
  {
    title: 'Autumn Potluck',
    startsAt: on(-3, 18),
    hours: 3,
    locationText: 'Community Garden Hall',
    host: 'Priya Nair',
    cover: covers.ember,
  },
  {
    title: 'Open Mic Night',
    startsAt: on(-10, 20),
    hours: 2.5,
    locationText: 'The Lantern Room',
    host: 'Quiet Hours Collective',
    cover: covers.indigo,
    isPartiful: true,
    url: 'https://partiful.com/e/sample',
  },
  {
    title: 'Trail Cleanup Morning',
    startsAt: on(-21, 9),
    hours: 3,
    locationText: 'Ridgeway car park',
    host: 'Northside Run Club',
    cover: covers.moss,
  },
  {
    title: 'Pottery Taster Class',
    startsAt: on(-40, 14),
    hours: 2,
    locationText: 'Kiln and Wheel',
    host: 'Tomas Lind',
    cover: covers.teal,
  },
];

export const sampleEvents: QevrionEvent[] = drafts
  .map((draft, index) => sample(index, draft))
  .sort((a, b) => a.startsAt - b.startsAt);
