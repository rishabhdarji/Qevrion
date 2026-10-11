// Runs the tests once per time zone, because the date logic must hold wherever the
// phone is. The zones are the awkward ones: far ahead of and far behind UTC, clocks
// that change by half an hour, and clocks that change at midnight.
// Usage: npm run test:zones   (anything after `--` goes to Jest)
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const ZONES = [
  'UTC',
  'America/New_York',
  'Pacific/Kiritimati',
  'Pacific/Pago_Pago',
  'Australia/Lord_Howe',
  'America/Santiago',
];

const jest = createRequire(import.meta.url).resolve('jest/bin/jest');

for (const TZ of ZONES) {
  console.log(`\n=== ${TZ} ===`);
  // Set here, not on the command line, so it works the same in every shell.
  const { status } = spawnSync(process.execPath, [jest, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, TZ },
  });
  if (status !== 0) process.exit(status ?? 1);
}
