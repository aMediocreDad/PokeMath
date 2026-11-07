// The logos at phone and desktop size: the front page in May, October and December (everyday,
// Halloween, Christmas) and the teacher header. Checks each page asks for the right SVG and that it
// loads. Run against tests/serve-worker.sh. Usage: node tests/logo-shots.mjs [outdir, default tests/shots/logo]
import { createRequire } from 'module';
import { muteAudio } from './mute.mjs';
const require = createRequire(import.meta.url);
const { webkit, devices } = require('playwright-core');
const BASE = process.env.BASE || 'http://localhost:3123';
const OUT = process.argv[2] || new URL('./shots/logo', import.meta.url).pathname;
require('fs').mkdirSync(OUT, { recursive: true });
const check = (ok, what) => console.log(ok ? 'PASS' : 'FAIL', what);

const browser = muteAudio(await webkit.launch());
for (const [size, options] of [['phone', devices['iPhone 13']], ['desktop', { viewport: { width: 1280, height: 800 } }]]) {
	for (const [name, date, file] of [
		['everyday', '2026-05-12T10:00:00', '/logo.svg'],
		['halloween', '2026-10-12T10:00:00', '/logo-halloween.svg'],
		['christmas', '2026-12-12T10:00:00', '/logo-christmas.svg'],
	]) {
		const context = await browser.newContext(options);
		await context.addCookies([{ name: 'cookies', value: 'true', url: BASE }]);
		await context.clock.setFixedTime(new Date(date));
		const page = await context.newPage();
		const loaded = page.waitForResponse((r) => new URL(r.url()).pathname === file, { timeout: 8000 }).catch(() => null);
		await page.goto(BASE + '/');
		await page.waitForFunction((f) => getComputedStyle(document.getElementById('logo')).backgroundImage.includes(f), file);
		const res = await loaded;
		check(res?.status() === 200 && res.headers()['content-type']?.includes('svg'), `${name} (${size}) loads ${file}`);
		await page.waitForTimeout(400);
		await page.screenshot({ path: `${OUT}/logo-${name}-${size}.png`, clip: { x: 0, y: 0, width: page.viewportSize().width, height: 330 } });
		await context.close();
	}
	const page = await (await browser.newContext(options)).newPage();
	await page.goto(BASE + '/lærer/index.html');
	const img = page.locator('.brand img');
	await img.waitFor();
	check(await img.evaluate((i) => i.complete && i.naturalWidth > 0 && i.src.endsWith('/logo.svg')), `teacher header (${size}) shows /logo.svg`);
	await page.screenshot({ path: `${OUT}/logo-teacher-${size}.png`, clip: { x: 0, y: 0, width: page.viewportSize().width, height: 160 } });
	await page.context().close();
}
await browser.close();
