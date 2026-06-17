import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pub = path.resolve(__dirname, '..', 'public');

// Dégradé en userSpaceOnUse → les "découpes" (porte, fenêtres) montrent exactement
// le même dégradé que le fond, donnant un effet de boutique ajourée propre.
const defs = `<defs><linearGradient id="bg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="512" y2="512"><stop offset="0" stop-color="#2563eb"/><stop offset="1" stop-color="#16a34a"/></linearGradient></defs>`;

// Devanture de boutique (point de vente) : auvent festonné + bâtiment + porte + vitrines.
const storefront = `
  <rect x="150" y="204" width="212" height="176" rx="16" fill="#ffffff"/>
  <rect x="226" y="288" width="60" height="92" rx="10" fill="url(#bg)"/>
  <rect x="174" y="240" width="40" height="30" rx="6" fill="url(#bg)"/>
  <rect x="298" y="240" width="40" height="30" rx="6" fill="url(#bg)"/>
  <path d="M150 138 H362 L392 194 q -34 28 -68 0 q -34 28 -68 0 q -34 28 -68 0 q -34 28 -68 0 Z" fill="#ffffff"/>
`;

const svg = (rx) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" role="img" aria-label="GestionPDV">${defs}<rect width="512" height="512" rx="${rx}" fill="url(#bg)"/>${storefront}</svg>`;

const rounded = svg(112);     // coins arrondis (purpose "any" + fichier .svg)
const fullBleed = svg(0);     // plein cadre (maskable + apple-touch, pas de coins transparents)

const run = async () => {
  await sharp(Buffer.from(rounded)).resize(192, 192).png().toFile(path.join(pub, 'pwa-192x192.png'));
  await sharp(Buffer.from(rounded)).resize(512, 512).png().toFile(path.join(pub, 'pwa-512x512.png'));
  await sharp(Buffer.from(fullBleed)).resize(512, 512).png().toFile(path.join(pub, 'pwa-maskable-512x512.png'));
  await sharp(Buffer.from(fullBleed)).resize(180, 180).png().toFile(path.join(pub, 'apple-touch-icon.png'));
  writeFileSync(path.join(pub, 'pwa-icon.svg'), rounded.trim() + '\n');
  console.log('Icônes GestionPDV générées dans public/.');
};

run().catch((e) => { console.error(e); process.exit(1); });
