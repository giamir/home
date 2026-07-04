/**
 * Generate PWA icons into static/icons/. Run: npx tsx scripts/icons.ts
 */
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';

const OUT = new URL('../static/icons/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

// lucide "house", 24x24 stroke icon
const HOUSE_PATHS = `
	<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/>
	<path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
`;

function iconSvg(size: number, glyphRatio: number, radiusRatio: number, bg: string) {
	const glyph = size * glyphRatio;
	const offset = (size - glyph) / 2;
	const radius = size * radiusRatio;
	return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
		<rect width="${size}" height="${size}" rx="${radius}" fill="${bg}"/>
		<g transform="translate(${offset} ${offset}) scale(${glyph / 24})"
			fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			${HOUSE_PATHS}
		</g>
	</svg>`);
}

function badgeSvg(size: number) {
	return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
		<g transform="scale(${size / 24})"
			fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			${HOUSE_PATHS}
		</g>
	</svg>`);
}

const EMERALD = '#059669';

await sharp(iconSvg(192, 0.55, 0.22, EMERALD)).png().toFile(`${OUT}icon-192.png`);
await sharp(iconSvg(512, 0.55, 0.22, EMERALD)).png().toFile(`${OUT}icon-512.png`);
// Maskable: full-bleed background, glyph inside the 60% safe zone
await sharp(iconSvg(512, 0.45, 0, EMERALD)).png().toFile(`${OUT}maskable-512.png`);
// iOS rounds corners itself
await sharp(iconSvg(180, 0.55, 0, EMERALD)).png().toFile(`${OUT}apple-touch-icon.png`);
// Android notification badge: white-on-transparent
await sharp(badgeSvg(96)).png().toFile(`${OUT}badge.png`);

console.log('Icons written to static/icons/');
