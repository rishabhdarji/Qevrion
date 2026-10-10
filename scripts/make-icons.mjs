// Draws the app icon and the launch-screen image from assets/mark.svg.
// Run with `npm run icons` after changing the mark.
import { mkdir, readFile } from 'node:fs/promises';

import sharp from 'sharp';

const BACKGROUND = '#0E0E10';
const SIZE = 1024;
// The mark's visual centre inside its 96-unit box (the tail pulls it off 48,48).
const MARK_CENTRE = 50.5;

const mark = await readFile('assets/mark.svg', 'utf8');
const shapes = mark.replace(/<\/?svg[^>]*>/g, '');

/** The mark scaled by `scale` and centred on a square canvas. */
function canvas(scale, background) {
  const offset = SIZE / 2 - MARK_CENTRE * scale;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">` +
      (background ? `<rect width="100%" height="100%" fill="${background}"/>` : '') +
      `<g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="#F2EFEA" stroke-width="7">${shapes}</g>` +
      '</svg>',
  );
}

await mkdir('assets/images', { recursive: true });

// iOS icons must be square with no transparency; the system rounds the corners.
await sharp(canvas(7.5, BACKGROUND)).flatten({ background: BACKGROUND }).png().toFile('assets/images/icon.png');

// Transparent; the launch screen supplies the background colour.
await sharp(canvas(10)).png().toFile('assets/images/splash-icon.png');

console.log('Wrote assets/images/icon.png and assets/images/splash-icon.png');
