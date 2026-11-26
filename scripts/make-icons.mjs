// Génère les icônes PWA (npm run icons)
import sharp from 'sharp';

const icon = (pad) => {
  const s = (512 - 2 * pad) / 20;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#f4f5f4"/>
  <g transform="translate(${pad} ${pad}) scale(${s})">
    <rect x="1" y="1" width="18" height="18" rx="5" fill="#ff7a45"/>
    <path d="M1 7.5h18M1 12.5h18M7.5 1v18" stroke="#fff" stroke-opacity=".55" stroke-width=".5"/>
    <rect x="7.5" y="7.5" width="11.5" height="5" fill="#fff" fill-opacity=".9"/>
  </g></svg>`;
};
for (const [file, size, pad] of [
  ['public/icon-192.png', 192, 40],
  ['public/icon-512.png', 512, 40],
  ['public/icon-maskable-512.png', 512, 100],
  ['public/apple-touch-icon.png', 180, 50],
]) {
  await sharp(Buffer.from(icon(pad))).resize(size, size).png().toFile(file);
  console.log('✓', file);
}
