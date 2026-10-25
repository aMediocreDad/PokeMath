// The shiny foil on the game page's recent catches: a plain card, a shiny, a shiny legendary and a
// shiny mythic, at rest, with the light pinned left and right as a mouse would, and on a phone;
// and the viewer's trading card for a shiny, untouched, whose shine shows without moving it.
// Usage: node foil-card-shots.mjs [base] [outdir]. The base serves a build of this checkout
// (python3 -m http.server 3124 --directory build).
import { createRequire } from 'module';
import { muteAudio } from './mute.mjs';
const require = createRequire(import.meta.url);
const fs = require('fs');
const { webkit, devices } = require('playwright-core');
const BASE = process.argv[2] || 'http://localhost:3124';
const OUT = (process.argv[3] || '.').replace(/\/?$/, '/');
fs.mkdirSync(OUT, { recursive: true });
const SAVE = {
	username: 'Kari',
	pokemonlist: ['N1', 'S151', 'S150', 'S6', 'S25'].join('|'),
	backupReminder: new Date(Date.now() + 9e9).toISOString(),
	storageNoticeSeen: '1'
};

const browser = muteAudio(await webkit.launch());
for (const [size, device] of [['desktop', { viewport: { width: 1280, height: 900 } }], ['phone', devices['iPhone 13']]]) {
	const context = await browser.newContext({ ...device, serviceWorkers: 'block' });
	await context.addInitScript((s) => Object.entries(s).forEach(([k, v]) => localStorage.getItem(k) === null && localStorage.setItem(k, v)), SAVE);
	const page = await context.newPage();
	await page.goto(BASE + '/pokemath.html?stage=1');
	const row = page.locator('[id="S25"]').locator('xpath=..');
	await page.locator('[id="S25"] .foil').waitFor();
	await page.waitForTimeout(800);
	await row.scrollIntoViewIfNeeded();
	await row.screenshot({ path: `${OUT}${size}-row.png` });
	if (size === 'desktop') {
		for (const [name, x] of [['left', 0.15], ['right', 0.85]]) {
			for (const id of ['S25', 'S150', 'S151']) {
				const box = await page.locator(`[id="${id}"] .art`).boundingBox();
				await page.mouse.move(box.x + box.width * x, box.y + box.height * 0.4);
				await page.waitForTimeout(250);
				await page.locator(`[id="${id}"]`).screenshot({ path: `${OUT}${size}-${id}-${name}.png` });
			}
		}
	}
	await page.goto(BASE + '/pokeviewer.html?pokemonId=25&shiny=1');
	await page.locator('.holo-card.holo').waitFor();
	await page.waitForTimeout(800);
	await page.locator('.holo-card.holo').screenshot({ path: `${OUT}${size}-holo-card.png` });
	await context.close();
}
await browser.close();
console.log('shots in', OUT);
