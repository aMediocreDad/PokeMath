// A prize from a finished class game is given once even with the game open in two tabs. The tabs
// take turns claiming (navigator.locks): the second finds the first's prize confirmed and gone.
// The server's side is faked, slow enough that both tabs ask before either has confirmed.
// Run against tests/serve-worker.sh. Usage: node tests/prize-lock-check.mjs
import { createRequire } from 'module';
import { muteAudio } from './mute.mjs';
const require = createRequire(import.meta.url);
const { webkit } = require('playwright-core');
const BASE = process.env.BASE || 'http://localhost:3123';
const results = [];
const check = (name, ok, detail = '') => {
	results.push(ok);
	console.log(ok ? 'PASS' : 'FAIL', name, detail);
};

const browser = muteAudio(await webkit.launch());
const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 }, serviceWorkers: 'block' });
await ctx.addCookies([{ name: 'cookies', value: 'true', url: BASE }]);
await ctx.addInitScript(() => {
	const save = { username: 'Kari', money: '1000', uuid: '00000000-0000-4000-8000-0000000000c1', storageNoticeSeen: 'true', backupReminder: new Date(Date.now() + 9e9).toISOString() };
	for (const [k, v] of Object.entries(save)) if (localStorage.getItem(k) === null) localStorage.setItem(k, v);
	// Which locks the page asks for.
	window.__locks = [];
	const request = navigator.locks?.request.bind(navigator.locks);
	if (request) navigator.locks.request = (name, ...rest) => (window.__locks.push(name), request(name, ...rest));
});

let confirmed = false;
let gets = 0;
await ctx.route('**/bingo/claim-prizes**', async (route) => {
	if (route.request().method() === 'POST') {
		confirmed = true;
		return route.fulfill({ json: { ok: true } });
	}
	gets++;
	await new Promise((r) => setTimeout(r, 500));
	await route.fulfill({ json: { ok: true, prizes: confirmed ? [] : [{ id: 'lock-1', type: 'coins', amount: 1234, source: 'bingo' }] } });
});

const [one, two] = await Promise.all([ctx.newPage(), ctx.newPage()]);
for (const page of [one, two]) page.on('pageerror', (e) => console.log('pageerror', e.message));
await Promise.all([one.goto(BASE + '/pokemath.html?stage=1'), two.goto(BASE + '/pokemath.html?stage=1')]);
await Promise.all([one, two].map((page) => page.locator('.problem').waitFor({ timeout: 15000 })));
await one.waitForTimeout(2500);

const shown = await Promise.all([one, two].map((page) => page.locator('#bingo-lootbox-overlay').count()));
check('exactly one of the two tabs gives the prize', shown[0] + shown[1] === 1, JSON.stringify(shown));
check('both tabs asked the server, one after the other', gets === 2, `${gets} reads`);
const locks = await Promise.all([one, two].map((page) => page.evaluate(() => window.__locks)));
check('each tab claimed with the prize lock', locks.every((l) => l.includes('pokemath-bingo-prizes')), JSON.stringify(locks));
const given = await one.evaluate(() => JSON.parse(localStorage.getItem('bingoPrizesGiven') || '[]'));
check('the prize is remembered as given once', given.filter((id) => id === 'lock-1').length === 1, JSON.stringify(given));

await browser.close();
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
process.exit(results.every(Boolean) ? 0 : 1);
