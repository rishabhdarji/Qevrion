import { findConflicts } from './conflicts';

const HOUR = 3_600_000;

const span = (id: string, startHour: number, endHour: number, allDay = false) => ({
  id,
  startsAt: startHour * HOUR,
  endsAt: endHour * HOUR,
  allDay,
});

const conflicts = (...events: ReturnType<typeof span>[]) => [...findConflicts(events)].sort();

describe('findConflicts', () => {
  it('flags both events when their times overlap', () => {
    expect(conflicts(span('a', 18, 20), span('b', 19, 22), span('c', 23, 24))).toEqual(['a', 'b']);
  });

  it('lets one event start the moment another ends', () => {
    expect(conflicts(span('a', 18, 20), span('b', 20, 22))).toEqual([]);
  });

  it('flags everything inside a long event, in any order', () => {
    expect(conflicts(span('lunch', 12, 13), span('day', 9, 17), span('tea', 15, 16))).toEqual([
      'day',
      'lunch',
      'tea',
    ]);
  });

  it('follows a chain where the middle event runs longest', () => {
    expect(conflicts(span('a', 1, 5), span('b', 2, 10), span('c', 6, 7), span('d', 11, 12))).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('never counts all-day events', () => {
    expect(conflicts(span('birthday', 0, 24, true), span('dinner', 19, 21))).toEqual([]);
    expect(conflicts(span('one', 0, 24, true), span('two', 0, 24, true))).toEqual([]);
  });

  it('copes with nothing at all', () => {
    expect(conflicts()).toEqual([]);
  });
});
