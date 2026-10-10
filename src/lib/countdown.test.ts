import { formatCountdown } from './countdown';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('formatCountdown', () => {
  it('shows the two largest units', () => {
    expect(formatCountdown(3 * DAY + 8 * HOUR + 59 * MINUTE)).toBe('3d 8h left');
    expect(formatCountdown(5 * HOUR + 12 * MINUTE + 40 * SECOND)).toBe('5h 12m left');
    expect(formatCountdown(12 * MINUTE + 30 * SECOND)).toBe('12m 30s left');
    expect(formatCountdown(42 * SECOND)).toBe('42s left');
  });

  it('keeps a zero in the smaller unit', () => {
    expect(formatCountdown(2 * DAY)).toBe('2d 0h left');
    expect(formatCountdown(HOUR)).toBe('1h 0m left');
  });

  it('rolls over at unit boundaries', () => {
    expect(formatCountdown(DAY - 1)).toBe('23h 59m left');
    expect(formatCountdown(HOUR - 1)).toBe('59m 59s left');
  });

  it('says Now once the start has been reached or passed', () => {
    expect(formatCountdown(999)).toBe('Now');
    expect(formatCountdown(0)).toBe('Now');
    expect(formatCountdown(-5 * MINUTE)).toBe('Now');
  });
});
