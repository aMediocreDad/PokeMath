// Two devices on one login: the cloud save must move progress over and never let an empty or
// smaller save replace a bigger one without the player choosing. Run against a fresh local
// Worker (tests/serve-worker.sh). Usage: node tests/cloud-save-check.mjs
import { createRequire } from 'module';
import { muteAudio } from './mute.mjs';
import { acceptAsks } from './ask.mjs';
const require = createRequire(import.meta.url);
const { webkit, devices } = require('playwright-core');
const BASE = process.env.BASE || 'http://localhost:3123';
const WHO = { 'x-dev-email': `sky-${Date.now()}@test.no` };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => {
	results.push(ok);
	console.log(ok ? 'PASS' : 'FAIL', name, detail);
};
const cloudCount = async () => ((await (await fetch(BASE + '/api/save', { headers: WHO })).json()).save?.pokemon ?? null);

const browser = muteAudio(await webkit.launch());
async function device(name) {
	const ctx = await browser.newContext({ ...devices['iPhone 13'], extraHTTPHeaders: WHO });
	await ctx.addCookies([{ name: 'cookies', value: 'true', url: BASE }]);
	const page = await ctx.newPage();
	page.on('pageerror', (e) => console.log(name, 'pageerror', e.message));
	const puts = [];
	page.on('request', (r) => r.url().endsWith('/api/save') && r.method() === 'PUT' && puts.push(r.postDataJSON()));
	return { page, puts, ctx };
}
const open = async (d, path = '/dex.html') => {
	await d.page.goto(BASE + path);
	await sleep(1800);
};
const setList = (d, list) => d.page.evaluate((l) => localStorage.setItem('pokemonlist', l), list);
const getList = (d) => d.page.evaluate(() => localStorage.getItem('pokemonlist'));
const offer = (d) => d.page.locator('#cloud-offer').isVisible();

// Device A plays first: its save goes to the cloud.
const a = await device('A');
await open(a);
await setList(a, 'N1|N4|N7');
await open(a);
check('A uploads its save', (await cloudCount()) === 3, `cloud has ${await cloudCount()}`);

// Device B is new: it takes the cloud copy by itself, and never uploads its empty save.
const b = await device('B');
await open(b);
await sleep(1500);
check('B takes the cloud copy by itself', (await getList(b)) === 'N1|N4|N7' && !(await offer(b)), await getList(b));
check('B never uploaded its empty save', b.puts.every((p) => (p?.data?.pokemonlist || '') !== ''), `${b.puts.length} uploads`);

// A plays on; B, untouched since, picks it up by itself.
await setList(a, 'N1|N4|N7|N25|N133');
await open(a);
check('A uploads its progress', (await cloudCount()) === 5);
await open(b);
await sleep(1500);
check('B takes the newer cloud save without asking', (await getList(b)) === 'N1|N4|N7|N25|N133' && !(await offer(b)), await getList(b));

// Nothing changes: no question, no needless upload.
const before = b.puts.length;
await open(b);
await open(b, '/shop.html');
check('A synced device stays quiet', !(await offer(b)) && b.puts.length === before, `${b.puts.length - before} uploads`);

// Both play apart: B is asked, and keeping B replaces the cloud even with fewer Pokémon.
await setList(a, 'N1|N4|N7|N25|N133|N150');
await open(a);
await setList(b, 'N1|N4|N7|N25');
await open(b);
check('Diverged saves ask the player', await offer(b));
await b.page.click('#cloud-keep-btn');
await sleep(1500);
check('Keeping this device replaces the cloud', (await cloudCount()) === 4, `cloud has ${await cloudCount()}`);
await open(a);
await sleep(1500);
check('A follows the choice made on B', (await getList(a)) === 'N1|N4|N7|N25', await getList(a));

// Two children, one iPad. Logging out puts the save in the cloud and clears the device.
const kidA = { 'x-dev-email': `barn-a-${Date.now()}@test.no` };
const kidB = { 'x-dev-email': `barn-b-${Date.now()}@test.no` };
const count = async (who) => ((await (await fetch(BASE + '/api/save', { headers: who })).json()).save?.pokemon ?? null);
const ipad = await device('iPad');
await ipad.page.setExtraHTTPHeaders(kidA);
await open(ipad);
await setList(ipad, 'N10|N11');
await open(ipad);
await ipad.page.click('.menu-button');
await ipad.page.click('#logoutBtn');
await sleep(1500);
check('Logging out saves to the cloud', (await count(kidA)) === 2);
check('Logging out clears the device', (await ipad.page.evaluate(() => localStorage.getItem('pokemonlist'))) === null);
await ipad.page.setExtraHTTPHeaders(kidB);
await open(ipad);
check('The next child starts with an empty save', ((await getList(ipad)) || '') === '' && (await count(kidB)) !== 2);

// No logout: the next child must not inherit or upload the last one's save.
await setList(ipad, 'N12|N13|N14');
await open(ipad);
check('Child B plays and saves', (await count(kidB)) === 3);
await ipad.page.setExtraHTTPHeaders(kidA);
await open(ipad);
await sleep(1500);
check('Child A gets their own save back', (await getList(ipad)) === 'N10|N11', await getList(ipad));
check("B's save is untouched", (await count(kidB)) === 3);

// A file made under one login, restored under another, stays and goes to the new login's cloud.
const file = await ipad.page.evaluate(() => btoa(JSON.stringify({ ...localStorage })));
check('The file carries the old cloud note', !!JSON.parse(atob(file))['pm-cloud']);
const kidC = { 'x-dev-email': `barn-c-${Date.now()}@test.no` };
await ipad.page.setExtraHTTPHeaders(kidC);
// A real login clears the tab's cached identity (worker/login.js); switching the header does not.
await ipad.page.evaluate(() => sessionStorage.clear());
await open(ipad, '/saveandload.html');
await acceptAsks(ipad.page);
await ipad.page.setInputFiles('#fileInput', { name: 'a.pkmth', mimeType: 'application/octet-stream', buffer: Buffer.from(file) });
await sleep(1500);
await open(ipad);
await sleep(1500);
check('A restored file survives a reload under another login', (await getList(ipad)) === 'N10|N11', await getList(ipad));
check("…and becomes that login's cloud save", (await count(kidC)) === 2, `cloud has ${await count(kidC)}`);

// Two synced devices; one is left open on old progress and uploads while being hidden. The
// cloud keeps the newer save, and the stale device is asked on its next load.
const money = (d, n) => d.page.evaluate((v) => localStorage.setItem('money', v), String(n));
const cloudMoney = async () => (await (await fetch(BASE + '/api/save', { headers: WHO })).json()).save?.data?.money;
const hide = (d) => d.page.evaluate(() => {
	Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
	document.dispatchEvent(new Event('visibilitychange'));
});
const show = (d) => d.page.evaluate(() => {
	Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
	document.dispatchEvent(new Event('visibilitychange'));
});
await open(a);
await open(b);
check('Both devices agree before the test', !(await offer(a)) && !(await offer(b)) && (await getList(a)) === (await getList(b)));
await money(a, 500);
await open(a);
check('A uploads its coins', (await cloudMoney()) === '500', `cloud has ${await cloudMoney()}`);
await money(b, 7);
await hide(b);
await sleep(1500);
check('A stale device cannot overwrite newer progress', (await cloudMoney()) === '500', `cloud has ${await cloudMoney()}`);
await open(b);
check('The stale device is asked which to keep', await offer(b));
await b.page.click('#cloud-use-btn');
await sleep(1500);
check('Taking the cloud copy brings the coins over', (await b.page.evaluate(() => localStorage.getItem('money'))) === '500');

// Hidden then shown without a reload: the upload sent on leaving counts, and nothing is asked.
await money(a, 600);
await hide(a);
await sleep(1500);
await show(a);
await sleep(1500);
check('An upload on leaving reaches the cloud', (await cloudMoney()) === '600', `cloud has ${await cloudMoney()}`);
await money(a, 650);
await open(a);
check('…and the next upload is not refused', !(await offer(a)) && (await cloudMoney()) === '650', `cloud has ${await cloudMoney()}`);

// Logging out while a choice is still open would lose this device's progress: ask first.
await money(b, 1);
await open(b);
check('Diverged again: B is asked', await offer(b));
await b.page.click('#cloud-later-btn');
await b.page.click('.menu-button');
await b.page.click('#logoutBtn');
await sleep(800);
const asked = (await b.page.locator('#ask-text').textContent().catch(() => '')) ?? '';
await b.page.click('#ask-cancel').catch(() => {});
check('Logging out with unsynced progress asks first', asked.startsWith('Fikk ikke lagret'), asked);
check('…and saying no keeps the progress', (await b.page.evaluate(() => localStorage.getItem('money'))) === '1');

// The Worker refuses a write over a save it has changed since (base), and a smaller save from a
// page that sends no base, unless the player chose it.
const put = (body) => fetch(BASE + '/api/save', { method: 'PUT', headers: { ...WHO, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const stale = await put({ data: { pokemonlist: 'N1|N4|N7|N25|N150' }, base: 1 });
check('The Worker refuses a write over a newer save', stale.status === 409 && (await cloudCount()) === 4);
const shrink = await put({ data: { pokemonlist: 'N1' } });
check('The Worker refuses a smaller save from an old page', shrink.status === 409 && (await cloudCount()) === 4);
const grow = await put({ data: { pokemonlist: 'N1|N4|N7|N25|N150' } });
check('…and still takes a bigger one', grow.status === 200 && (await cloudCount()) === 5);

await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
