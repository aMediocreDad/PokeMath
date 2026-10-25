// Screenshots of the class-game screens at phone and desktop size: the teacher page's game list,
// the bingo, raid and memory setups and waiting rooms, and the children's join page. Run against
// tests/serve-worker.sh. Usage: node tests/class-game-shots.mjs <outdir>
import { createRequire } from 'module';
import { muteAudio } from './mute.mjs';
import { acceptAsks } from './ask.mjs';
const require = createRequire(import.meta.url);
const { webkit, devices } = require('playwright-core');
const BASE = process.env.BASE || 'http://localhost:3123';
const OUT = process.argv[2] || '.';

const browser = muteAudio(await webkit.launch());
for (const [size, options] of [['phone', devices['iPhone 13']], ['desktop', { viewport: { width: 1280, height: 800 } }]]) {
	const page = await (await browser.newContext(options)).newPage();
	await acceptAsks(page);
	const overflow = async (name) => {
		const px = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
		console.log(px > 0 ? 'FAIL' : 'PASS', `${name} (${size}) fits`, px > 0 ? `${px}px too wide` : '');
	};
	// Avbryt waits for the server to end the game and may then leave the page; a goto before that
	// races the late navigation.
	const cancel = async () => {
		const from = page.url();
		await page.click('#cancelGameBtn');
		await page.waitForURL((url) => url.href !== from, { timeout: 3000 }).catch(() => {});
		await page.waitForLoadState();
	};
	await page.goto(BASE + '/lærer/index.html');
	await page.locator('#game-memory').waitFor();
	await page.screenshot({ path: `${OUT}/teacher-games-${size}.png`, fullPage: true });
	await overflow('teacher page');
	await page.goto(BASE + '/lærer/bingo_host.html');
	await page.locator('#bingoSetup').waitFor();
	await page.screenshot({ path: `${OUT}/bingo-setup-${size}.png`, fullPage: true });
	await overflow('bingo setup');
	await page.click('#startBtn');
	await page.locator('#lobby').waitFor();
	await page.waitForTimeout(500);
	await page.screenshot({ path: `${OUT}/bingo-lobby-${size}.png`, fullPage: true });
	await overflow('bingo waiting room');
	await cancel();
	await page.goto(BASE + '/lærer/raid.html');
	await page.locator('#raidSetup').waitFor();
	await page.screenshot({ path: `${OUT}/raid-setup-${size}.png`, fullPage: true });
	await overflow('raid setup');
	await page.click('#createRaidBtn');
	await page.locator('#lobby').waitFor();
	await page.waitForTimeout(500);
	await page.screenshot({ path: `${OUT}/raid-lobby-${size}.png`, fullPage: true });
	await overflow('raid waiting room');
	await cancel();
	await page.goto(BASE + '/lærer/memory.html');
	await page.locator('#memorySetup').waitFor();
	await page.screenshot({ path: `${OUT}/memory-setup-${size}.png`, fullPage: true });
	await overflow('memory setup');
	await page.click('#createMemoryBtn');
	await page.locator('#lobby').waitFor();
	await page.waitForTimeout(500);
	await page.screenshot({ path: `${OUT}/memory-lobby-${size}.png`, fullPage: true });
	await overflow('memory waiting room');
	await cancel();
	await page.goto(BASE + '/bingo_join.html');
	await page.locator('#code').waitFor();
	await page.screenshot({ path: `${OUT}/join-${size}.png`, fullPage: true });
	await overflow('join page');
}
await browser.close();
