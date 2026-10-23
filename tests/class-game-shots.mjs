// Screenshots of the class-game teacher screens at phone and desktop size: the bingo and raid
// setups and waiting rooms. Run against tests/serve-worker.sh. Usage: node tests/class-game-shots.mjs <outdir>
import { createRequire } from 'module';
import { muteAudio } from './mute.mjs';
const require = createRequire(import.meta.url);
const { webkit, devices } = require('playwright-core');
const BASE = 'http://localhost:3123';
const OUT = process.argv[2] || '.';

const browser = muteAudio(await webkit.launch());
for (const [size, options] of [['phone', devices['iPhone 13']], ['desktop', { viewport: { width: 1280, height: 800 } }]]) {
	const page = await (await browser.newContext(options)).newPage();
	page.on('dialog', (d) => d.accept());
	const overflow = async (name) => {
		const px = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
		console.log(px > 0 ? 'FAIL' : 'PASS', `${name} (${size}) fits`, px > 0 ? `${px}px too wide` : '');
	};
	await page.goto(BASE + '/lærer/bingo_host.html');
	await page.locator('#bingoSetup').waitFor();
	await page.screenshot({ path: `${OUT}/bingo-setup-${size}.png`, fullPage: true });
	await overflow('bingo setup');
	await page.click('#startBtn');
	await page.locator('#lobby').waitFor();
	await page.waitForTimeout(500);
	await page.screenshot({ path: `${OUT}/bingo-lobby-${size}.png`, fullPage: true });
	await overflow('bingo waiting room');
	await page.click('#cancelGameBtn');
	await page.goto(BASE + '/lærer/raid.html');
	await page.locator('#raidSetup').waitFor();
	await page.screenshot({ path: `${OUT}/raid-setup-${size}.png`, fullPage: true });
	await overflow('raid setup');
	await page.click('#createRaidBtn');
	await page.locator('#lobby').waitFor();
	await page.waitForTimeout(500);
	await page.screenshot({ path: `${OUT}/raid-lobby-${size}.png`, fullPage: true });
	await overflow('raid waiting room');
	await page.click('#cancelGameBtn');
}
await browser.close();
