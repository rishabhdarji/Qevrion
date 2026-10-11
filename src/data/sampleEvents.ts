import { dayStart } from '../lib/dates';
import type { EventFields } from '../types';

// 120 invented events for testing the app at full size. Hosts and venues are made up.
// Every time is worked out from `now`, and nothing here is random, so the same `now`
// always gives the same list. The app labels each one "Sample".

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const THEMES = [
  'Rooftop',
  'Garden',
  'Late-Night',
  'Sunday',
  'Harvest',
  'Candlelit',
  'Pop-Up',
  'Winter',
  'Neighbourhood',
  'Open-Air',
  'Midweek',
  'Riverside',
];
const KINDS = [
  'Supper Club',
  'Gallery Night',
  'Board Game Social',
  'Long Run and Brunch',
  'Jazz Session',
  'Design Meetup',
  'Housewarming',
  'Makers Market',
  'Open Mic',
  'Pottery Class',
];
const HOSTS = [
  'Maya Okafor',
  'Tomas Lind',
  'Priya Nair',
  'Northside Run Club',
  'Quiet Hours Collective',
  'Local Makers',
  'Dev Kapoor',
  'Elena Marsh',
];
const VENUES = [
  'The Glasshouse, 14 Alder Row',
  'Harbour Print Studio',
  'Meeple Corner Café',
  'Canal Bridge steps',
  'The Old Brewery Yard',
  'Workshop 6, Foundry Lane',
  'Flat 3, 27 Wren Street',
  'Station Square',
  'Table and Vine',
  'Community Garden Hall',
];
const DETAILS = [
  ['Smart casual', '$45 ticket', 'Bring a layer'],
  ['Free entry', 'Drinks provided'],
  ['Bring a game', '18+'],
  [],
  ['Bring water'],
];
// Start hour and length, paired so that neighbours on the same day sometimes overlap.
const SLOTS = [
  [18, 2],
  [19, 3],
  [20, 2.5],
  [12, 1.5],
  [9, 3],
  [17.5, 2],
  [19.5, 2.5],
  [10, 4],
];

type Timing = Pick<EventFields, 'startsAt' | 'endsAt'> & Partial<EventFields>;

export const SAMPLE_COUNT = 120;

export function makeSampleEvents(now: number): EventFields[] {
  /** A local clock time `days` from today, lasting `hours`. */
  const slot = (days: number, index: number): Timing => {
    const [hour, hours] = SLOTS[index % SLOTS.length];
    const startsAt = new Date(dayStart(now, days)).setHours(Math.floor(hour), (hour % 1) * 60);
    return { startsAt, endsAt: startsAt + hours * HOUR };
  };
  const allDay = (days: number, length: number): Timing => ({
    allDay: true,
    startsAt: dayStart(now, days),
    endsAt: dayStart(now, days + length),
  });

  const timings: Timing[] = [
    // Close enough to watch: the hero rolls over at two minutes and again at five.
    { startsAt: now + 2 * MINUTE, endsAt: now + 62 * MINUTE },
    { startsAt: now + 5 * MINUTE, endsAt: now + 2 * HOUR },
    // Under way, and one of them about to move to Archive.
    { startsAt: now - 30 * MINUTE, endsAt: now + 3 * MINUTE },
    { startsAt: now - HOUR, endsAt: now + 2 * HOUR },
    // A bare event, as a hand-typed one often is: a title and a time.
    { ...slot(1, 3), locationText: '', host: '', description: '', keyDetails: [] },
    allDay(1, 1),
    allDay(9, 3),
    allDay(-20, 1),
    // Thick this week and next, thinning out over about seven months.
    ...Array.from({ length: 83 }, (_, i) => slot(1 + Math.floor(i * 0.5 + (i * i) / 40), i)),
    // Archive: back about four months.
    ...Array.from({ length: 29 }, (_, i) => slot(-1 - Math.floor(i * 1.5 + (i * i) / 12), i)),
  ];

  return timings.map((timing, i) => {
    const partiful = i % 5 < 2;
    return {
      sourceId: `sample:${i + 1}`,
      title: `${THEMES[i % THEMES.length]} ${KINDS[Math.floor(i / THEMES.length)]}`,
      allDay: false,
      locationText: VENUES[(i * 3) % VENUES.length],
      host: HOSTS[(i * 5) % HOSTS.length],
      url: partiful ? 'https://partiful.com/e/sample' : null,
      notes: '',
      description:
        'Doors open half an hour before the start. Come as you are and bring a friend if you like.',
      keyDetails: DETAILS[i % DETAILS.length],
      ...timing,
    };
  });
}
