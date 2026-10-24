// The holo of legendaries and mythics, in the viewer's trading card, plus the game page's cards,
// on one sheet. Usage: node rarity-holo-shots.mjs [base] [outdir]. The base
// serves a build of this checkout (python3 -m http.server 3124 --directory build).
import { createRequire } from 'module';
import { muteAudio } from './mute.mjs';
const require = createRequire(import.meta.url);
const fs = require('fs');
const { webkit } = require('playwright-core');
const BASE = process.argv[2] || 'http://localhost:3124';
const OUT = (process.argv[3] || '.').replace(/\/?$/, '/');
fs.mkdirSync(OUT, { recursive: true });
// Legendaries, then mythics.
const BY_TYPE = { zapdos: 145, mewtwo: 150, kyogre: 382, rayquaza: 384, mew: 151, celebi: 251, darkrai: 491, genesect: 649 };
const SAVE = {
	username: 'Kari',
	pokemonlist: [...Object.values(BY_TYPE).map((id) => `N${id}`), 'S150', 'N146', 'N382', 'N151', 'N145'].join('|'),
	backupReminder: new Date(Date.now() + 9e9).toISOString(),
	storageNoticeSeen: '1'
};
const browser = muteAudio(await webkit.launch());
const context = await browser.newContext({ viewport: { width: 900, height: 1100 }, serviceWorkers: 'block' });
await context.addInitScript((s) => Object.entries(s).forEach(([k, v]) => localStorage.getItem(k) === null && localStorage.setItem(k, v)), SAVE);
const page = await context.newPage();
for (const [type, id] of Object.entries(BY_TYPE)) {
	await page.goto(`${BASE}/pokeviewer.html?pokemonId=${id}`);
	await page.locator('.holo-card .window').waitFor();
	await page.waitForTimeout(600);
	await page.locator('.holo-card .window').screenshot({ path: `${OUT}card-${type}.png` });
}
await page.goto(`${BASE}/pokemath.html?stage=1`);
await page.locator('[id="N145"]').waitFor();
await page.waitForTimeout(800);
await page.locator('[id="N145"]').locator('xpath=..').screenshot({ path: `${OUT}game-row.png` });
// The holo moves with the mouse, not on a timer.
const bands = () => page.locator('[id="N145"] .legendary .turn').evaluate((el) => getComputedStyle(el).backgroundPosition);
const art = await page.locator('[id="N145"] .art').boundingBox();
const still = await bands();
await page.waitForTimeout(1000);
console.log(still === (await bands()) ? 'ok  ' : 'FAIL', 'the legendary holo stands still untouched');
await page.mouse.move(art.x + art.width * 0.1, art.y + art.height * 0.5);
await page.waitForTimeout(300);
const left = await bands();
await page.locator('[id="N145"]').screenshot({ path: `${OUT}game-legendary-left.png` });
await page.mouse.move(art.x + art.width * 0.9, art.y + art.height * 0.5);
await page.waitForTimeout(300);
const right = await bands();
await page.locator('[id="N145"]').screenshot({ path: `${OUT}game-legendary-right.png` });
console.log(left !== right ? 'ok  ' : 'FAIL', 'the legendary holo follows the mouse', left, '→', right);
// All on one sheet, to compare them side by side.
const tiles = Object.keys(BY_TYPE)
	.map((type) => `<figure><img src="data:image/png;base64,${fs.readFileSync(`${OUT}card-${type}.png`).toString('base64')}"><figcaption>${type}</figcaption></figure>`)
	.join('');
await page.setContent(`<style>body{margin:0;display:grid;grid-template-columns:repeat(4,220px);gap:6px;padding:6px;background:#eee;font:13px sans-serif}figure{margin:0}img{width:220px}</style>${tiles}`);
await page.screenshot({ path: `${OUT}sheet.png`, fullPage: true });
await browser.close();
console.log('shots in', OUT);
