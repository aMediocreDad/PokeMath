// Offline play: after one online visit, the service worker and the background download must let a
// player solve problems and catch a Pokémon, picture included, with the network off. Chromium, not
// WebKit: Playwright's WebKit does not run service workers. Run against tests/serve-worker.sh.
// Usage: node tests/offline-check.mjs [outdir]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const BASE = 'http://localhost:3123';
const OUT = process.argv[2];
const results = [];
const check = (name, ok, detail = '') => {
	results.push(ok);
	console.log(ok ? 'PASS' : 'FAIL', name, detail);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2 });
await ctx.addCookies([{ name: 'cookies', value: 'true', url: BASE }]);
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));

// Online: the first visit installs the worker and starts the picture download.
await page.goto(BASE + '/');
await page.evaluate(() => navigator.serviceWorker.ready);
check('service worker installed', await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.active));
await page.locator('.pm-offline').waitFor({ timeout: 10_000 }).catch(() => {});
if (OUT) await page.screenshot({ path: `${OUT}/offline-progress.png` });
const started = Date.now();
await page.locator('.pm-offline').waitFor({ state: 'detached', timeout: 300_000 });
const art = await page.evaluate(async () => {
	const cache = await caches.open('pm-art');
	const keys = await cache.keys();
	const sample = await Promise.all(keys.filter((_, i) => i % 97 === 0).map(async (k) => (await cache.match(k))?.headers.get('Content-Type')));
	return { count: keys.filter((k) => k.url.includes('/images/pokemon/')).length, types: [...new Set(sample)] };
});
check('Pokémon pictures downloaded', art.count > 3000, `${art.count} in ${Math.round((Date.now() - started) / 1000)}s`);
check('only images in the picture cache', art.types.every((t) => t?.startsWith('image/')), art.types.join(', '));

// Offline from here on.
await ctx.setOffline(true);
await page.goto(BASE + '/pokemath.html?stage=1');
await page.locator('.problem').waitFor({ timeout: 10_000 });
check('game page opens offline', true);
const before = (await page.evaluate(() => localStorage.getItem('pokemonlist')) || '').split('|').filter(Boolean).length;

const solve = async () => {
	const [a, op, b] = (await page.locator('.problem').textContent()).trim().split(/\s+/);
	const [x, y] = [Number(a), Number(b)];
	return op === '+' ? x + y : op === '-' ? x - y : op === 'x' || op === '·' ? x * y : x / y;
};
for (let i = 0; i < 40 && !(await page.locator('#pokeball:not(.is-hidden)').isVisible()); i++) {
	await page.locator('.our-field').fill(String(await solve()));
	await page.locator('.answer-button').click();
	await page.waitForTimeout(150);
}
check('a round finishes offline', await page.locator('#pokeball:not(.is-hidden)').isVisible());
await page.locator('#pokeball').click();
const sprite = page.locator('.sprite');
await sprite.waitFor({ timeout: 10_000 });
const url = (await sprite.getAttribute('style'))?.match(/url\(["']?([^"')]+)/)?.[1];
const picture = await page.evaluate(async (u) => {
	const r = await fetch(u).catch((e) => null);
	const cached = await caches.match(new URL(u, location.href).pathname);
	return { ok: !!r?.ok, type: r?.headers.get('Content-Type'), cached: !!cached, controlled: !!navigator.serviceWorker.controller };
}, url);
check('the caught Pokémon has its picture offline', picture.ok && picture.type?.startsWith('image/'), `${url} ${picture.type}`);
const after = (await page.evaluate(() => localStorage.getItem('pokemonlist')) || '').split('|').filter(Boolean).length;
check('the catch is saved', after === before + 1, `${before} -> ${after}`);
const broken = await page.evaluate(() => [...document.images].filter((i) => i.complete && !i.naturalWidth).map((i) => i.getAttribute('src')));
check('no broken images on the game page offline', !broken.length, broken.join(' '));
if (OUT) await page.screenshot({ path: `${OUT}/offline-catch.png` });

// Other player pages still open from the cache.
for (const path of ['/', '/dex.html', '/player_profile.html']) {
	const res = await page.goto(BASE + path).catch((e) => e);
	check(`${path} opens offline`, !(res instanceof Error) && (await page.locator('body').textContent()).length > 100);
}

// Online again, but logged out: the login page is shown, and never stored as the app's page.
await ctx.setOffline(false);
await ctx.setExtraHTTPHeaders({ 'x-dev-anonymous': '1' });
await page.goto(BASE + '/dex.html');
check('logged out online shows the login page', page.url().includes('/login.html'), page.url());
const kept = await page.evaluate(async () => {
	const keys = await caches.keys();
	const app = keys.find((k) => k.startsWith('pm-app-'));
	const res = app && (await (await caches.open(app)).match('/dex.html'));
	return res ? (await res.text()).includes('Logg inn') : null;
});
check('the cached page is still the game, not the login page', kept === false, String(kept));

await browser.close();
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
process.exit(results.every(Boolean) ? 0 : 1);
