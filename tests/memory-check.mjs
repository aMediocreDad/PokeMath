// A whole memory game in the browser: the teacher makes one on /lærer/memory.html, two children
// join with the code and answer problems, their correct answers earn turns on the teacher's
// screen, the teacher finds every pair, and both children catch one of the board's Pokémon.
// Run against tests/serve-worker.sh. Usage: BASE=http://localhost:3125 node tests/memory-check.mjs [outdir]
import { createRequire } from 'module';
import { muteAudio } from './mute.mjs';
import { acceptAsks } from './ask.mjs';
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
/** A child over a bare socket, so a game can start without another browser. */
async function socketChild(code, name) {
	const WebSocket = require('ws');
	const sock = new WebSocket(BASE.replace('http', 'ws') + '/ws');
	await new Promise((r) => sock.on('open', r));
	sock.send(JSON.stringify({ type: 'joinLobby', code, uuid: crypto.randomUUID(), name, icon: '' }));
	return sock;
}

const browser = muteAudio(await webkit.launch());
const hostCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const host = await hostCtx.newPage();
host.on('pageerror', (e) => console.log('host pageerror', e.message));
await acceptAsks(host);

await host.goto(BASE + '/lærer/index.html');
await host.locator('#start-memory').click();
await host.locator('#memorySetup').waitFor();
await host.waitForTimeout(500);
await shot(host, 'memory-setup');
await host.locator('#memorySize [data-value="small"]').click();
await host.locator('#createMemoryBtn').click();
const code = (await host.locator('#lobbyCode').textContent()).trim();
check('the teacher gets a code', /^[0-9A-Z]{6}$/.test(code), code);
check('the lobby shows the face-down board', (await host.locator('#memoryBoard .card').count()) === 12);

/** A child who joins with the code and opens level 1. */
async function child(name, device) {
	const ctx = await browser.newContext({ ...devices[device], extraHTTPHeaders: { 'x-dev-email': `${name.toLowerCase()}-${Date.now()}@test.no` } });
	await ctx.addCookies([{ name: 'cookies', value: 'true', url: BASE }]);
	const page = await ctx.newPage();
	page.on('pageerror', (e) => console.log(name, 'pageerror', e.message));
	await page.goto(BASE + '/');
	await page.evaluate((n) => localStorage.setItem('username', n), name);
	await page.goto(BASE + '/bingo_join.html');
	await page.locator('#studentOut', { hasText: name }).waitFor();
	await page.locator('#code').fill(code);
	await page.locator('#joinBtn').click();
	await page.waitForURL(BASE + '/');
	await page.goto(BASE + '/pokemath.html?stage=1');
	await page.locator('#memoryIndicator').waitFor();
	return page;
}
const kids = [await child('Kari', 'iPad (gen 7)'), await child('Ola', 'iPhone 13')];
check('children see they are waiting', (await kids[0].locator('#memoryIndicator').textContent()).includes('Venter'));
await host.locator('#lobbyPlayers li').nth(1).waitFor();
await shot(host, 'memory-lobby');

await host.locator('#startGameBtn').click();
await host.locator('#memoryMeter').waitFor();
check('a turn costs one answer per child', (await host.locator('#memoryMeter').textContent()).includes('0 / 2'));
check('the class starts with one turn', (await host.locator('#memoryTurns').getAttribute('aria-label')).startsWith('1 '));
check('face-down cards carry no picture', (await host.locator('#memoryBoard .card:not(.up) img').count()) === 0);

const solve = async (page) => {
	const [a, op, b] = (await page.locator('.problem').textContent()).trim().split(/\s+/);
	const [x, y] = [Number(a), Number(b)];
	return op === '+' ? x + y : op === '-' || op === '−' ? x - y : op === '·' ? x * y : x / y;
};
/** Answer correctly, a little over a second apart (the server drops faster answers). */
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

/** index -> Pokémon id, from the pictures of the cards that were face up */
const seen = new Map();
async function look() {
	for (const card of await host.locator('#memoryBoard .card.up').all()) {
		const src = await card.locator('img').getAttribute('src');
		seen.set(Number(await card.getAttribute('data-index')), Number(src.match(/(\d+)\.webp/)[1]));
	}
}
async function flip(index) {
	await host.locator(`#memoryBoard .card[data-index="${index}"]`).click();
	await host.locator(`#memoryBoard .card[data-index="${index}"].up`).waitFor({ timeout: 3000 });
	await look();
}
const matched = async () => new Set(await host.locator('#memoryBoard .card.matched').evaluateAll((els) => els.map((e) => Number(e.dataset.index))));

// The free first turn: two cards.
await flip(0);
check('a tapped card turns over', seen.has(0));
await shot(host, 'memory-first-card');
check('the prompt asks for a second card', (await host.locator('#memoryPrompt').textContent()).includes('ett kort til'));
const twin0 = [...seen].find(([i, id]) => i !== 0 && id === seen.get(0));
await flip(twin0 ? twin0[0] : 1);
await shot(host, 'memory-second-card');
await host.waitForTimeout(2000);
check('the turn is spent', (await host.locator('#memoryTurns').getAttribute('aria-label')).startsWith('0 '));
check('cards cannot be tapped without a turn', await host.locator('#memoryBoard .card:not(.up)').first().isDisabled());
const dimmed = await host.locator('#memoryBoard .card:not(.up) .back').first().evaluate((el) => getComputedStyle(el).filter);
check('…and their backs dim, which a touch screen can see', dimmed.includes('saturate'), dimmed);
await shot(host, 'memory-waiting');

await Promise.all([play(kids[0], 1), play(kids[1], 1)]);
check('an answer from each child earns a turn', (await host.locator('#memoryTurns').getAttribute('aria-label')).startsWith('1 '));
check('children see the board progress', /av 6 par/.test(await kids[1].locator('#memoryIndicator').textContent()));
const overflow = await kids[1].evaluate(() => document.documentElement.scrollWidth - innerWidth);
check('the memory banner fits on a phone', overflow <= 0, `${overflow}px too wide`);
await shot(kids[0], 'memory-child');
await shot(kids[1], 'memory-child-phone');

// Play a perfect memory until the board is solved, earning each turn with answers.
for (let guard = 0; guard < 20 && !(await host.locator('#memoryVictory').isVisible()); guard++) {
	if ((await host.locator('#memoryTurns').getAttribute('aria-label')).startsWith('0 ')) await Promise.all([play(kids[0], 1), play(kids[1], 1)]);
	const done = await matched();
	const known = [...seen].filter(([i]) => !done.has(i));
	const pair = known.find(([i, id]) => known.some(([j, other]) => j !== i && other === id));
	if (pair) {
		await flip(pair[0]);
		await flip(known.find(([j, id]) => j !== pair[0] && id === pair[1])[0]);
	} else {
		const unknown = [...Array(12).keys()].filter((i) => !seen.has(i) && !done.has(i));
		await flip(unknown[0]);
		const twin = known.find(([, id]) => id === seen.get(unknown[0]));
		await flip(twin ? twin[0] : unknown[1]);
	}
	if (guard === 2) await shot(host, 'memory-play');
	await host.waitForTimeout(2000);
}
await host.locator('#memoryVictory').waitFor({ timeout: 10_000 });
check('the class finds every pair', (await host.locator('#memoryFound').textContent()).includes('6 av 6'));
await host.waitForTimeout(600);
await shot(host, 'memory-won');

const boardIds = [...new Set(seen.values())];
for (const [i, page] of kids.entries()) {
	const name = i ? 'Ola' : 'Kari';
	if (await page.locator('.catch.open').isVisible()) {
		await page.locator('#pokeball').click();
		await page.locator('.reset-button:not(.is-hidden)').click();
	}
	await page.locator('#bingo-lootbox-overlay').waitFor({ timeout: 5000 });
	if (i) await shot(page, 'memory-prize-phone');
	const list = await page.evaluate(() => localStorage.getItem('pokemonlist') || '');
	check(`${name} caught a Pokémon from the board`, boardIds.some((id) => new RegExp(`(^|\\|)[NS]${id}($|\\|)`).test(list)), list.slice(-30));
	check(`${name} leaves the solved game by themselves`, (await page.locator('#memoryIndicator').count()) === 0);
}

// "Nytt memory" makes a fresh board with a new code; "Avslutt memory" mid-game goes back.
await host.locator('#newGameBtn').click();
await host.locator('#lobbyCode').waitFor({ timeout: 5000 }).catch(() => {});
const code2 = (await host.locator('#lobbyCode').textContent().catch(() => '')).trim();
check('"Nytt memory" makes a new game with a new code', /^[0-9A-Z]{6}$/.test(code2) && code2 !== code, `${code} -> ${code2}`);
check('…with the same board size', (await host.locator('#memoryBoard .card').count()) === 12);
const lise = await socketChild(code2, 'Lise');
await host.locator('#startGameBtn:not([disabled])').click();
await host.locator('#memoryMeter').waitFor();
await host.locator('#endGameBtn').click();
await host.waitForURL(/l%C3%A6rer\/index\.html|lærer\/index\.html/, { timeout: 5000 }).catch(() => {});
check('"Avslutt memory" goes back to the teacher page', decodeURI(host.url()).endsWith('/lærer/index.html'), decodeURI(host.url()));
lise.close();

// The teacher's screen on a phone, for a teacher without a projector.
const phone = await browser.newContext({ ...devices['iPhone 13'] });
const hp = await phone.newPage();
await acceptAsks(hp);
await hp.goto(BASE + '/lærer/memory.html');
await hp.locator('#memorySetup').waitFor();
await shot(hp, 'memory-setup-phone');
await hp.locator('#memorySize [data-value="large"]').click();
await hp.locator('#createMemoryBtn').click();
const sock = await socketChild((await hp.locator('#lobbyCode').textContent()).trim(), 'Per');
await hp.locator('#lobbyPlayers li').first().waitFor();
await shot(hp, 'memory-lobby-phone');
await hp.locator('#startGameBtn').click();
await hp.locator('#memoryMeter').waitFor();
await hp.waitForTimeout(500);
const hpOverflow = await hp.evaluate(() => document.documentElement.scrollWidth - innerWidth);
check('the teacher page fits on a phone', hpOverflow <= 0, `${hpOverflow}px too wide`);
await shot(hp, 'memory-play-phone');
await hp.locator('#endGameBtn').click();
sock.close();

await browser.close();
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
process.exit(results.every(Boolean) ? 0 : 1);
