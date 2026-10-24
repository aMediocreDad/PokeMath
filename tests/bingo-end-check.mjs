// Ending a bingo from the teacher's page: the room is forgotten only when the server says it has
// ended. With the connection down, End says so and changes nothing; once the page is back, End
// works, pays the children who caught something, and leaves for the teacher page.
// "Nytt brett" and "Avbryt" wait for the server the same way.
// Run against tests/serve-worker.sh. Usage: node tests/bingo-end-check.mjs
import { createRequire } from 'module';
import { muteAudio } from './mute.mjs';
const require = createRequire(import.meta.url);
const { webkit } = require('playwright-core');
const WebSocket = require('ws');
const BASE = process.env.BASE || 'http://localhost:3123';
const results = [];
const check = (name, ok, detail = '') => {
	results.push(ok);
	console.log(ok ? 'PASS' : 'FAIL', name, detail);
};

// What the server says about a lobby, and a child who catches something in it.
const login = await (await fetch(BASE + '/teacher/access-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).json();
function socket() {
	const ws = new WebSocket(BASE.replace('http', 'ws') + '/ws');
	const inbox = [];
	ws.on('message', (raw) => inbox.push(JSON.parse(raw)));
	const opened = new Promise((resolve) => ws.on('open', resolve));
	const next = async (type, ms = 3000) => {
		for (let waited = 0; waited < ms; waited += 50) {
			const i = inbox.findIndex((m) => m.type === type);
			if (i >= 0) return inbox.splice(i, 1)[0];
			await new Promise((r) => setTimeout(r, 50));
		}
		return null;
	};
	return { ws, opened, next, send: (m) => ws.send(JSON.stringify(m)) };
}
const probe = socket();
await probe.opened;
/** True when the server no longer has this lobby. */
const gone = async (code) => {
	probe.send({ type: 'hostJoinLobby', teacherSession: login.teacherSession, code });
	return !!(await probe.next('lobbyNotFound', 1500));
};
async function child(code, uuid) {
	const c = socket();
	await c.opened;
	c.send({ type: 'joinLobby', code, uuid, name: 'Kari', icon: '' });
	await c.next('joinResult');
	return c;
}
const prizes = async (uuid) => (await (await fetch(`${BASE}/bingo/claim-prizes?uuid=${uuid}`)).json()).prizes;

const browser = muteAudio(await webkit.launch());
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
// Keep the host page's sockets reachable, so the test can drop its connection and keep it down.
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
const teacher = await ctx.newPage();
teacher.on('pageerror', (e) => console.log('teacher pageerror', e.message));

/** The question the page asks, answered yes or no. */
async function answerAsk(ok) {
	await teacher.locator('#ask-text').waitFor({ timeout: 5000 });
	const text = await teacher.textContent('#ask-text');
	await teacher.click(ok ? '#ask-ok' : '#ask-cancel');
	return text;
}
async function newBingo() {
	await teacher.goto(BASE + '/lærer/bingo_host.html');
	await teacher.locator('#bingoSetup').waitFor({ timeout: 10000 });
	await teacher.click('#prizeType [data-value="coins"]');
	await teacher.click('#startBtn');
	await teacher.locator('#lobbyCode').waitFor({ timeout: 15000 });
	return (await teacher.textContent('#lobbyCode')).trim();
}

// ── A bingo being played, and the connection drops ──
const code = await newBingo();
const kari = crypto.randomUUID();
const karisSocket = await child(code, kari);
await teacher.locator('#lobbyPlayers li', { hasText: 'Kari' }).waitFor({ timeout: 10000 });
await teacher.click('#startGameBtn');
await teacher.locator('#bingoCard').waitFor({ timeout: 5000 });
karisSocket.send({ type: 'catchPokemon', code, uuid: kari, name: 'Kari', pokemonCode: 'N25', pokedexId: 25, pokemonName: 'Pikachu', types: ['electric'], flags: {}, difficulty: 'stage3' });
await teacher.waitForFunction(() => /1/.test(document.querySelector('#players .player-row')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => {});

await teacher.evaluate(() => {
	window.__blockWs = true;
	window.__sockets.at(-1).close();
});
await teacher.locator('#connection-lost').waitFor({ timeout: 5000 });
check('the teacher is told the connection is down', true);
await teacher.click('#endGameBtn');
const question = await answerAsk(true);
check('the question says the children who caught something get the prize', question.includes('får premien'), question.replace(/\s+/g, ' '));
await teacher.locator('#host-banner', { hasText: 'Ingen forbindelse' }).waitFor({ timeout: 5000 });
check('End with no connection says so', true);
check('…and changes nothing: the board is still there, and so is the code the page rejoins by', (await teacher.locator('#bingoCard').isVisible()) && (await teacher.evaluate(() => localStorage.getItem('teacherBingoCode'))) === code && teacher.url().endsWith('/bingo_host.html'));
check('the server still has the bingo', !(await gone(code)));

await teacher.evaluate(() => (window.__blockWs = false));
await teacher.locator('#connection-lost').waitFor({ state: 'hidden', timeout: 25000 });
check('the page comes back by itself', true);
check('…and the warning goes away with it', await teacher.locator('#host-banner').waitFor({ state: 'hidden', timeout: 2000 }).then(() => true, () => false));
await teacher.click('#endGameBtn');
await answerAsk(true);
await teacher.waitForURL(/\/l%C3%A6rer\/index\.html|\/lærer\/index\.html/, { timeout: 10000 });
check('End with a connection goes back to the teacher page', true);
check('…which no longer offers to continue it', (await teacher.evaluate(() => localStorage.getItem('teacherBingoCode'))) === null && (await teacher.locator('a, button', { hasText: 'Fortsett bingo' }).count()) === 0);
check('the server has ended it', await gone(code));
const paid = await prizes(kari);
check('the child who caught something is paid the main prize', paid.length === 1 && paid[0].type === 'coins' && paid[0].amount === 10000, JSON.stringify(paid));

// ── Nytt brett: the new board comes once the old one has ended ──
const second = await newBingo();
await teacher.locator('#startGameBtn').waitFor();
const lena = crypto.randomUUID();
await child(second, lena);
await teacher.locator('#lobbyPlayers li', { hasText: 'Kari' }).waitFor({ timeout: 10000 });
await teacher.click('#startGameBtn');
await teacher.locator('#bingoCard').waitFor({ timeout: 5000 });
await teacher.click('#newGameBtn');
const newQuestion = await answerAsk(true);
check('"Nytt brett" says what happens to the prize', newQuestion.includes('Nytt brett') || newQuestion.includes('nytt brett'), newQuestion.replace(/\s+/g, ' '));
await teacher.waitForFunction((old) => document.querySelector('#lobbyCode')?.textContent.trim() && document.querySelector('#lobbyCode').textContent.trim() !== old, second, { timeout: 10000 });
const third = (await teacher.textContent('#lobbyCode')).trim();
check('a new board has a new code, and the old one is ended', third !== second && (await gone(second)));
check('…and the page rejoins the new one', (await teacher.evaluate(() => localStorage.getItem('teacherBingoCode'))) === third);

// ── Avbryt in the waiting room ──
await teacher.click('#cancelGameBtn');
await teacher.locator('#bingoSetup').waitFor({ timeout: 10000 });
check('"Avbryt" leaves for the setup once the server has ended the room', await gone(third) && (await teacher.evaluate(() => localStorage.getItem('teacherBingoCode'))) === null);

await browser.close();
probe.ws.close();
karisSocket.ws.close();
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
process.exit(results.every(Boolean) ? 0 : 1);
