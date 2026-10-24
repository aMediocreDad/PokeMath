// Joining a class game by scanning the teacher's QR code inside Pokémath. The camera is faked:
// getUserMedia returns a canvas stream with a QR code drawn on it. Checks the join, that the camera
// is let go afterwards, a QR code that is not ours, and a refused camera.
// Run against tests/serve-worker.sh. Usage: node tests/join-scan-check.mjs [outdir]
import { createRequire } from 'module';
import QRCode from 'qrcode';
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

const browser = muteAudio(await webkit.launch());
const host = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await acceptAsks(host);
await host.goto(BASE + '/lærer/raid.html');
await host.locator('#createRaidBtn').click();
const code = (await host.locator('#lobbyCode').textContent()).trim();
check('the teacher gets a code', /^[0-9A-Z]{6}$/.test(code), code);

/**
 * A child whose camera sees `text` as a QR code, or refuses when `text` is null.
 * @param {string} name @param {string} device @param {string | null} text
 */
async function child(name, device, text) {
	const ctx = await browser.newContext({ ...devices[device], extraHTTPHeaders: { 'x-dev-email': `${name.toLowerCase()}-${Date.now()}@test.no` } });
	await ctx.addCookies([{ name: 'cookies', value: 'true', url: BASE }]);
	const img = text === null ? null : await QRCode.toDataURL(text, { width: 300, margin: 2 });
	await ctx.addInitScript(
		({ img, name }) => {
			localStorage.getItem('username') || localStorage.setItem('username', name);
			if (!navigator.mediaDevices) Object.defineProperty(navigator, 'mediaDevices', { value: {} });
			window.__tracks = [];
			// On the prototype: WebKit does not always keep a function set on the instance.
			const target = typeof MediaDevices === 'function' ? MediaDevices.prototype : navigator.mediaDevices;
			Object.defineProperty(target, 'getUserMedia', { configurable: true, writable: true, value: async () => {
				if (!img) throw new DOMException('Permission denied', 'NotAllowedError');
				const canvas = document.createElement('canvas');
				canvas.width = 640;
				canvas.height = 480;
				const g = canvas.getContext('2d');
				const qr = new Image();
				qr.src = img;
				await qr.decode();
				const draw = () => {
					g.fillStyle = '#6b6b6b';
					g.fillRect(0, 0, 640, 480);
					g.drawImage(qr, 170, 90, 300, 300);
				};
				draw();
				setInterval(draw, 100);
				const stream = canvas.captureStream(10);
				window.__tracks.push(...stream.getTracks());
				return stream;
			} });
		},
		{ img, name }
	);
	const page = await ctx.newPage();
	page.on('pageerror', (e) => console.log(name, 'pageerror', e.message));
	await page.goto(BASE + '/bingo_join.html');
	await page.locator('#studentOut', { hasText: name }).waitFor();
	return page;
}

// The teacher's join link, scanned on a phone.
const kari = await child('Kari', 'iPhone 13', `${BASE}/bingo_join.html?code=${code}`);
await kari.locator('#scanBtn').click();
await kari.locator('#qrScanner').waitFor();
await shot(kari, 'scan-phone');
await kari.waitForURL(BASE + '/', { timeout: 10_000 }).catch(() => {});
check('scanning the QR code joins the game', (await kari.evaluate(() => localStorage.getItem('bingoJoinedCode'))) === code);
check('…and lets go of the camera', await kari.evaluate(() => window.__tracks.length > 0 && window.__tracks.every((t) => t.readyState === 'ended')));
await kari.goto(BASE + '/pokemath.html?stage=1');
await host.locator('#lobbyPlayers li', { hasText: 'Kari' }).waitFor({ timeout: 10_000 }).catch(() => {});
check('the teacher sees the child who scanned', (await host.locator('#lobbyPlayers li', { hasText: 'Kari' }).count()) === 1);

// A QR code that is not a Pokémath code is not followed.
const ola = await child('Ola', 'iPad (gen 7)', 'https://example.com/');
await ola.locator('#scanBtn').click();
await ola.locator('#qrScanner .help', { hasText: 'ikke en kode' }).waitFor({ timeout: 5000 }).catch(() => {});
check('a stranger QR code is refused', (await ola.locator('#qrScanner .help').textContent()).includes('ikke en kode'));
check('…and the page stays put', ola.url() === BASE + '/bingo_join.html');
await shot(ola, 'scan-ipad-not-ours');
await ola.locator('#scanCancel').click();
check('Avbryt closes the scanner and the camera', (await ola.locator('#qrScanner').count()) === 0 && (await ola.evaluate(() => window.__tracks.every((t) => t.readyState === 'ended'))));

// The child said no to the camera.
const per = await child('Per', 'iPhone 13', null);
await per.locator('#scanBtn').click();
await per.locator('#status', { hasText: 'kameraet' }).waitFor({ timeout: 5000 }).catch(() => {});
check('a refused camera points back to typing the code', (await per.locator('#status').textContent()).includes('Skriv inn koden'));
await shot(per, 'scan-denied');

await browser.close();
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
process.exit(results.every(Boolean) ? 0 : 1);
