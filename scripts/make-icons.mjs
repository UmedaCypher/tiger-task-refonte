// Génère les icônes PWA à partir de l'emblème (npm run icons)
import sharp from 'sharp';

const mark = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><radialGradient id="g" cx="50%" cy="20%" r="80%"><stop offset="0" stop-color="#2a2033"/><stop offset="1" stop-color="#0d0b14"/></radialGradient></defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <g transform="translate(${pad} ${pad}) scale(${(512 - 2 * pad) / 64})" stroke="#d9a441" fill="none" stroke-linecap="round">
    <circle cx="32" cy="32" r="27" stroke-width="2.5"/>
    <circle cx="32" cy="32" r="21" stroke-width="1" opacity=".45"/>
    <g stroke-width="3.2">
      <path d="M21 17c5 4 8 9 9 14"/><path d="M43 17c-5 4-8 9-9 14"/>
      <path d="M14 30c5 0 10 2 13 6"/><path d="M50 30c-5 0-10 2-13 6"/>
      <path d="M19 45c4-2 8-2 11 0"/><path d="M45 45c-4-2-8-2-11 0"/><path d="M32 39v10"/>
    </g>
  </g>
</svg>`;

const out = [
  ['public/icon-192.png', 192, 60],
  ['public/icon-512.png', 512, 60],
  ['public/icon-maskable-512.png', 512, 110],
  ['public/apple-touch-icon.png', 180, 70],
];
for (const [file, size, pad] of out) {
  await sharp(Buffer.from(mark(pad))).resize(size, size).png().toFile(file);
  console.log('✓', file);
}
