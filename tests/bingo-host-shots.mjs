// The bingo host page's two newest pieces at phone and desktop size: the warning when the
// connection is down (beside the "Ingen forbindelse" banner an End sent then shows), and "nytt navn"
// on a child the teacher asked to rename, in the waiting room and in the game.
// Run against tests/serve-worker.sh. Usage: node tests/bingo-host-shots.mjs <outdir>
import { createRequire } from 'module';
import { muteAudio } from './mute.mjs';
const require = createRequire(import.meta.url);
const { webkit, devices } = require('playwright-core');
const WebSocket = require('ws');
const BASE = process.env.BASE || 'http://localhost:3123';
const OUT = process.argv[2] || '.';

const login = await (await fetch(BASE + '/teacher/access-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).json();
const teacherSession = login.teacherSession;
/** A socket that only listens: the teacher's, or a child's. */
function socket() {
	const ws = new WebSocket(BASE.replace('http', 'ws') + '/ws');
	const opened = new Promise((resolve) => ws.on('open', resolve));
	return { ws, opened, send: (m) => ws.send(JSON.stringify({ teacherSession, ...m })) };
}
const probe = socket();
await probe.opened;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = muteAudio(await webkit.launch());
let failed = 0;
for (const [size, options] of [['phone', devices['iPhone 13']], ['desktop', { viewport: { width: 1280, height: 800 } }]]) {
	const ctx = await browser.newContext(options);
	await ctx.addInitScript(() => {
		const Native = WebSocket;
		window.__sockets = [];
		window.__blockWs = false;
		window.WebSocket = class extends Native {
			constructor(url, ...rest) {
				super(window.__blockWs ? 'ws://127.0.0.1:59999/blocked' : url, ...rest);
				window.__sockets.push(this);
			}
		};
	});
	const page = await ctx.newPage();
	page.on('pageerror', (e) => console.log(size, 'pageerror', e.message));
	const overflow = async (name) => {
		const px = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
		console.log(px > 0 ? 'FAIL' : 'PASS', `${name} (${size}) fits`, px > 0 ? `${px}px too wide` : '');
		if (px > 0) failed++;
	};
	await page.goto(BASE + '/lærer/bingo_host.html');
	await page.locator('#bingoSetup').waitFor({ timeout: 10000 });
	await page.click('#startBtn');
	await page.locator('#lobbyCode').waitFor({ timeout: 15000 });
	const code = (await page.textContent('#lobbyCode')).trim();

	// A child who is asked to rename, in the waiting room.
	const kari = crypto.randomUUID();
	const child = socket();
	await child.opened;
	child.send({ type: 'joinLobby', code, uuid: kari, name: 'Kari', icon: '' });
	await page.locator('#lobbyPlayers li', { hasText: 'Kari' }).waitFor({ timeout: 10000 });
	probe.send({ type: 'hostForceRename', code, uuid: kari });
	await page.locator('#lobbyPlayers li small', { hasText: 'nytt navn' }).waitFor({ timeout: 5000 });
	await page.screenshot({ path: `${OUT}/bingo-rename-lobby-${size}.png` });
	await overflow('waiting room with a rename hint');

	// …and in the game, with the connection down.
	await page.click('#startGameBtn');
	await page.locator('#bingoCard').waitFor({ timeout: 5000 });
	await page.locator('.player-row small', { hasText: 'nytt navn' }).waitFor({ timeout: 5000 });
	await page.screenshot({ path: `${OUT}/bingo-rename-game-${size}.png` });
	await overflow('game with a rename hint');
	await page.evaluate(() => {
		window.__blockWs = true;
		window.__sockets.at(-1).close();
	});
	await page.locator('#connection-lost').waitFor({ timeout: 5000 });
	await page.click('#endGameBtn');
	await page.click('#ask-ok');
	await page.locator('#host-banner').waitFor({ timeout: 5000 });
	await sleep(300);
	await page.screenshot({ path: `${OUT}/bingo-offline-${size}.png` });
	await overflow('game offline with the banner');
	// The warning must not cover the banner or the buttons: its close button still takes the tap.
	await page.click('#host-banner-close', { timeout: 3000 });
	console.log('PASS the banner can be closed with the warning showing (' + size + ')');
	child.ws.close();
	await ctx.close();
	probe.send({ type: 'hostEndLobby', code });
}
await browser.close();
probe.ws.close();
process.exit(failed ? 1 : 0);
