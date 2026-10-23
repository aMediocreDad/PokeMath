// Bingo prizes in the browser: a full row pays every child with a catch 500 coins, and the teacher's
// "Del ut premien nå" ends the game with the main prize before the board is full.
// Run against tests/serve-worker.sh. Usage: node tests/bingo-prize-check.mjs [outdir]
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
const teacherCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
// Keep the host page's sockets reachable, so the test can drop its connection.
await teacherCtx.addInitScript(() => {
	const Native = WebSocket;
	window.__sockets = [];
	window.WebSocket = class extends Native {
		constructor(...args) {
			super(...args);
			window.__sockets.push(this);
		}
	};
});
const teacher = await teacherCtx.newPage();
teacher.on('pageerror', (e) => console.log('teacher pageerror', e.message));
teacher.on('dialog', (d) => d.accept());
await teacher.goto(BASE + '/lærer/bingo_settings.html');
await teacher.selectOption('#prizeType', 'coins');
await teacher.click('#startBtn');
await teacher.waitForFunction(() => /^[A-Z0-9]{6}$/.test(document.getElementById('code')?.textContent.trim() ?? ''), null, { timeout: 15000 });
const code = (await teacher.textContent('#code')).trim();

const ctx = await browser.newContext({ ...devices['iPad (gen 7)'], extraHTTPHeaders: { 'x-dev-email': `premie-${Date.now()}@test.no` } });
await ctx.addCookies([{ name: 'cookies', value: 'true', url: BASE }]);
// A child who has played before; a brand-new device gets the join page's missing-save warning.
await ctx.addInitScript(() => localStorage.getItem('username') || localStorage.setItem('username', 'Kari'));
const child = await ctx.newPage();
child.on('pageerror', (e) => console.log('child pageerror', e.message));
await child.goto(`${BASE}/bingo_join.html?code=${code}`);
// The page reads the code from the address when it starts; a tap before that finds no code.
await child.locator('#studentOut', { hasText: 'Kari' }).waitFor();
await child.click('#joinBtn');
await child.waitForURL(BASE + '/');
await child.goto(BASE + '/pokemath.html?stage=1');
await child.locator('#bingoIndicator').waitFor();

// One catch, so the child has a share in the prizes.
const solve = async () => {
	const [a, op, b] = (await child.locator('.problem').textContent()).trim().split(/\s+/);
	return op === '+' ? Number(a) + Number(b) : Number(a) - Number(b);
};
for (let i = 0; i < 10 && !(await child.locator('#pokeball:not(.is-hidden)').isVisible()); i++) {
	await child.locator('.our-field').fill(String(await solve()));
	await child.locator('.answer-button').click();
	await child.waitForTimeout(300);
}
await child.locator('#pokeball').click();
await child.locator('.reset-button:not(.is-hidden)').click();
await teacher.waitForFunction(() => /1/.test(document.querySelector('#players .player-row')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => {});

// The teacher fills row 1 by hand. The child's catch can mark one of its cells while this runs,
// and a tap on that cell would unmark it again, so go over the row until all five are marked.
const rowCells = teacher.locator('#bingoCard tr').first().locator('td[data-cell-id]');
const marked = async (i) => (await rowCells.nth(i).getAttribute('class'))?.includes('toggled');
for (let pass = 0; pass < 3; pass++) {
	for (let i = 0; i < 5; i++) {
		if (!(await marked(i))) await rowCells.nth(i).click();
		await teacher.waitForTimeout(250);
	}
	await teacher.waitForTimeout(400);
	if ((await Promise.all([0, 1, 2, 3, 4].map(marked))).every(Boolean)) break;
}
await teacher.locator('#toast', { hasText: 'Rad 1' }).waitFor({ timeout: 5000 });
check('the teacher sees the row pay out', (await teacher.locator('#toast').textContent()).includes('+500 mynter til 1 elev'));
await shot(teacher, 'bingo-row');
await child.locator('#bingo-lootbox-overlay').waitFor({ timeout: 5000 });
await child.locator('#bingo-lootbox-overlay').click();
const rowPrize = await child.locator('.blootbox-label').textContent();
check('the child gets the row prize', rowPrize.includes('Rad 1') && rowPrize.includes('500'), rowPrize.trim());
await shot(child, 'bingo-row-child');
await child.locator('#bingo-lootbox-overlay').click();

// The connection drops (bad school wifi): the host page connects again and keeps the same game.
await teacher.evaluate(() => window.__sockets.at(-1).close());
await teacher.waitForFunction(() => window.__sockets.length > 1 && window.__sockets.at(-1).readyState === 1, null, { timeout: 10000 }).catch(() => {});
await teacher.waitForTimeout(500);
check('the host page connects again by itself', await teacher.evaluate(() => window.__sockets.length > 1 && window.__sockets.at(-1).readyState === 1));
const cell = teacher.locator('#bingoCard tr').nth(1).locator('td[data-cell-id]').first();
await cell.click();
await teacher.waitForTimeout(800);
check('…and goes on with the same game', (await cell.getAttribute('class'))?.includes('toggled') && (await teacher.textContent('#code')).trim() === code);

const before = await child.evaluate(() => Number(localStorage.getItem('money') || 0));
await teacher.click('#giveNowBtn');
await teacher.locator('#giveNowBtn:disabled').waitFor({ timeout: 5000 });
check('the button says the prize is handed out', (await teacher.textContent('#giveNowBtn')).includes('delt ut'));
await shot(teacher, 'bingo-given');
await child.locator('#bingo-lootbox-overlay').waitFor({ timeout: 5000 });
await child.locator('#bingo-lootbox-overlay').click();
const mainPrize = await child.locator('.blootbox-label').textContent();
check('the child gets the main prize', /10\s?000/.test(mainPrize), mainPrize.trim());
await child.locator('#bingo-lootbox-overlay').click();
const after = await child.evaluate(() => Number(localStorage.getItem('money') || 0));
check('the coins are added', after - before === 10000, `${before} -> ${after}`);
check('the child leaves the finished bingo by themselves', (await child.locator('#bingoIndicator').count()) === 0 && (await child.evaluate(() => localStorage.getItem('bingoJoinedCode'))) === null);

await browser.close();
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
process.exit(results.every(Boolean) ? 0 : 1);
