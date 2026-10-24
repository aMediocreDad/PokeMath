// The Christmas calendar (christmas.html) and the spring event (easter.html) in WebKit, against a
// local Worker (tests/serve-worker.sh). The dates are set with ?date=, which the pages honour on
// localhost only (src/lib/game/eventClock.js). Every case gets its own browser profile and login.
// Usage: BASE=http://localhost:3134 node tests/events-check.mjs
import { createRequire } from 'module';
import { muteAudio } from './mute.mjs';
const require = createRequire(import.meta.url);
const { webkit, devices } = require('playwright-core');
const BASE = process.env.BASE || 'http://localhost:3123';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const check = (name, ok, detail = '') => {
	console.log(ok ? 'PASS' : 'FAIL', name, detail);
	if (!ok) failed++;
};

const browser = muteAudio(await webkit.launch());
let n = 0;

/** A fresh device: its own login, empty storage. @param {{ desktop?: boolean }} [options] */
async function device({ desktop = false } = {}) {
	const ctx = await browser.newContext({
		...(desktop ? { viewport: { width: 1280, height: 800 } } : devices['iPhone 13']),
		extraHTTPHeaders: { 'x-dev-email': `events-${Date.now()}-${n++}@test.no` }
	});
	const page = await ctx.newPage();
	// Leaving the page that seeds the save cuts its own requests short: not a fault in the page under test.
	page.on('pageerror', (e) => /access control|preload CSS|service-worker/.test(e.message) || console.log('pageerror', e.message));
	/** @type {string[]} */
	const outside = [];
	page.on('request', (r) => {
		if (!r.url().startsWith(BASE) && !/^(data|blob):/.test(r.url())) outside.push(r.url());
	});
	return { ctx, page, outside };
}

/** Open a page after putting a save in place; the header's storage notice is already seen. @param {import('playwright-core').Page} page */
async function visit(page, path, seed = {}) {
	await page.goto(BASE + '/faq.html');
	await page.evaluate((s) => {
		localStorage.clear();
		for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
	}, { storageNoticeSeen: '1', ...seed });
	await page.goto(BASE + path);
}
const reload = async (page) => {
	await page.reload();
	await sleep(600);
};
const get = (page, key) => page.evaluate((k) => localStorage.getItem(k), key);
const money = async (page) => Number((await get(page, 'money')) || 0);
const list = async (page) => ((await get(page, 'pokemonlist')) || '').split('|').filter(Boolean);
const count = (page, selector) => page.locator(selector).count();

// ---- Christmas -------------------------------------------------------------------------------
const XMAS = '/christmas.html';
const doorByText = (page, day) => page.locator('.door', { has: page.locator('.num', { hasText: new RegExp(`^${day}$`) }) });
const doorsReady = async (page) => (await page.locator('.door.ready .num').allInnerTexts()).map(Number).sort((a, b) => a - b);

{
	// 10 December: doors 1-10 are lit, the rest are shut.
	const { ctx, page } = await device();
	await visit(page, `${XMAS}?date=2026-12-10`);
	await page.waitForSelector('.door');
	check('10 December: the 24 doors are there', (await count(page, '.door')) === 24);
	check('10 December: doors 1-10 can be opened', (await doorsReady(page)).join() === '1,2,3,4,5,6,7,8,9,10', (await doorsReady(page)).join());
	check('10 December: the shut doors say so', (await doorByText(page, 14).getAttribute('aria-disabled')) === 'true' && (await doorByText(page, 14).getAttribute('aria-label')).includes('låst'));
	check('the date shows', /10\. desember 2026/.test(await page.locator('.above').innerText()), await page.locator('.above').innerText());

	await doorByText(page, 14).click({ force: true });
	await sleep(300);
	check('a door before its day does nothing', (await money(page)) === 0 && (await get(page, 'xmasOpened')) === '[]', `money ${await money(page)}`);

	await doorByText(page, 5).click();
	await sleep(300);
	check('door 5 gives its Pokémon and 1000 coins', (await list(page)).join() === 'N174-C1' && (await money(page)) === 1000, `${await list(page)} ${await money(page)}`);
	check('the door is written down for this year', (await get(page, 'xmasOpened')) === '[5]' && (await get(page, 'xmasYear')) === '2026', `${await get(page, 'xmasOpened')} ${await get(page, 'xmasYear')}`);
	check('the door shows its picture', await doorByText(page, 5).evaluate((el) => el.classList.contains('opened') && /50012\.webp/.test(el.style.backgroundImage)));
	check('the prize is announced', (await count(page, '.pm-notification')) === 1 && (await count(page, '.pm-toast')) === 1);

	await doorByText(page, 5).click({ force: true });
	await sleep(300);
	check('an opened door pays nothing more', (await money(page)) === 1000 && (await list(page)).length === 1);

	// Two quick taps on one door: paid once.
	await doorByText(page, 3).evaluate((el) => {
		el.click();
		el.click();
	});
	await sleep(300);
	check('two quick taps pay once', (await list(page)).join('|') === 'N174-C1|N198-C1' && (await money(page)) === 2000, `${await list(page)} ${await money(page)}`);

	await doorByText(page, 7).click();
	await sleep(300);
	check('door 7 gives 20 000 coins and no Pokémon', (await money(page)) === 22000 && (await list(page)).length === 2, `${await money(page)}`);

	await reload(page);
	await page.waitForSelector('.door');
	check('after a reload the opened doors stay opened', (await page.locator('.door.opened .num').allInnerTexts()).map(Number).sort((a, b) => a - b).join() === '3,5,7');
	await doorByText(page, 5).click({ force: true });
	await doorByText(page, 7).click({ force: true });
	await sleep(300);
	check('after a reload nothing is paid twice', (await money(page)) === 22000 && (await list(page)).length === 2);
	await ctx.close();
}

{
	// A door opens on its day and not before; opening it later pays it once.
	const { ctx, page } = await device();
	await visit(page, `${XMAS}?date=2026-12-04`);
	await page.waitForSelector('.door');
	check('4 December: door 5 is shut', (await doorByText(page, 5).getAttribute('aria-disabled')) === 'true');
	await doorByText(page, 5).click({ force: true });
	await sleep(300);
	check('4 December: tapping door 5 gives nothing', (await money(page)) === 0 && (await list(page)).length === 0);
	await page.goto(BASE + `${XMAS}?date=2026-12-05`);
	await page.waitForSelector('.door');
	check('5 December: door 5 opens', (await doorByText(page, 5).getAttribute('aria-disabled')) === 'false');
	await doorByText(page, 5).click();
	await sleep(300);
	check('5 December: door 5 pays', (await money(page)) === 1000);
	await ctx.close();
}

{
	// No ?date=: the device's clock decides, and no other site is asked for the time.
	const { ctx, page, outside } = await device();
	await ctx.clock.install({ time: new Date(2026, 11, 7, 10, 0) });
	await visit(page, XMAS);
	await page.waitForSelector('.door, .not-yet');
	check("the device's clock decides: 7 December lights doors 1-7", (await doorsReady(page)).join() === '1,2,3,4,5,6,7', (await doorsReady(page)).join());
	check('no request leaves the site for the date', outside.length === 0, outside.join(' '));
	await ctx.close();
}

{
	// The clock moves back and forth: doors opened stay opened, and nothing is paid twice.
	const { ctx, page } = await device();
	await visit(page, `${XMAS}?date=2026-12-06`, { xmasYear: '2026', xmasOpened: '[1,5,12]' });
	await page.waitForSelector('.door');
	check('an earlier day: only the doors up to it show as opened', (await page.locator('.door.opened .num').allInnerTexts()).map(Number).sort((a, b) => a - b).join() === '1,5');
	check('an earlier day: the save keeps door 12', (await get(page, 'xmasOpened')) === '[1,5,12]', await get(page, 'xmasOpened'));
	await page.goto(BASE + `${XMAS}?date=2026-12-12`);
	await page.waitForSelector('.door');
	check('back on the 12th: door 12 is opened, and not paid again', (await doorByText(page, 12).evaluate((el) => el.classList.contains('opened'))) && (await money(page)) === 0);
	await ctx.close();
}

{
	// Outside December there is no calendar.
	const { ctx, page } = await device();
	await visit(page, `${XMAS}?date=2026-10-24`);
	await page.waitForSelector('.not-yet');
	check('24 October: come back in December', (await page.locator('.not-yet').innerText()) === 'Kom tilbake i desember!' && (await count(page, '.door')) === 0);
	await ctx.close();
}

{
	// The save as the legacy page and a restored backup leave it.
	const { ctx, page } = await device();
	await visit(page, `${XMAS}?date=2026-12-10`, { xmasYear: '"2026"', xmasOpened: '"[1,3]"' });
	await page.waitForSelector('.door');
	check('a double-encoded save: its doors are opened', (await page.locator('.door.opened .num').allInnerTexts()).map(Number).sort((a, b) => a - b).join() === '1,3');
	await doorByText(page, 2).click();
	await sleep(300);
	check('the plain array is written back', (await get(page, 'xmasOpened')) === '[1,3,2]', await get(page, 'xmasOpened'));
	await ctx.close();
}

{
	// A new year: last year's doors are all shut again, not just door 1.
	const { ctx, page } = await device();
	await visit(page, `${XMAS}?date=2026-12-10`, { xmasYear: '2025', xmasOpened: '[1,2,3,4,5]', money: '700' });
	await page.waitForSelector('.door');
	check('a new year: no door is shown opened', (await count(page, '.door.opened')) === 0, (await page.locator('.door.opened .num').allInnerTexts()).join());
	check('a new year: the save starts over', (await get(page, 'xmasYear')) === '2026' && (await get(page, 'xmasOpened')) === '[]', `${await get(page, 'xmasYear')} ${await get(page, 'xmasOpened')}`);
	await doorByText(page, 1).click();
	await doorByText(page, 2).click();
	await sleep(300);
	check('a new year: doors 1 and 2 open and pay again', (await money(page)) === 2700 && (await get(page, 'xmasOpened')) === '[1,2]', `${await money(page)} ${await get(page, 'xmasOpened')}`);
	await reload(page);
	await page.waitForSelector('.door');
	check('a new year: only the doors opened this year stay opened', (await page.locator('.door.opened .num').allInnerTexts()).map(Number).sort((a, b) => a - b).join() === '1,2');
	await ctx.close();
}

{
	// The backgrounds of doors 17 and 24: once, then the price in coins.
	const { ctx, page } = await device();
	await visit(page, `${XMAS}?date=2026-12-24`, { xmasYear: '2026', xmasOpened: '[17]', boughtBackgrounds: 'bg-001|bg-020' });
	await page.waitForSelector('.door');
	await doorByText(page, 21).click();
	await sleep(300);
	check('door 21 gives 50 000 coins', (await money(page)) === 50000);
	await ctx.close();
}
{
	const { ctx, page } = await device();
	await visit(page, `${XMAS}?date=2026-12-17`, { boughtBackgrounds: 'bg-001' });
	await page.waitForSelector('.door');
	await doorByText(page, 17).click();
	await sleep(300);
	check('door 17 gives its background and no coins', (await get(page, 'boughtBackgrounds')) === 'bg-001|bg-020' && (await money(page)) === 0, `${await get(page, 'boughtBackgrounds')} ${await money(page)}`);
	await ctx.close();
}
{
	const { ctx, page } = await device();
	await visit(page, `${XMAS}?date=2026-12-17`, { boughtBackgrounds: 'bg-001|bg-020' });
	await page.waitForSelector('.door');
	await doorByText(page, 17).click();
	await sleep(300);
	check('door 17 with the background already gives 100 000 coins', (await money(page)) === 100000 && (await get(page, 'boughtBackgrounds')) === 'bg-001|bg-020', `${await money(page)}`);
	await ctx.close();
}

{
	// The last door: the shinies, the fireworks, and the fireworks after a reload.
	const { ctx, page } = await device();
	const others = Array.from({ length: 23 }, (_, i) => i + 1);
	await visit(page, `${XMAS}?date=2026-12-24`, { xmasYear: '2026', xmasOpened: JSON.stringify(others) });
	await page.waitForSelector('.door');
	check('23 doors opened: no fireworks yet', (await count(page, '.fireworks')) === 0);
	await doorByText(page, 24).click();
	await sleep(400);
	const owned = await list(page);
	check('the last door gives its background and the four shinies', ['S225-C1', 'S143-C1', 'S151-U1', 'S311-U1'].every((e) => owned.includes(e)) && (await get(page, 'boughtBackgrounds')).includes('bg-019'), owned.join());
	check('the last door shows the fireworks', (await count(page, '.fireworks')) === 1);
	await reload(page);
	await page.waitForSelector('.door');
	check('the fireworks stay after a reload, and no shiny is paid twice', (await count(page, '.fireworks')) === 1 && (await list(page)).length === 4, `${(await list(page)).length}`);
	await ctx.close();
}

{
	// Phone and desktop: every door is a tap target of at least 44 px, and nothing scrolls sideways.
	for (const desktop of [false, true]) {
		const { ctx, page } = await device({ desktop });
		await visit(page, `${XMAS}?date=2026-12-10`);
		await page.waitForSelector('.door');
		const smallest = await page.evaluate(() => Math.min(...[...document.querySelectorAll('.door')].map((d) => Math.min(d.getBoundingClientRect().width, d.getBoundingClientRect().height))));
		const wide = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
		check(`${desktop ? 'desktop' : 'phone'}: every door is at least 44 px`, smallest >= 44, `${Math.round(smallest)} px`);
		check(`${desktop ? 'desktop' : 'phone'}: the page does not scroll sideways`, wide <= 0, `${wide} px`);
		await ctx.close();
	}
}

await browser.close();
process.exit(failed ? 1 : 0);
