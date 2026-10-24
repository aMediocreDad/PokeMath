// The save's guards, one symptom each, at the page: a teacher page first, the IndexedDB copy, a
// login that changed under a tab, "Slett alt", a code tapped twice, a backup file that replaces
// the save, a full storage, and the adaptive level's clock. Run against a fresh local Worker
// (tests/serve-worker.sh). Usage: node tests/save-guards-check.mjs
//
// The Worker answers /api/save with the session's id, DELETE /api/save, and a code already used
// with `used`. Those are stubbed here (page.route) on top of the real answers, so the check holds
// whether the Worker already has them or not.
import { createRequire } from 'module';
import { muteAudio } from './mute.mjs';
const require = createRequire(import.meta.url);
const { webkit } = require('playwright-core');
const BASE = process.env.BASE || 'http://localhost:3123';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => {
	results.push(ok);
	console.log(ok ? 'PASS' : 'FAIL', name, detail);
};
const stamp = Date.now();
const login = (tag) => ({ 'x-dev-email': `guard-${tag}-${stamp}@test.no` });
const idOf = async (headers) => (await (await fetch(BASE + '/api/me', { headers })).json()).id;
const count = (list) => String(list || '').split('|').filter(Boolean).length;
const names = (n) => Array.from({ length: n }, (_, i) => 'N' + (i + 1)).join('|');

const browser = muteAudio(await webkit.launch());

/** A browser context for one login (none: the local default, a teacher). */
async function context(headers) {
	const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 820, height: 1000 }, extraHTTPHeaders: headers });
	await ctx.addCookies([{ name: 'cookies', value: 'true', url: BASE }]);
	return ctx;
}

/** Puts the session's id on /api/save answers, and answers DELETE; records what was sent. */
async function stubSave(ctx, state) {
	await ctx.route('**/api/save', async (route) => {
		const request = route.request();
		const method = request.method();
		if (method === 'DELETE') {
			state.deletes++;
			if (state.failDelete) return route.abort('internetdisconnected');
			state.deleted = true;
			return route.fulfill({ json: { ok: true } });
		}
		if (method === 'GET' && state.deleted) return route.fulfill({ json: { save: null, id: state.id } });
		if (method === 'PUT') {
			state.puts.push(request.postDataJSON());
			if (state.deleted) state.putsAfterDelete++;
		}
		const res = await route.fetch();
		const body = await res.json().catch(() => null);
		if (!body) return route.fulfill({ response: res });
		return route.fulfill({ status: res.status(), json: { ...body, id: state.id } });
	});
}
const newState = (id) => ({ id, deletes: 0, deleted: false, failDelete: false, puts: [], putsAfterDelete: 0 });

async function open(page, path) {
	await page.goto(BASE + path);
	await sleep(1800);
}
const local = (page, key) => page.evaluate((k) => localStorage.getItem(k), key);
const setLocal = (page, key, value) => page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, value]);
const toasts = (page) => page.locator('.pm-toast .text').allTextContents();

const putSnapshot = (page, snapshot) =>
	page.evaluate(async (snap) => {
		const db = await new Promise((res, rej) => {
			const r = indexedDB.open('PokemathBackup', 1);
			r.onupgradeneeded = () => r.result.createObjectStore('snapshots');
			r.onsuccess = () => res(r.result);
			r.onerror = () => rej(r.error);
		});
		await new Promise((res, rej) => {
			const q = db.transaction('snapshots', 'readwrite').objectStore('snapshots').put(snap, 'daily');
			q.onsuccess = res;
			q.onerror = () => rej(q.error);
		});
		db.close();
	}, snapshot);
const readSnapshot = (page) =>
	page.evaluate(async () => {
		const db = await new Promise((res, rej) => {
			const r = indexedDB.open('PokemathBackup', 1);
			r.onupgradeneeded = () => r.result.createObjectStore('snapshots');
			r.onsuccess = () => res(r.result);
			r.onerror = () => rej(r.error);
		});
		const found = await new Promise((res, rej) => {
			const q = db.transaction('snapshots', 'readonly').objectStore('snapshots').get('daily');
			q.onsuccess = () => res(q.result);
			q.onerror = () => rej(q.error);
		});
		db.close();
		return found ?? null;
	});

/** One scenario; a thrown error (a page that went away) is a failure, not the end of the run. */
async function section(name, run) {
	try {
		await run();
	} catch (e) {
		check(`${name}: ran to the end`, false, String(e.message).split('\n')[0]);
	}
}

/** Solve the problem on screen (a plus or minus, as on the first levels). */
async function solve(page) {
	const text = (await page.locator('.problem').textContent()).trim();
	const [a, op, b] = text.split(/\s+/);
	const answer = op === '+' ? Number(a) + Number(b) : Number(a) - Number(b);
	await page.locator('.our-field').fill(String(answer));
	await page.locator('.answer-button').click();
	return { op, text };
}

// 1. The first page is a teacher page; the router then reaches a player page. The save must be
// read first, or a prize overwrites it with an empty one.
await section('teacher page first', async () => {
	const ctx = await context(undefined);
	// The local teacher is one login shared by every check on this database: leave its cloud copy alone.
	await ctx.route('**/api/save', (route) => (route.request().method() === 'PUT' ? route.abort() : route.continue()));
	const page = await ctx.newPage();
	const errors = [];
	// A request cut off by leaving a page ("Load failed") is not what is looked for here.
	page.on('pageerror', (e) => e.message !== 'Load failed' && errors.push(e.message));
	await open(page, '/dex.html');
	await page.evaluate(() => {
		localStorage.setItem('pokemonlist', 'N1|N4|N7');
		localStorage.setItem('money', '500');
		localStorage.setItem('username', 'Tester');
	});
	await page.route('**/redeem', (route) =>
		route.request().method() === 'POST'
			? route.fulfill({ json: { ok: true, prize: { type: 'pokemon', value: 'N25', label: 'Pikachu' } } })
			: route.continue()
	);
	await page.goto(BASE + '/lærer/index.html');
	await sleep(1200);
	await page.evaluate(() => (window.__sameDocument = true));
	await page.locator('a[href="/redeem.html"]').first().evaluate((a) => a.click());
	await page.waitForURL('**/redeem.html');
	await sleep(800);
	check('the router reached the player page without a new page load', await page.evaluate(() => window.__sameDocument === true));
	await page.fill('#secretCodeInput', 'TESTKODE');
	await page.click('button:has-text("Aktiver")');
	await sleep(1000);
	check('the prize is added to the real save', (await local(page, 'pokemonlist')) === 'N1|N4|N7|N25', await local(page, 'pokemonlist'));
	check('the coins are kept', (await local(page, 'money')) === '500', await local(page, 'money'));
	check('the header shows the real coins', (await page.locator('#cointext').textContent()).replace(/\s/g, '') === '500', await page.locator('#cointext').textContent());
	check('no page errors', errors.length === 0, errors.join('; '));
	await ctx.close();
});

// 2. A localStorage wipe, then the first catch: the IndexedDB copy must keep the bigger save.
await section('IndexedDB copy', async () => {
	const headers = login('idb');
	const ctx = await context(headers);
	await stubSave(ctx, newState(await idOf(headers)));
	const page = await ctx.newPage();
	await open(page, '/dex.html');
	await putSnapshot(page, { timestamp: Date.now() - 4 * 3600 * 1000, data: { pokemonlist: names(10), money: '1' } });
	await setLocal(page, 'pokemonlist', 'N1');
	await page.goto(BASE + '/pokemath.html?stage=1');
	await page.locator('.problem').waitFor();
	await solve(page);
	await sleep(800);
	const kept = await readSnapshot(page);
	check('a snapshot is not replaced by one with fewer Pokémon', count(kept?.data?.pokemonlist) === 10, `${count(kept?.data?.pokemonlist)} Pokémon`);
	await setLocal(page, 'pokemonlist', names(12));
	await page.goto(BASE + '/pokemath.html?stage=1');
	await page.locator('.problem').waitFor();
	await solve(page);
	await sleep(800);
	const grown = await readSnapshot(page);
	check('…and one with more Pokémon still is', count(grown?.data?.pokemonlist) === 12, `${count(grown?.data?.pokemonlist)} Pokémon`);
	await ctx.close();
});

// 3 and 4. The login changes under a tab that has the old one cached. The save on this device is
// not the new login's: it is never uploaded, and the last player's IndexedDB copy goes with it.
async function loginChange(tag, targetCloud) {
	const [from, to] = [login(tag + '-from'), login(tag + '-to')];
	const [fromId, toId] = [await idOf(from), await idOf(to)];
	if (targetCloud) {
		await fetch(BASE + '/api/save', { method: 'PUT', headers: { ...to, 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { pokemonlist: targetCloud }, base: null }) });
	}
	const ctx = await context(from);
	await ctx.addInitScript(() => {
		try {
			window.__meAtStart = sessionStorage.getItem('pm-me');
		} catch {
			// A page without session storage.
		}
	});
	const state = newState(fromId);
	await stubSave(ctx, state);
	const page = await ctx.newPage();
	await open(page, '/dex.html');
	await setLocal(page, 'pokemonlist', 'N1|N4|N7');
	await open(page, '/dex.html');
	await putSnapshot(page, { timestamp: Date.now(), data: { pokemonlist: 'N1|N4|N7' } });
	check(`${tag}: the first login owns the save`, JSON.parse((await local(page, 'pm-cloud')) || '{}').owner === fromId);
	await setLocal(page, 'pokemonlist', 'N1|N4|N7|N9');
	// Leave as the first login (the page uploads on the way out), then log in as the other. The page
	// stays on this origin: leaving it (about:blank) sometimes drops the tab's session storage.
	await page.goto(BASE + '/valid_images.json');
	await sleep(500);
	await ctx.setExtraHTTPHeaders(to);
	state.id = toId;
	state.puts.length = 0;
	await page.goto(BASE + '/dex.html');
	check(`${tag}: the tab still has the first login cached`, JSON.parse((await page.evaluate(() => window.__meAtStart)) || '{}').id === fromId);
	await sleep(3500);
	return { ctx, page, state, toId };
}
await section('login change with a cloud save', async () => {
	const { ctx, page, state, toId } = await loginChange('with a cloud save', 'N50|N51');
	check('the new login gets their own cloud save', (await local(page, 'pokemonlist')) === 'N50|N51', await local(page, 'pokemonlist'));
	check('nothing from the last login is uploaded', state.puts.every((p) => !String(p?.data?.pokemonlist).includes('N9')), `${state.puts.length} uploads`);
	check('no question is asked about it', !(await page.locator('#cloud-offer').isVisible()));
	check('the save is the new login\'s', JSON.parse((await local(page, 'pm-cloud')) || '{}').owner === toId);
	check("the last login's IndexedDB copy is gone", (await readSnapshot(page)) === null);
	await ctx.close();
});
await section('login change without a cloud save', async () => {
	const { ctx, page, state, toId } = await loginChange('without a cloud save', null);
	check('a new login starts afresh', !(await local(page, 'pokemonlist')), String(await local(page, 'pokemonlist')));
	check("the last login's save is not offered back", !(await page.locator('#idb-restore-modal').isVisible()));
	check("…because the IndexedDB copy is gone", (await readSnapshot(page)) === null);
	check('nothing from the last login is uploaded', state.puts.every((p) => !String(p?.data?.pokemonlist).includes('N9')), `${state.puts.length} uploads`);
	check("the save is the new login's", JSON.parse((await local(page, 'pm-cloud')) || '{}').owner === toId);
	await ctx.close();
});

// 5. "Slett alt" deletes the cloud copy too, and wipes nothing when that fails.
await section('Slett alt', async () => {
	const headers = login('wipe');
	const ctx = await context(headers);
	const state = newState(await idOf(headers));
	await stubSave(ctx, state);
	const page = await ctx.newPage();
	await open(page, '/dex.html');
	await setLocal(page, 'pokemonlist', 'N1|N4|N7');
	await open(page, '/dex.html');
	await putSnapshot(page, { timestamp: Date.now(), data: { pokemonlist: 'N1|N4|N7' } });
	const reset = () => page.evaluate(() => /** @type {HTMLElement} */ (document.querySelector('button.danger')).click());

	state.failDelete = true;
	await page.evaluate(() => (window.__sameDocument = true));
	await reset();
	await page.locator('#ask-text').waitFor();
	const question = await page.locator('#ask-text').textContent();
	check('the question says the cloud copy goes too', /skyen/i.test(question ?? ''), question ?? '');
	await page.click('#ask-ok');
	await sleep(1000);
	check('offline: the cloud copy was asked to go', state.deletes === 1);
	check('offline: nothing is wiped', (await local(page, 'pokemonlist')) === 'N1|N4|N7' && (await readSnapshot(page)) !== null && (await page.evaluate(() => window.__sameDocument === true)));
	check('offline: the player is told it needs a connection', (await toasts(page)).some((t) => /nett/i.test(t)), (await toasts(page)).join(' | '));

	state.failDelete = false;
	await reset();
	await page.locator('#ask-ok').click();
	await sleep(3000);
	check('the cloud copy is deleted', state.deletes === 2 && state.deleted);
	check('the device is wiped', (await local(page, 'pokemonlist')) === null && (await local(page, 'pm-cloud')) === null);
	check('the IndexedDB copy is wiped', (await readSnapshot(page)) === null);
	check('nothing is uploaded again', state.putsAfterDelete === 0, `${state.putsAfterDelete} uploads`);
	await ctx.close();
});

// 6. A code tapped twice is sent once; one the Worker says is used is marked used here.
await section('redeem', async () => {
	const ctx = await context(login('redeem'));
	const page = await ctx.newPage();
	const calls = [];
	let answer = { ok: true, prize: { type: 'coins', value: 50, label: 'Mynter' } };
	await page.route('**/redeem', async (route) => {
		if (route.request().method() !== 'POST') return route.continue();
		calls.push(route.request().postDataJSON().code);
		await sleep(600);
		return route.fulfill({ json: answer });
	});
	await open(page, '/redeem.html');
	await page.fill('#secretCodeInput', 'DOBBEL');
	await page.locator('button:has-text("Aktiver")').dblclick();
	await sleep(1800);
	check('a double tap sends the code once', calls.length === 1, `${calls.length} requests`);
	check('…and gives the prize once', (await local(page, 'money')) === '50', await local(page, 'money'));

	answer = { ok: false, used: true, message: 'Denne koden er allerede brukt.' };
	await page.fill('#secretCodeInput', 'BRUKT');
	await page.locator('button:has-text("Aktiver")').click();
	await sleep(1200);
	check('a used code shows the Worker\'s message', (await page.locator('#response').textContent()) === 'Denne koden er allerede brukt.', await page.locator('#response').textContent());
	check('…and is marked used on this device', (await local(page, 'redeemed_brukt')) === '1');
	const before = calls.length;
	await page.locator('button:has-text("Aktiver")').click();
	await sleep(500);
	check('…so it is not sent again', calls.length === before, `${calls.length - before} more requests`);
	await ctx.close();
});

// 7 and 9. A backup file replaces the save: what the file lacks goes, the device's own stays, and
// a teacher's choices are not in the file.
await section('backup file', async () => {
	const ctx = await context(login('file'));
	const page = await ctx.newPage();
	await open(page, '/saveandload.html');
	await page.evaluate(() => {
		localStorage.setItem('pokemonlist', 'N1|N2');
		localStorage.setItem('customSolved', '9');
		localStorage.setItem('foilTilt', 'on');
		localStorage.setItem('teacherRaidChoice', '{"boss":25}');
		localStorage.setItem('teacherMemoryChoice', '{"pairs":8}');
		localStorage.setItem('teacherBingoSettings', '{"size":5}');
	});
	const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#downloadSection button').click()]);
	const chunks = [];
	for await (const chunk of await download.createReadStream()) chunks.push(chunk);
	const saved = JSON.parse(Buffer.from(Buffer.concat(chunks).toString(), 'base64').toString());
	check('a backup file leaves out the teacher choices', !('teacherRaidChoice' in saved) && !('teacherMemoryChoice' in saved) && !('teacherBingoSettings' in saved), Object.keys(saved).filter((k) => k.startsWith('teacher')).join());
	check('…and still has the save', saved.pokemonlist === 'N1|N2' && saved.customSolved === '9');

	const file = Buffer.from(Buffer.from(JSON.stringify({ pokemonlist: 'N1|N2|N3', money: '5' })).toString('base64'));
	await page.setInputFiles('#fileInput', { name: 'a.pkmth', mimeType: 'application/octet-stream', buffer: file });
	await sleep(1200);
	check('the file is restored', (await local(page, 'pokemonlist')) === 'N1|N2|N3' && (await local(page, 'money')) === '5');
	check('what the file lacks is gone', (await local(page, 'customSolved')) === null, String(await local(page, 'customSolved')));
	check("the device's own keys stay", (await local(page, 'foilTilt')) === 'on' && (await local(page, 'teacherRaidChoice')) === '{"boss":25}' && (await local(page, 'teacherBingoSettings')) === '{"size":5}');
	await ctx.close();
});

// 8. A full storage must not stop the round, and a half-restored save is worse than none.
await section('full storage', async () => {
	const headers = login('full');
	const ctx = await context(headers);
	await ctx.addInitScript(() => {
		const set = Storage.prototype.setItem;
		Storage.prototype.setItem = function (key, value) {
			const full = sessionStorage.getItem('__full');
			if (this === localStorage && full && (full === '*' ? !key.startsWith('pm-') : full === key)) {
				throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
			}
			return set.call(this, key, value);
		};
	});
	const page = await ctx.newPage();
	const errors = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await open(page, '/pokemath.html?stage=1');
	await page.locator('.problem').waitFor();
	await page.evaluate(() => sessionStorage.setItem('__full', '*'));
	await solve(page);
	await sleep(600);
	check('a full storage does not stop the round', (await page.locator('.our-field').inputValue()) === '', `field: "${await page.locator('.our-field').inputValue()}"`);
	check('…no error escapes', errors.length === 0, errors.join('; '));
	check('…and the player is told, once', (await toasts(page)).length === 1, (await toasts(page)).join(' | '));
	await solve(page);
	await sleep(600);
	check('…also on the next answer', (await page.locator('.our-field').inputValue()) === '' && (await toasts(page)).length === 1 && errors.length === 0, `${(await toasts(page)).length} toasts`);

	// Taking the cloud copy over a save that cannot all be written leaves the old save as it was.
	const other = login('full-restore');
	const restoreCtx = await context(other);
	await restoreCtx.addInitScript(() => {
		const set = Storage.prototype.setItem;
		Storage.prototype.setItem = function (key, value) {
			if (this === localStorage && sessionStorage.getItem('__full') === key) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
			return set.call(this, key, value);
		};
	});
	const restore = await restoreCtx.newPage();
	await open(restore, '/dex.html');
	await setLocal(restore, 'pokemonlist', 'N9');
	await setLocal(restore, 'localonly', 'keep');
	await fetch(BASE + '/api/save', { method: 'PUT', headers: { ...other, 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { pokemonlist: 'N1|N2|N3', money: '1', 'zz-last': 'x' }, base: null }) });
	await restore.evaluate(() => sessionStorage.setItem('__full', 'zz-last'));
	await restore.reload();
	await sleep(1800);
	await restore.locator('#cloud-use-btn').click();
	await sleep(1000);
	check('a failed restore leaves the old save as it was', (await local(restore, 'pokemonlist')) === 'N9' && (await local(restore, 'localonly')) === 'keep', `${await local(restore, 'pokemonlist')} ${await local(restore, 'localonly')}`);
	check('…and says so', (await toasts(restore)).length >= 1);
	await ctx.close();
	await restoreCtx.close();
});

// 10. A broken badges value must not stop the page from starting: the id and the cloud copy come after it.
await section('corrupt badges', async () => {
	const ctx = await context(login('badges'));
	const page = await ctx.newPage();
	await open(page, '/dex.html');
	await page.evaluate(() => {
		localStorage.setItem('badges', '{not json');
		localStorage.removeItem('UUID');
	});
	await open(page, '/dex.html');
	check('a broken badges value does not stop the page starting', (await local(page, 'UUID')) !== null);
	check('…and badges start over', JSON.parse((await local(page, 'badges')) || '{}').badges?.length === 33);
	await ctx.close();
});

// 11. The adaptive level measures a slow answer as slow: from the problem answered, not the next.
await section('adaptive timing', async () => {
	const ctx = await context(login('adaptive'));
	await ctx.addInitScript(() => {
		window.__skew = 0;
		const now = Date.now.bind(Date);
		Date.now = () => now() + window.__skew;
	});
	const page = await ctx.newPage();
	const points = async () => JSON.parse((await local(page, 'adaptivePoints')) || '{"add":100,"sub":100}');
	for (const [name, skew, change] of [['a slow answer costs points', 120_000, -15], ['a fast answer earns points', 0, 10]]) {
		await page.goto(BASE + '/pokemath.html?adaptive=true');
		await page.locator('.problem').waitFor();
		await sleep(500);
		const before = await points();
		await page.evaluate((s) => (window.__skew = s), skew);
		const { op } = await solve(page);
		await sleep(500);
		const key = op === '+' ? 'add' : 'sub';
		const after = await points();
		check(`adaptive: ${name}`, (after[key] ?? 100) - (before[key] ?? 100) === change, `${key} ${before[key] ?? 100} -> ${after[key]}`);
	}
	await ctx.close();
});

// 16. Logging out without a connection must not clear the save.
await section('logout offline', async () => {
	const headers = login('logout');
	const ctx = await context(headers);
	await stubSave(ctx, newState(await idOf(headers)));
	const page = await ctx.newPage();
	await open(page, '/dex.html');
	await setLocal(page, 'pokemonlist', 'N1|N4|N7');
	await open(page, '/dex.html');
	await page.route('**/logout', (route) => route.abort('internetdisconnected'));
	await page.evaluate(() => /** @type {HTMLElement} */ (document.querySelector('#logoutBtn')).click());
	await sleep(1500);
	check('offline: the save is not cleared on logout', (await local(page, 'pokemonlist')) === 'N1|N4|N7', String(await local(page, 'pokemonlist')));
	check('offline: the page is not left', page.url().includes('/dex.html'), page.url());
	check('offline: the player is told it needs a connection', (await toasts(page)).some((t) => /nett/i.test(t)), (await toasts(page)).join(' | '));
	await ctx.close();
});

await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
