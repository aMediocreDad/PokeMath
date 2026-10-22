// Open the main pages with a well-stocked save and list every image, font or script that fails
// to load. Run it against a Worker started with MIRROR_ONLY=1 to check the mirror is complete.
// Usage: node tests/asset-404s.mjs [base]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { webkit, devices } = require('playwright-core');
const BASE = process.argv[2] || 'http://localhost:3123';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A save that owns a spread of normal, shiny and form Pokémon, icons, backgrounds and badges.
const pokemon = {};
for (let id = 1; id <= 1025; id += 7) pokemon[`N${id}`] = 1;
for (let id = 3; id <= 1025; id += 37) pokemon[`S${id}`] = 1;
for (const id of [10189, 10085, 10100, 10033]) pokemon[`N${id}`] = 1;
const save = {
	cookies: 'true',
	username: '"Kari"',
	money: '999999',
	pokemon: JSON.stringify(pokemon),
	playerIcon: '"Brawly"',
	background: '"bg-005"',
};

const pages = [
	'/', '/pokemath.html?stage=3', '/pokemath.html?adaptive=true', '/dex.html', '/pokeviewer.html?id=25', '/shop.html',
	'/player_profile.html', '/customizer.html', '/badges.html', '/redeem.html', '/faq.html', '/about.html',
	'/christmas.html', '/easter.html', '/bingo_join.html', '/l%C3%A6rer/index.html', '/l%C3%A6rer/bingo_settings.html',
];

const browser = await webkit.launch();
const failed = new Map();
for (const device of ['iPhone 13', 'Desktop Safari']) {
	const ctx = await browser.newContext({ ...devices[device] });
	await ctx.addCookies([{ name: 'cookies', value: 'true', url: BASE }]);
	await ctx.addInitScript((s) => {
		if (localStorage.getItem('__seeded')) return;
		for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
		localStorage.setItem('__seeded', '1');
	}, save);
	const page = await ctx.newPage();
	page.on('response', (res) => {
		const url = new URL(res.url());
		if (url.origin === BASE && res.status() >= 400 && /\.(png|webp|svg|gif|jpe?g|woff2?|ttf|js|css|json)$/.test(url.pathname)) {
			const key = decodeURIComponent(url.pathname);
			if (!failed.has(key)) failed.set(key, `${res.status()} on ${page.url().replace(BASE, '')}`);
		}
	});
	for (const path of pages) {
		await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => {});
		await sleep(400);
		// Scroll so lazy images load.
		await page.evaluate(async () => {
			for (let y = 0; y < document.body.scrollHeight; y += innerHeight) {
				scrollTo(0, y);
				await new Promise((r) => setTimeout(r, 120));
			}
		});
		await sleep(300);
	}
	await ctx.close();
}
await browser.close();

for (const [path, where] of [...failed].sort()) console.log(where.padEnd(40), path);
console.log(`${failed.size} files failed to load`);
