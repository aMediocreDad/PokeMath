// A whole raid in the browser: the teacher makes one on /lærer/raid.html, two children join with the
// code and answer problems, every correct answer hits the boss for the answer (damageFor), and
// both children catch it. Run against tests/serve-worker.sh. Usage: node tests/raid-check.mjs [outdir]
import { createRequire } from 'module';
import { muteAudio } from './mute.mjs';
import { damageFor } from '../src/lib/raidConfig.js';
const require = createRequire(import.meta.url);
const { webkit, devices } = require('playwright-core');
const BASE = process.env.BASE || 'http://localhost:3123';
const OUT = process.argv[2];
const results = [];
const check = (name, ok, detail = '') => {
	results.push(ok);
	console.log(ok ? 'PASS' : 'FAIL', name, detail);
};
const shot = (page, name) => OUT && page.screenshot({ path: `${OUT}/${name}.png` });

const browser = muteAudio(await webkit.launch());
const hostCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const host = await hostCtx.newPage();
host.on('pageerror', (e) => console.log('host pageerror', e.message));
host.on('dialog', (d) => d.accept());

await host.goto(BASE + '/lærer/index.html');
await host.locator('#start-raid').click();
await host.locator('#raidSetup').waitFor();
await host.waitForTimeout(800);
await shot(host, 'raid-setup');
await host.locator('.boss-pick', { hasText: 'Mewtwo' }).click();
await host.locator('#raidLength [data-value="short"]').click();
await host.locator('#createRaidBtn').click();
const code = (await host.locator('#lobbyCode').textContent()).trim();
check('the teacher gets a code', /^[0-9A-Z]{6}$/.test(code), code);

/** A child who joins with the code and opens level 1. */
async function child(name, device) {
	const ctx = await browser.newContext({ ...devices[device], extraHTTPHeaders: { 'x-dev-email': `${name.toLowerCase()}-${Date.now()}@test.no` } });
	await ctx.addCookies([{ name: 'cookies', value: 'true', url: BASE }]);
	// Note whether the prize reveal ever shows on top of the win screen.
	await ctx.addInitScript(() =>
		setInterval(() => {
			if (document.querySelector('#bingo-lootbox-overlay') && document.querySelector('.catch.open')) window.__stacked = true;
		}, 50)
	);
	const page = await ctx.newPage();
	page.on('pageerror', (e) => console.log(name, 'pageerror', e.message));
	await page.goto(BASE + '/');
	await page.evaluate((n) => localStorage.setItem('username', n), name);
	await page.goto(BASE + '/bingo_join.html');
	// The page fills the code box when it starts; typing before that would be wiped.
	await page.locator('#studentOut', { hasText: name }).waitFor();
	await page.locator('#code').fill(code);
	await page.locator('#joinBtn').click();
	await page.waitForURL(BASE + '/');
	await page.goto(BASE + '/pokemath.html?stage=1');
	await page.locator('#raidIndicator').waitFor();
	return page;
}
// Ola plays on a phone, where the raid banner used to stick out past the screen.
const kids = [await child('Kari', 'iPad (gen 7)'), await child('Ola', 'iPhone 13')];
check('children see they are waiting', (await kids[0].locator('#raidIndicator').textContent()).includes('Venter'));
await host.locator('#lobbyPlayers li').nth(1).waitFor();
check('the teacher sees both children', (await host.locator('#lobbyPlayers li').count()) === 2);
await shot(host, 'raid-lobby');

await host.locator('#startGameBtn').click();
await host.locator('#raidHp').waitFor();
check("start gives Mewtwo's 106 base HP per child", (await host.locator('#raidHp').textContent()).trim() === '212 / 212 liv');

const solve = async (page) => {
	const [a, op, b] = (await page.locator('.problem').textContent()).trim().split(/\s+/);
	const [x, y] = [Number(a), Number(b)];
	return op === '+' ? x + y : op === '-' || op === '−' ? x - y : op === '·' ? x * y : x / y;
};
/** Damage the children's answers should have done. */
let dealt = 0;
/** Answer correctly, a little over a second apart (the server drops faster hits). */
async function play(page, times) {
	for (let i = 0; i < times; i++) {
		if (await host.locator('#raidVictory').isVisible()) return;
		if (await page.locator('#pokeball:not(.is-hidden)').isVisible()) {
			await page.locator('#pokeball').click();
			await page.waitForTimeout(400);
			await page.locator('.reset-button:not(.is-hidden)').click();
		}
		const value = await solve(page);
		dealt += damageFor(value, 1);
		await page.locator('.our-field').fill(String(value));
		await page.locator('.answer-button').click();
		await page.waitForTimeout(1150);
	}
}
await Promise.all([play(kids[0], 3), play(kids[1], 3)]);
await host.waitForTimeout(500);
const mid = (await host.locator('#raidHp').textContent()).trim();
check('each answer hits for the answer', mid === `${212 - dealt} / 212 liv`, `${mid}, expected ${212 - dealt}`);
check('the feed shows the damage', /traff for \d+!/.test(await host.locator('.feed li').first().textContent()));
await shot(host, 'raid-fight');
const banner = await kids[1].locator('#raidIndicator').textContent();
check('children see the boss lose HP and their own hit', banner.includes(`${212 - dealt} / 212`) && /Du traff for \d+!/.test(banner), banner);
const overflow = await kids[1].evaluate(() => document.documentElement.scrollWidth - innerWidth);
check('the raid banner fits on a phone', overflow <= 0, `${overflow}px too wide`);
await shot(kids[0], 'raid-child');
await shot(kids[1], 'raid-child-phone');

// Level 1 answers average about 7, so about 30 answers finish the boss.
for (let round = 0; round < 40 && !(await host.locator('#raidVictory').isVisible()); round++) await Promise.all([play(kids[0], 1), play(kids[1], 1)]);
await host.locator('#raidVictory').waitFor({ timeout: 10_000 });
check('the class wins', true);
await host.waitForTimeout(600);
await shot(host, 'raid-won');
await kids[0].waitForTimeout(2500);
for (const [i, page] of kids.entries()) {
	const name = i ? 'Ola' : 'Kari';
	const list = await page.evaluate(() => localStorage.getItem('pokemonlist') || '');
	check(`${name} caught Mewtwo`, /(^|\|)[NS]150($|\|)/.test(list), list.slice(-20));
	// The winning hit no longer falls on a set answer, so it may or may not also win a round. When it
	// does, the prize must wait for the win screen; __stacked notes it if it ever shows on top.
	if (await page.locator('.catch.open').isVisible()) {
		check(`${name}'s prize waits for the win screen`, !(await page.locator('#bingo-lootbox-overlay').isVisible()));
		await page.locator('#pokeball').click();
		await page.locator('.reset-button:not(.is-hidden)').click();
	}
	await page.locator('#bingo-lootbox-overlay').waitFor({ timeout: 5000 });
	check(`${name}'s prize never showed on top of the win screen`, !(await page.evaluate(() => window.__stacked)));
	check(`${name} leaves the won raid by themselves`, (await page.locator('#raidIndicator').count()) === 0 && (await page.evaluate(() => localStorage.getItem('bingoJoinedCode'))) === null);
}
await shot(kids[1], 'raid-prize-phone');

// "Nytt raid" repeats the setup with a new code, as bingo's "Nytt brett".
await shot(host, 'raid-won-controls');
await host.locator('#newGameBtn').click();
await host.locator('#lobbyCode').waitFor({ timeout: 5000 }).catch(() => {});
const code2 = (await host.locator('#lobbyCode').textContent().catch(() => '')).trim();
check('"Nytt raid" makes a new raid with a new code', /^[0-9A-Z]{6}$/.test(code2) && code2 !== code, `${code} -> ${code2}`);
check('…with the same boss', (await host.locator('.boss-name').textContent()).trim() === 'Mewtwo');

// A child joins the new raid; "Avslutt raidet" mid-fight ends it and goes back to the teacher page.
const kari = kids[0];
await kari.goto(BASE + '/bingo_join.html');
await kari.locator('#code').fill(code2);
await kari.locator('#joinBtn').click();
await kari.waitForURL(BASE + '/');
await kari.goto(BASE + '/pokemath.html?stage=1');
await kari.locator('#raidIndicator').waitFor();
await host.locator('#startGameBtn:not([disabled])').click();
await host.locator('#raidHp').waitFor();
await shot(host, 'raid-fight-controls');
await host.locator('#endGameBtn').click();
await host.waitForURL(/\/l%C3%A6rer\/index\.html|\/lærer\/index\.html/, { timeout: 5000 }).catch(() => {});
check('"Avslutt raidet" goes back to the teacher page', decodeURI(host.url()).endsWith('/lærer/index.html'), decodeURI(host.url()));
await kari.locator('#raidIndicator').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
check('…and the children leave the raid', (await kari.locator('#raidIndicator').count()) === 0);
await host.goto(BASE + '/lærer/raid.html');
await host.locator('#raidSetup').waitFor({ timeout: 5000 }).catch(() => {});
check('…and the raid page starts from the setup', await host.locator('#raidSetup').isVisible());

await browser.close();
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
process.exit(results.every(Boolean) ? 0 : 1);
