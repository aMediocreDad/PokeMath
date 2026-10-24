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
	page.on('pageerror', (e) => console.log('pageerror', e.message));
	/** @type {string[]} */
	const outside = [];
	page.on('request', (r) => {
		if (!r.url().startsWith(BASE) && !/^(data|blob):/.test(r.url())) outside.push(r.url());
	});
	return { ctx, page, outside };
}

/**
 * Open a page with a save already in place, once per tab: the header's storage notice is seen, and
 * the save is there before any script runs, so the cloud save never sees an empty device first.
 * @param {import('playwright-core').Page} page
 */
async function visit(page, path, seed = {}) {
	await page.addInitScript((save) => {
		if (sessionStorage.getItem('events-check-seeded')) return;
		sessionStorage.setItem('events-check-seeded', '1');
		for (const [key, value] of Object.entries(save)) localStorage.setItem(key, value);
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

// ---- the spring event ------------------------------------------------------------------------
const EASTER = '/easter.html';
const bar = (page, n) => page.locator('.bars').nth(n);
const countOf = (page, n, state) => bar(page, n).locator(`.item.${state}`).count();
const fakeGlobal = (page, total, milestones = []) =>
	page.route('**/api/easter/global', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ total, milestones }) }));
const closeLootbox = async (page) => {
	await page.locator('#bingo-lootbox-overlay').click();
	await sleep(700);
	await page.locator('#bingo-lootbox-overlay').click();
	await sleep(300);
};

{
	// 20 April, 175 caught here, the first prize taken.
	const { ctx, page, outside } = await device();
	await fakeGlobal(page, 0);
	await visit(page, `${EASTER}?date=2026-04-20`, { easterYear: '2026', easterCaught: '175', easterClaimed: '[0]', easterLocalTs: JSON.stringify({ 1: Date.UTC(2026, 3, 18, 12, 0) }) });
	await page.waitForSelector('.item');
	await sleep(900);
	check('the countdown runs to the end of April', /Avsluttes om:\s*10d/.test(await page.locator('#easterCountdown').innerText()), await page.locator('#easterCountdown').innerText());
	check('this device: 175 / 500', (await bar(page, 0).locator('.count').innerText()) === '175 / 500', await bar(page, 0).locator('.count').innerText());
	check('this device: one taken, two eggs, seven shut', (await countOf(page, 0, 'claimed')) === 1 && (await countOf(page, 0, 'reached')) === 2 && (await countOf(page, 0, 'locked')) === 7);
	check('the time of the first block shows', /18\. apr\./.test(await bar(page, 0).locator('.item').first().locator('.time').innerText()));
	check('a shut prize is no button', (await bar(page, 0).locator('.item.locked button').count()) === 0);

	await bar(page, 0).locator('.item.reached button').first().click();
	await page.waitForSelector('#bingo-lootbox-overlay');
	await closeLootbox(page);
	check('opening an egg gives the Pokémon and the coins', (await list(page)).join('|') === 'N298-E1' && (await money(page)) === 2000, `${await list(page)} ${await money(page)}`);
	check('the prize is written down', (await get(page, 'easterClaimed')) === '[0,1]', await get(page, 'easterClaimed'));
	check('the egg is a Pokémon now', (await countOf(page, 0, 'claimed')) === 2 && (await countOf(page, 0, 'reached')) === 1);
	check('the prize screen is gone', (await count(page, '#bingo-lootbox-overlay')) === 0);

	await reload(page);
	await page.waitForSelector('.item');
	check('after a reload the prize stays taken and nothing is paid again', (await countOf(page, 0, 'claimed')) === 2 && (await money(page)) === 2000 && (await list(page)).length === 1);
	check('no request leaves the site', outside.length === 0, outside.join(' '));
	await ctx.close();
}

{
	// Everyone's bar: 300 000 caught, two blocks reached.
	const { ctx, page } = await device();
	await fakeGlobal(page, 300000, [
		{ segment: 1, reached_at: '2026-03-24T10:14:00.000Z' },
		{ segment: 2, reached_at: '2026-03-25T09:12:00.000Z' }
	]);
	await visit(page, `${EASTER}?date=2026-04-20`);
	await page.waitForSelector('.item');
	await sleep(1200);
	check('everyone: 300 000 / 1 500 000', (await bar(page, 1).locator('.count').innerText()).replace(/\s/g, ' ') === '300 000 / 1 500 000', await bar(page, 1).locator('.count').innerText());
	check('everyone: two eggs, eight shut', (await countOf(page, 1, 'reached')) === 2 && (await countOf(page, 1, 'locked')) === 8);
	check('everyone: the steps are 150k, 300k ... 1,5M', (await bar(page, 1).locator('.threshold').allInnerTexts()).join(' ') === '150k 300k 450k 600k 750k 900k 1,05M 1,2M 1,35M 1,5M', (await bar(page, 1).locator('.threshold').allInnerTexts()).join(' '));
	check('everyone: the Worker\'s times show', /24\. mars/.test(await bar(page, 1).locator('.item').first().locator('.time').innerText()));
	check('no bonus goals before 1 500 000', (await count(page, '.extras')) === 0);
	await bar(page, 1).locator('.item.reached button').first().click();
	await page.waitForSelector('#bingo-lootbox-overlay');
	await closeLootbox(page);
	check('opening a global egg gives its Pokémon and coins', (await list(page)).join('|') === 'N43-E1' && (await money(page)) === 5000 && (await get(page, 'easterGlobalClaimed')) === '[0]', `${await list(page)} ${await money(page)}`);
	await ctx.close();
}

{
	// Beyond 1 500 000: the bonus goals.
	const { ctx, page } = await device();
	await fakeGlobal(page, 3100000);
	await visit(page, `${EASTER}?date=2026-04-20`);
	await page.waitForSelector('.extras');
	check('bonus goals show: one egg, two shut', (await count(page, '.card.reached')) === 1 && (await count(page, '.card.locked')) === 2);
	check('a shut bonus goal hides its name', (await page.locator('.card.locked .card-name').first().innerText()) === '???');
	check('all ten global eggs are open', (await countOf(page, 1, 'reached')) === 10);
	await page.locator('.card.reached button').click();
	await page.waitForSelector('#bingo-lootbox-overlay');
	await closeLootbox(page);
	check('opening a bonus egg gives the shiny and 150 000 coins', (await list(page)).join('|') === 'S421-E1' && (await money(page)) === 150000 && (await get(page, 'easterExtraClaimed')) === '[0]', `${await list(page)} ${await money(page)}`);
	check('the bonus goal is taken', (await count(page, '.card.claimed')) === 1 && (await page.locator('.card.claimed .card-status').innerText()).includes('Hentet'));
	await ctx.close();
}

{
	// The Worker's real counter, with no mock: a catch counts, and the page shows the count.
	const { ctx, page } = await device();
	const total = async () => (await (await fetch(BASE + '/api/easter/global')).json()).total;
	const before = await total();
	for (let i = 0; i < 2; i++) await fetch(BASE + '/api/easter/catch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
	const after = await total();
	check('two catches raise the Worker\'s count by two', after === before + 2, `${before} -> ${after}`);
	await visit(page, `${EASTER}?date=2026-04-20`);
	await page.waitForSelector('.item');
	await sleep(1200);
	check('the page shows the Worker\'s count', (await bar(page, 1).locator('.count').innerText()).replace(/\s/g, '').startsWith(String(after)), `${await bar(page, 1).locator('.count').innerText()} vs ${after}`);
	await ctx.close();
}

{
	// The Worker is down: the page still works, with no count for everyone.
	const { ctx, page } = await device();
	await page.route('**/api/easter/global', (route) => route.fulfill({ status: 500, body: 'no' }));
	await visit(page, `${EASTER}?date=2026-04-20`, { easterYear: '2026', easterCaught: '60' });
	await page.waitForSelector('.item');
	await sleep(800);
	check('no answer from the Worker: no count for everyone, and this device still works', (await bar(page, 1).locator('.count').innerText()).startsWith('–') && (await countOf(page, 0, 'reached')) === 1);
	await ctx.close();
}

{
	// The event ends on 30 April.
	const { ctx, page } = await device();
	await fakeGlobal(page, 0);
	await visit(page, `${EASTER}?date=2026-05-01`);
	await page.waitForSelector('.item');
	check('1 May: the event is over', (await page.locator('#easterCountdown').innerText()) === 'Eventet er avsluttet.', await page.locator('#easterCountdown').innerText());
	await page.goto(BASE + `${EASTER}?date=2026-04-30T23:59`);
	await page.waitForSelector('.item');
	await sleep(1200);
	check('30 April 23:59: a minute left', /0d\s*0t\s*00m|0d\s*0t\s*0\dm/.test((await page.locator('#easterCountdown').innerText()).replace(/\n/g, ' ')), await page.locator('#easterCountdown').innerText());
	await ctx.close();
}

{
	// Phone and desktop: nothing scrolls sideways, and an egg is at least 44 px.
	for (const desktop of [false, true]) {
		const { ctx, page } = await device({ desktop });
		await fakeGlobal(page, 3100000);
		await visit(page, `${EASTER}?date=2026-04-20`, { easterYear: '2026', easterCaught: '175' });
		await page.waitForSelector('.extras');
		const wide = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
		const egg = await page.evaluate(() => Math.min(...[...document.querySelectorAll('.egg')].map((e) => Math.min(e.getBoundingClientRect().width, e.getBoundingClientRect().height))));
		const cut = await page.evaluate(() => [...document.querySelectorAll('.item .coins')].filter((c) => c.scrollWidth > c.clientWidth + 1).length);
		check(`${desktop ? 'desktop' : 'phone'}: the page does not scroll sideways`, wide <= 0, `${wide} px`);
		check(`${desktop ? 'desktop' : 'phone'}: every egg is at least 44 px`, egg >= 44, `${Math.round(egg)} px`);
		check(`${desktop ? 'desktop' : 'phone'}: no coin text is cut off`, cut === 0, `${cut} cut`);
		await ctx.close();
	}
}

await browser.close();
process.exit(failed ? 1 : 0);
