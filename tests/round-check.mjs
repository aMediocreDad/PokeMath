// The round in progress survives a reload: score, mistakes, the problem on screen, and a won ball
// not thrown yet. A thrown ball is never offered twice. Run against tests/serve-worker.sh.
// Usage: node tests/round-check.mjs
import { createRequire } from 'module';
import { muteAudio } from './mute.mjs';
const require = createRequire(import.meta.url);
const { webkit, devices } = require('playwright-core');
const BASE = 'http://localhost:3123';
const results = [];
const check = (name, ok, detail = '') => {
	results.push(ok);
	console.log(ok ? 'PASS' : 'FAIL', name, detail);
};

const browser = muteAudio(await webkit.launch());
const ctx = await browser.newContext({ ...devices['iPad (gen 7)'], extraHTTPHeaders: { 'x-dev-email': `round-${Date.now()}@test.no` } });
await ctx.addCookies([{ name: 'cookies', value: 'true', url: BASE }]);
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));

const problemText = () => page.locator('.problem').textContent().then((t) => t.trim());
const status = () => page.locator('.points-needed').textContent().then((t) => t.trim());
const caught = () => page.evaluate(() => (localStorage.getItem('pokemonlist') || '').split('|').filter(Boolean).length);
const ballUp = () => page.locator('#pokeball:not(.is-hidden)').isVisible();
const solve = async () => {
	const [a, op, b] = (await problemText()).split(/\s+/);
	const [x, y] = [Number(a), Number(b)];
	return op === '+' ? x + y : op === '-' || op === '−' ? x - y : op === 'x' || op === '·' ? x * y : x / y;
};
const answer = async (value) => {
	await page.locator('.our-field').fill(String(value));
	await page.locator('.answer-button').click();
	await page.waitForTimeout(700);
};
const open = async (path) => {
	await page.goto(BASE + path);
	await page.locator('.problem').waitFor({ state: 'attached' });
	await page.waitForTimeout(800);
};

await open('/pokemath.html?stage=1');
await answer(await solve());
await answer(await solve());
await answer(-999);
const before = { problem: await problemText(), status: await status() };
await open('/pokemath.html?stage=1');
const after = { problem: await problemText(), status: await status() };
check('reload keeps the problem', before.problem === after.problem, `${before.problem} / ${after.problem}`);
check('reload keeps score and mistakes', before.status === after.status, after.status);

await open('/pokemath.html?stage=2');
const rounds = await page.evaluate(() => JSON.parse(localStorage.getItem('pm-round') || 'null'));
const other = rounds?.['?stage=2'];
check('another level starts a fresh round', other?.score === 0 && other.wrongAnswers === 0, JSON.stringify(other));
await open('/pokemath.html?stage=1');
check('and the first level keeps its round', (await problemText()) === after.problem && (await status()) === after.status, await status());

await open('/pokemath.html?stage=1');
for (let i = 0; i < 10 && !(await ballUp()); i++) await answer(await solve());
check('the round is won', await ballUp());
await open('/pokemath.html?stage=1');
check('reload still offers the ball', await ballUp());
const n = await caught();
await page.locator('#pokeball').click();
await page.waitForTimeout(800);
check('throwing it catches one Pokémon', (await caught()) === n + 1, `${n} -> ${await caught()}`);
await open('/pokemath.html?stage=1');
check('no second ball after a reload', !(await ballUp()) && (await caught()) === n + 1, await status());

// A seasonal event's Pokémon (October: the Halloween egg) is caught mid-round; "Fortsett" goes back
// to the same round instead of starting over.
if (new Date().getMonth() === 9) {
	await page.evaluate((year) => {
		for (const [k, v] of Object.entries({ 'he-year': year, 'he-eggid': 1, 'he-eggneeded': 5, 'he-eggstatus': 5, 'he-eggsolved': 0 })) localStorage.setItem(k, JSON.stringify(v));
	}, new Date().getFullYear());
	await open('/pokemath.html?stage=1');
	await answer(await solve());
	await answer(await solve());
	const mid = await status();
	await page.locator('#halloween-egg .open').click();
	await page.waitForTimeout(800);
	await page.locator('.reset-button').click();
	await page.waitForTimeout(300);
	check('closing an egg Pokémon keeps the round', (await status()) === mid, `${mid} / ${await status()}`);
}

// Another child logs in on this iPad without the last one logging out: no round carries over.
await open('/pokemath.html?stage=1');
await answer(await solve());
await answer(await solve());
const roundOf = () => page.evaluate(() => JSON.parse(localStorage.getItem('pm-round') || '{}')['?stage=1']?.score ?? null);
check('a round is in progress', (await roundOf()) > 0, String(await roundOf()));
await ctx.setExtraHTTPHeaders({ 'x-dev-email': `round-other-${Date.now()}@test.no` });
// A real login clears the tab's cached identity (worker/login.js); switching the header does not.
await page.evaluate(() => sessionStorage.clear());
await open('/pokemath.html?stage=1');
await page.waitForTimeout(1500);
check("the next child does not get the last one's round", (await roundOf()) === 0, String(await roundOf()));

await browser.close();
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
process.exit(results.every(Boolean) ? 0 : 1);
