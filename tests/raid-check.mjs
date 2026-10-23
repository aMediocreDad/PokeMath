// A whole raid in the browser: the teacher makes one on /lærer/raid.html, two children join with the
// code and answer problems, every correct answer hits the boss on the teacher's screen, and both
// children catch it. Run against tests/serve-worker.sh. Usage: node tests/raid-check.mjs [outdir]
import { createRequire } from 'module';
import { muteAudio } from './mute.mjs';
const require = createRequire(import.meta.url);
const { webkit, devices } = require('playwright-core');
const BASE = 'http://localhost:3123';
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
check('start gives 10 health per child', (await host.locator('#raidHp').textContent()).trim() === '20 / 20 liv');

const solve = async (page) => {
	const [a, op, b] = (await page.locator('.problem').textContent()).trim().split(/\s+/);
	const [x, y] = [Number(a), Number(b)];
	return op === '+' ? x + y : op === '-' || op === '−' ? x - y : op === '·' ? x * y : x / y;
};
/** Answer correctly, a little over a second apart (the server drops faster hits). */
async function play(page, times) {
	for (let i = 0; i < times; i++) {
		if (await page.locator('#pokeball:not(.is-hidden)').isVisible()) {
			await page.locator('#pokeball').click();
			await page.waitForTimeout(400);
			await page.locator('.reset-button:not(.is-hidden)').click();
		}
		await page.locator('.our-field').fill(String(await solve(page)));
		await page.locator('.answer-button').click();
		await page.waitForTimeout(1150);
	}
}
await Promise.all([play(kids[0], 4), play(kids[1], 4)]);
const mid = (await host.locator('#raidHp').textContent()).trim();
check('correct answers hit the boss', mid === '12 / 20 liv', mid);
await shot(host, 'raid-fight');
check('children see the boss lose health', (await kids[1].locator('#raidIndicator').textContent()).includes('12 / 20'));
const overflow = await kids[1].evaluate(() => document.documentElement.scrollWidth - innerWidth);
check('the raid banner fits on a phone', overflow <= 0, `${overflow}px too wide`);
await shot(kids[0], 'raid-child');
await shot(kids[1], 'raid-child-phone');

await Promise.all([play(kids[0], 6), play(kids[1], 6)]);
await host.locator('#raidVictory').waitFor({ timeout: 10_000 });
check('the class wins', true);
await host.waitForTimeout(600);
await shot(host, 'raid-won');
await kids[0].waitForTimeout(2500);
for (const [i, page] of kids.entries()) {
	const name = i ? 'Ola' : 'Kari';
	const list = await page.evaluate(() => localStorage.getItem('pokemonlist') || '');
	check(`${name} caught Mewtwo`, /(^|\|)[NS]150($|\|)/.test(list), list.slice(-20));
	// The winning hit was each child's tenth answer, which also won a round: the prize waits.
	check(`${name}'s prize waits for the win screen`, (await page.locator('.catch.open').isVisible()) && !(await page.locator('#bingo-lootbox-overlay').isVisible()));
	await page.locator('#pokeball').click();
	await page.locator('.reset-button:not(.is-hidden)').click();
	await page.locator('#bingo-lootbox-overlay').waitFor({ timeout: 5000 });
	check(`${name} sees the prize after the win screen`, !(await page.evaluate(() => window.__stacked)));
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
