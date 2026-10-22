// Draw the Home Screen icons and the link preview image into static/icons/ with Chromium
// (playwright-core). The icon is the Pokéball on Pokédex red, inside the middle 60% so a maskable
// crop never cuts it; the preview is the logo on the site's paper colour.
// Needs static/images/logo.png (npm run mirror). Usage: node scripts/make-icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'static', 'icons');
const data = (file, type) => `data:${type};base64,${fs.readFileSync(path.join(ROOT, 'static', file)).toString('base64')}`;
const ball = data('pokeball.svg', 'image/svg+xml');
const logo = data('images/logo.png', 'image/png');
const font = data('../node_modules/@fontsource/lilita-one/files/lilita-one-latin-400-normal.woff2', 'font/woff2');

const RED = 'oklch(0.59 0.2 27)';
const CREAM = 'oklch(0.955 0.02 85)';
const INK = 'oklch(0.28 0.035 265)';

const icon = (size) => `<body style="margin:0;width:${size}px;height:${size}px;background:${RED};display:grid;place-items:center">
	<img src="${ball}" style="width:60%;height:60%;filter:drop-shadow(0 ${size / 40}px ${size / 30}px rgb(0 0 0 / 0.3))">
</body>`;

const preview = `<style>@font-face { font-family: Lilita; src: url(${font}); }</style>
<body style="margin:0;width:1200px;height:630px;background:${CREAM};display:grid;place-content:center;justify-items:center;gap:28px;font-family:Lilita">
	<img src="${logo}" style="width:760px">
	<div style="font-size:52px;color:${INK}">Regn, fang og samle Pokémon</div>
</body>`;

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size] of [['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180]]) {
	await page.setViewportSize({ width: size, height: size });
	await page.setContent(icon(size));
	await page.screenshot({ path: path.join(OUT, name) });
}
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(preview);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.join(OUT, 'preview.png') });
await browser.close();
console.log('icons written to static/icons/');
