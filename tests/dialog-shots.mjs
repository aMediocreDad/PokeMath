// The backup reminder, an in-page question and the import message, at a narrow phone, an iPhone
// and a desktop: each must fit the screen. Run against tests/serve-worker.sh.
// Usage: node tests/dialog-shots.mjs <outdir>
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { muteAudio } from './mute.mjs';
const require = createRequire(import.meta.url);
const { webkit, devices } = require('playwright-core');
const BASE = process.env.BASE || 'http://localhost:3123';
const OUT = process.argv[2] || '.';

let failed = 0;
const check = (name, ok, detail = '') => {
	if (!ok) failed++;
	console.log(ok ? 'PASS' : 'FAIL', name, detail);
};

/** Whether the element lies inside the screen's width. */
const fits = (page, selector) =>
	page.locator(selector).evaluate((el) => {
		const box = el.getBoundingClientRect();
		return box.left >= 0 && box.right <= innerWidth;
	});

const browser = muteAudio(await webkit.launch());
const sizes = [
	['small', { ...devices['iPhone SE'], viewport: { width: 320, height: 640 } }],
	['phone', devices['iPhone 13']],
	['desktop', { viewport: { width: 1280, height: 800 } }]
];
for (const [size, options] of sizes) {
	// A login of its own, or the cloud save from the size before asks which save to keep.
	const ctx = await browser.newContext({ ...options, acceptDownloads: true, extraHTTPHeaders: { 'x-dev-email': `dialogs-${size}-${Date.now()}@test.no` } });
	// 30 Pokémon and no snooze: the reminder is due.
	await ctx.addInitScript(() => {
		if (sessionStorage.getItem('seeded')) return;
		sessionStorage.setItem('seeded', '1');
		localStorage.setItem('storageNoticeSeen', '1');
		localStorage.setItem('username', 'Testa');
		localStorage.setItem('pokemonlist', Array.from({ length: 30 }, (_, i) => `${i + 1}`).join('|'));
		localStorage.removeItem('backupReminder');
	});
	const page = await ctx.newPage();
	page.on('dialog', (d) => {
		check(`no native dialog (${size})`, false, d.message());
		d.dismiss();
	});

	await page.goto(BASE + '/pokemath.html?stage=1');
	await page.locator('#backup-popup:not(.hidden) .reminder').waitFor();
	await page.waitForTimeout(300);
	await page.screenshot({ path: `${OUT}/reminder-${size}.png` });
	check(`reminder fits (${size})`, await fits(page, '#backup-popup .reminder'));
	check(`snooze button fits (${size})`, await fits(page, '#snooze-btn'));
	await page.locator('#snooze-btn').click();
	await page.locator('.pm-toast').waitFor();
	check(`snooze answers with a toast (${size})`, /påminnet/.test(await page.locator('.pm-toast').textContent()));

	await page.locator('.menu-button').click();
	await page.locator('button', { hasText: 'Tilbakestill' }).click();
	await page.locator('#ask-ok').waitFor();
	await page.waitForTimeout(200);
	await page.screenshot({ path: `${OUT}/ask-${size}.png` });
	check(`question fits (${size})`, await fits(page, '.ask'));
	await page.locator('#ask-cancel').click();
	check(`cancel keeps the save (${size})`, (await page.evaluate(() => localStorage.getItem('pokemonlist')))?.split('|').length === 30);

	await page.goto(BASE + '/saveandload.html');
	const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#downloadSection button').click()]);
	const file = readFileSync(await download.path());
	await page.setInputFiles('#fileInput', { name: 'a.pkmth', mimeType: 'application/octet-stream', buffer: file });
	const done = page.locator('.pm-toast', { hasText: 'Lastet inn' });
	await done.waitFor();
	await page.waitForTimeout(400);
	await page.screenshot({ path: `${OUT}/import-${size}.png` });
	check(`import says so in a toast (${size})`, await done.isVisible());
	check(`no big pop-up after import (${size})`, (await page.locator('.pm-notification').count()) === 0);
	await done.click();
	await page.waitForTimeout(300);
	check(`import toast closes on a tap (${size})`, (await done.count()) === 0);
	await ctx.close();
}
await browser.close();
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
