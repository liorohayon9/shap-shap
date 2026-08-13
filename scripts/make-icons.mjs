/**
 * Renders every icon the PWA manifest and the Android launcher need from one
 * vector source. Run with `npm run icons` after changing the artwork.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const BG = '#0d0f14';
const FG = '#ff8a3d';

const BELL = `
    <path d="M0-150c-52 0-94 42-94 94 0 62-14 92-34 112-9 9-3 24 10 24h236c13 0 19-15 10-24-20-20-34-50-34-112 0-52-42-94-94-94Z" fill="${FG}"/>
    <circle cx="0" cy="-160" r="20" fill="${FG}"/>
    <path d="M-34 104a34 34 0 0 0 68 0Z" fill="${FG}"/>`;

/** Material "thumb_up", drawn on a 24x24 grid. */
const THUMB = `
    <path d="M2 21h4V9H2v12z" fill="${FG}"/>
    <path d="M23 10c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-1z" fill="${FG}"/>`;

/**
 * Bell with a thumbs-up badge. The badge sits on a disc of the background
 * colour so it stays legible where it overlaps the bell.
 * @param {{radius: number, scale: number, bleed: boolean}} o
 */
const artwork = (scale) => `
  <g transform="translate(256 256) scale(${scale})">
    <g transform="translate(-26 -20) scale(0.8)">${BELL}
    </g>
    <circle cx="112" cy="118" r="118" fill="${BG}"/>
    <g transform="translate(31 37) scale(6.75)">${THUMB}
    </g>
  </g>`;

/** @param {{radius: number, scale: number, bleed: boolean}} o */
const svg = ({ radius, scale, bleed }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${bleed ? 0 : radius}" fill="${BG}"/>
${artwork(scale)}
</svg>`;

const STANDARD = svg({ radius: 112, scale: 1, bleed: false });
// Maskable icons get cropped to a circle by the launcher — shrink into the safe zone.
const MASKABLE = svg({ radius: 0, scale: 0.68, bleed: true });

/** Android adaptive icons supply the background and foreground as separate layers. */
const FOREGROUND = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
${artwork(0.62)}
</svg>`;

const targets = [
  // Web / PWA
  { out: 'public/icons/icon-192.png', size: 192, src: STANDARD },
  { out: 'public/icons/icon-512.png', size: 512, src: STANDARD },
  { out: 'public/icons/icon-512-maskable.png', size: 512, src: MASKABLE },
  // Android launcher (legacy square/round densities)
  ...[
    ['mdpi', 48],
    ['hdpi', 72],
    ['xhdpi', 96],
    ['xxhdpi', 144],
    ['xxxhdpi', 192],
  ].flatMap(([density, size]) => [
    { out: `android/app/src/main/res/mipmap-${density}/ic_launcher.png`, size, src: STANDARD },
    { out: `android/app/src/main/res/mipmap-${density}/ic_launcher_round.png`, size, src: STANDARD },
    {
      out: `android/app/src/main/res/mipmap-${density}/ic_launcher_foreground.png`,
      size: Math.round(size * 2.2), // adaptive foregrounds are 108dp on a 72dp viewport
      src: FOREGROUND,
    },
  ]),
];

for (const { out, size, src } of targets) {
  const path = resolve(root, out);
  await mkdir(dirname(path), { recursive: true });
  await sharp(Buffer.from(src)).resize(size, size).png().toFile(path);
  console.log(`  ${out}  ${size}x${size}`);
}

// Solid colour behind the adaptive foreground.
const colors = resolve(root, 'android/app/src/main/res/values/ic_launcher_background.xml');
await mkdir(dirname(colors), { recursive: true });
await writeFile(
  colors,
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG}</color>\n</resources>\n`,
);

console.log('icons written');
