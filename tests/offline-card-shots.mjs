// The "Laster ned Pokémon" progress while the pictures download: a card at the bottom right on a
// wide screen, a thin bar on the header's lower edge on a phone, where it must not cover the page.
// The picture downloads are slowed down so the progress stays up. Run against tests/serve-worker.sh.
// Usage: node tests/offline-card-shots.mjs [outdir, default .shots]
import { createRequire } from 'module';
import { muteAudio } from './mute.mjs';
const require = createRequire(import.meta.url);
const { chromium, webkit, devices } = require('playwright-core');
const BASE = process.env.BASE || 'http://localhost:3123';
const OUT = process.argv[2] || '.shots';
let failed = 0;
const check = (name, ok, detail = '') => {
	if (!ok) failed++;
	console.log(ok ? 'PASS' : 'FAIL', name, detail);
};

const setups = [
	['phone', webkit, { ...devices['iPhone 13'] }],
	['desktop', chromium, { viewport: { width: 1280, height: 800 } }]
];
for (const [name, type, options] of setups) {
	const browser = muteAudio(await type.launch());
	const ctx = await browser.newContext({ ...options, extraHTTPHeaders: { 'x-dev-email': `card-${name}-${Date.now()}@test.no` } });
	await ctx.addInitScript(() => localStorage.setItem('storageNoticeSeen', '1'));
	// Only the background download asks for pictures in bulk; holding every picture back keeps it running.
	await ctx.route('**/images/pokemon/**', async (route) => {
		await new Promise((r) => setTimeout(r, 1500));
		await route.continue().catch(() => {});
	});
	const page = await ctx.newPage();
	for (const path of ['/', '/pokemath.html', '/dex.html']) {
		await page.goto(BASE + path);
		const card = page.locator('.pm-offline');
		const shown = await card.waitFor({ timeout: 15_000 }).then(() => true, () => false);
		check(`${name} ${path}: progress shown`, shown);
		await page.waitForTimeout(500);
		await page.screenshot({ path: `${OUT}/offline-${name}${path.replace(/\W+/g, '-')}.png` });
		if (name === 'phone' && shown) {
			const box = await card.boundingBox();
			const bar = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pm-bar-height')));
			check(`${name} ${path}: bar stays on the header's edge`, !!box && box.y >= bar - 1 && box.y + box.height <= bar + 4, JSON.stringify(box));
		}
	}
	await browser.close();
}
console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
