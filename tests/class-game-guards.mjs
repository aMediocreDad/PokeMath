// What the class-game server (worker/bingo.js) refuses and keeps, over the /ws socket and the prize
// claim, without a browser: ids that are not ids, a socket speaking for another child, catches
// forged or sent faster than a child can play, a child asked to rename keeping their record, an
// ended bingo paying its prize, and the prize claim that only a POST empties.
// Needs the site running (tests/serve-worker.sh); makes its own rooms. Takes about 15 s.
// Usage: node tests/class-game-guards.mjs [base]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const BASE = process.argv[2] || process.env.BASE || 'http://localhost:3123';
const WS = BASE.replace('http', 'ws') + '/ws';
let failed = 0;
const check = (name, ok, detail = '') => {
	console.log(ok ? 'PASS' : 'FAIL', name, detail);
	if (!ok) failed++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const json = (path, init = {}) => fetch(BASE + path, { ...init, headers: { 'Content-Type': 'application/json' } }).then((r) => r.json().then((body) => ({ status: r.status, body })));

function client() {
	const ws = new WebSocket(WS);
	const inbox = [];
	const waiters = [];
	ws.on('message', (raw) => {
		const msg = JSON.parse(raw);
		const i = waiters.findIndex((w) => w.type === msg.type);
		if (i >= 0) waiters.splice(i, 1)[0].resolve(msg);
		else inbox.push(msg);
	});
	return {
		ws,
		opened: new Promise((r) => ws.on('open', r)),
		send: (m) => ws.send(JSON.stringify(m)),
		/** The next message of this type, or rejects after `ms`. */
		next: (type, ms = 2000) => {
			const i = inbox.findIndex((m) => m.type === type);
			if (i >= 0) return Promise.resolve(inbox.splice(i, 1)[0]);
			return new Promise((resolve, reject) => {
				const waiter = { type, resolve };
				waiters.push(waiter);
				setTimeout(() => {
					const at = waiters.indexOf(waiter);
					if (at >= 0) waiters.splice(at, 1);
					reject(new Error('timeout waiting for ' + type));
				}, ms);
			});
		},
		/** True when no message of this type arrives within a short wait. */
		silent: (type, ms = 600) => new Promise((resolve) => {
			const i = inbox.findIndex((m) => m.type === type);
			if (i >= 0) return resolve(false);
			const waiter = { type, resolve: () => resolve(false) };
			waiters.push(waiter);
			setTimeout(() => {
				const at = waiters.indexOf(waiter);
				if (at >= 0) waiters.splice(at, 1);
				resolve(true);
			}, ms);
		}),
		/** Drop what has arrived, so the next wait only sees what comes after this. */
		clear: () => (inbox.length = 0),
	};
}

const login = await json('/teacher/access-login', { method: 'POST', body: '{}' });
const teacherSession = login.body.teacherSession;
if (!teacherSession) {
	console.log('FAIL the teacher gets a session', JSON.stringify(login.body));
	process.exit(1);
}
const opened = [];
const connect = async () => {
	const c = client();
	opened.push(c);
	await c.opened;
	return c;
};
const hostMsg = (c, message) => c.send({ teacherSession, ...message });

/** A teacher with a bingo in the lobby phase. */
async function bingo(settings = {}) {
	const host = await connect();
	hostMsg(host, { type: 'hostCreateLobby', settings: { difficulty: 'unik', minLevel: 'alle', prizeType: 'coins', ...settings } });
	const room = await host.next('lobbyCreated');
	return { host, code: room.code, cells: room.board.cells };
}
/** A child on a socket of their own, joined. */
async function join(code, uuid, name, expectOk = true) {
	const c = await connect();
	c.send({ type: 'joinLobby', code, uuid, name, icon: '' });
	const result = await c.next('joinResult');
	if (expectOk && !result.ok) throw new Error(`${name} could not join ${code}`);
	return Object.assign(c, { result });
}
const start = async (host, code) => {
	hostMsg(host, { type: 'hostStartBingo', code });
	await host.next('bingoStarted');
};
const targets = (cells) => cells.filter((c) => c.task?.rule?.kind === 'pokedexExact').map((c) => c.task.rule.id);
const catchMsg = (code, uuid, id, extra = {}) => ({ type: 'catchPokemon', code, uuid, name: 'x', pokemonCode: `N${id}`, pokedexId: id, pokemonName: 'X', types: [], flags: {}, difficulty: 'stage3', ...extra });
/** What a child would get from the claim, confirming it as the game page does. */
async function claim(uuid) {
	const got = await json(`/bingo/claim-prizes?uuid=${uuid}`);
	const prizes = got.body.prizes;
	if (prizes.length) await json(`/bingo/claim-prizes?uuid=${uuid}`, { method: 'POST', body: JSON.stringify({ ids: prizes.map((p) => p.id) }) });
	return prizes;
}
const players = async (host, code) => {
	hostMsg(host, { type: 'hostJoinLobby', code });
	return (await host.next('lobbyState')).players;
};

// ── 1. Ids that are not ids, and a socket speaking for someone else ──
async function strangers() {
	const { host, code, cells } = await bingo();
	const [a, b] = [crypto.randomUUID(), crypto.randomUUID()];
	const [ca, cb] = [await join(code, a, 'Anna'), await join(code, b, 'Bo')];
	await start(host, code);
	const id = targets(cells)[0];
	const outsider = await connect();
	for (const bad of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', '', 'not-a-uuid']) {
		outsider.send({ type: 'joinLobby', code, uuid: bad, name: 'Snik', icon: '' });
		check(`joining as "${bad}" is refused`, (await outsider.next('joinResult')).ok === false);
		outsider.send(catchMsg(code, bad, id));
	}
	check('a socket that never joined cannot catch for "__proto__" or "constructor"', await host.silent('toastCatch') && await host.silent('boardUpdate'));
	outsider.send(catchMsg(code, a, id));
	check('a socket that never joined cannot catch for a real child', await host.silent('toastCatch'));
	cb.send(catchMsg(code, a, id));
	check('a child cannot catch for another child on their own socket', await host.silent('toastCatch'));
	ca.send(catchMsg(code, a, id));
	const toast = await host.next('toastCatch');
	check('the child themself still catches', toast.name === 'Anna' && toast.matched === true);
	const list = (await players(host, code)).map((p) => `${p.name}:${p.catchCount}`).sort();
	check('only the two children are in the room, with sane counts', list.join() === 'Anna:1,Bo:0', list.join());
	hostMsg(host, { type: 'hostEndLobby', code });
}

async function strangersInRaid() {
	const host = await connect();
	hostMsg(host, { type: 'hostCreateRaid', settings: { boss: 150, length: 'short' } });
	const raid = await host.next('raidState');
	const [a, b] = [crypto.randomUUID(), crypto.randomUUID()];
	const [ca, cb] = [await join(raid.code, a, 'Anna'), await join(raid.code, b, 'Bo')];
	hostMsg(host, { type: 'hostStartRaid', code: raid.code });
	await host.next('raidState');
	const outsider = await connect();
	for (const bad of ['__proto__', 'constructor']) outsider.send({ type: 'answer', code: raid.code, uuid: bad, value: 40, stage: 3 });
	outsider.send({ type: 'raidHit', code: raid.code, uuid: a, value: 40, stage: 3 });
	cb.send({ type: 'answer', code: raid.code, uuid: a, value: 40, stage: 3 });
	check('no hit for "__proto__", a socket that never joined, or another child', await host.silent('raidHit', 900));
	ca.send({ type: 'answer', code: raid.code, uuid: a, value: 40, stage: 3 });
	const hit = await host.next('raidHit');
	check('the child still hits, and the room has only the two children', hit.damage === 40 && hit.players.length === 2 && hit.players.every((p) => Number.isFinite(p.damage ?? 0)));
	hostMsg(host, { type: 'hostEndLobby', code: raid.code });
}

async function strangersInMemory() {
	const host = await connect();
	hostMsg(host, { type: 'hostCreateMemory', settings: { size: 'small' } });
	const mem = await host.next('memoryState');
	const a = crypto.randomUUID();
	const ca = await join(mem.code, a, 'Anna');
	hostMsg(host, { type: 'hostStartMemory', code: mem.code });
	await host.next('memoryState');
	const outsider = await connect();
	for (const bad of ['__proto__', 'constructor']) outsider.send({ type: 'answer', code: mem.code, uuid: bad });
	outsider.send({ type: 'answer', code: mem.code, uuid: a });
	check('no memory answer for "__proto__" or a socket that never joined', await host.silent('memoryAnswer', 900));
	ca.send({ type: 'answer', code: mem.code, uuid: a });
	check('the child still answers', (await host.next('memoryAnswer')).name === 'Anna');
	hostMsg(host, { type: 'hostEndLobby', code: mem.code });
}

// ── 2. Catches that no child could have made ──
async function forgedCatches() {
	const { host, code, cells } = await bingo();
	const a = crypto.randomUUID();
	const ca = await join(code, a, 'Anna');
	await start(host, code);
	const [t0, t1, t2] = targets(cells);
	ca.send(catchMsg(code, a, t0));
	check('a catch counts', (await host.next('toastCatch')).matched === true);
	await host.next('boardUpdate');
	ca.send(catchMsg(code, a, t1));
	check('a second catch a moment later does not', await host.silent('toastCatch'));
	await sleep(5200);
	ca.send(catchMsg(code, a, t0));
	check('the same Pokémon again does not count', await host.silent('toastCatch'));
	ca.send(catchMsg(code, a, t1));
	check('another one does, once the wait is over', (await host.next('toastCatch')).matched === true);
	await host.next('boardUpdate');
	await sleep(5200);
	// A unik board holds ids 1 to 1010, so 1020 is on no cell.
	ca.send(catchMsg(code, a, 1020, { pokedexId: t2 }));
	const forged = await host.next('toastCatch');
	check('the Pokémon in the code decides what is caught, not the one the message claims', forged.matched === false && forged.pokedexId === 1020, JSON.stringify({ matched: forged.matched, id: forged.pokedexId }));
	await host.next('boardUpdate');
	await sleep(5200);
	for (const pokemonCode of ['garbage', 'N0', 'N99999', 'N-1', '']) ca.send(catchMsg(code, a, t2, { pokemonCode }));
	check('a code that is not a Pokémon does not count', await host.silent('toastCatch'));
	ca.send(catchMsg(code, a, t2, { pokemonName: 'x'.repeat(100000), types: Array(500).fill('fire'), flags: { shiny: true, evil: true } }));
	const big = await host.next('toastCatch');
	check('what a catch says about itself is cut down before it is stored', String(big.pokemonName).length <= 40 && big.types.length <= 4 && !('evil' in big.flags), `${String(big.pokemonName).length} chars, ${big.types.length} types`);
	hostMsg(host, { type: 'hostEndLobby', code });
}

// ── 5. A child asked to rename keeps what they had ──
async function rename() {
	const { host, code, cells } = await bingo();
	const a = crypto.randomUUID();
	const ca = await join(code, a, 'Tull');
	await start(host, code);
	ca.send(catchMsg(code, a, targets(cells)[0]));
	await host.next('toastCatch');
	hostMsg(host, { type: 'hostForceRename', code, uuid: a });
	await ca.next('forceRename');
	let list = await players(host, code);
	check('the child stays on the list, with their catches, marked as needing a new name', list.length === 1 && list[0].catchCount === 1 && list[0].needsRename === true, JSON.stringify(list));
	await sleep(5200);
	ca.send(catchMsg(code, a, targets(cells)[1]));
	check('catches wait until the child has a new name', await host.silent('toastCatch'));
	const same = await connect();
	same.send({ type: 'joinLobby', code, uuid: a, name: 'Tull', icon: '' });
	check('joining again with the old name is told to rename', !!(await same.next('forceRename')));
	const fresh = await join(code, a, 'Tuva');
	list = await players(host, code);
	check('joining with a new name keeps the catches', fresh.result.ok && list.length === 1 && list[0].name === 'Tuva' && list[0].catchCount === 1 && !list[0].needsRename, JSON.stringify(list));
	fresh.send(catchMsg(code, a, targets(cells)[1]));
	check('…and the child catches again', (await host.next('toastCatch')).name === 'Tuva');
	hostMsg(host, { type: 'hostEndLobby', code });
}

async function renameInRaid() {
	const host = await connect();
	hostMsg(host, { type: 'hostCreateRaid', settings: { boss: 150, length: 'long' } });
	const raid = await host.next('raidState');
	const a = crypto.randomUUID();
	const ca = await join(raid.code, a, 'Tull');
	hostMsg(host, { type: 'hostStartRaid', code: raid.code });
	await host.next('raidState');
	ca.send({ type: 'answer', code: raid.code, uuid: a, value: 30, stage: 3 });
	await host.next('raidHit');
	hostMsg(host, { type: 'hostForceRename', code: raid.code, uuid: a });
	await ca.next('forceRename');
	const fresh = await join(raid.code, a, 'Tuva');
	hostMsg(host, { type: 'hostJoinLobby', code: raid.code });
	const state = await host.next('raidState');
	const me = state.players.find((p) => p.uuid === a);
	check('a raid child asked to rename keeps their damage and hits', fresh.result.ok && me?.name === 'Tuva' && me.damage === 30 && me.catchCount === 1, JSON.stringify(me));
	await sleep(1100);
	fresh.send({ type: 'answer', code: raid.code, uuid: a, value: 30, stage: 3 });
	check('…and the one-second wait between hits survives the rename', (await host.next('raidHit')).players.find((p) => p.uuid === a).damage === 60);
	hostMsg(host, { type: 'hostEndLobby', code: raid.code });
}

// ── 6 and 9. A bingo that ends early pays, and the claim only empties on a POST ──
async function endedBingo() {
	const { host, code, cells } = await bingo();
	const [a, b] = [crypto.randomUUID(), crypto.randomUUID()];
	const [ca, cb] = [await join(code, a, 'Anna'), await join(code, b, 'Bo')];
	await start(host, code);
	ca.send(catchMsg(code, a, targets(cells)[0]));
	await host.next('toastCatch');
	hostMsg(host, { type: 'hostEndLobby', code });
	check('the child who caught something hears there is a prize', !!(await ca.next('bingoReward')));
	await host.next('lobbyEnded');
	check('the child who caught nothing does not', await cb.silent('bingoReward'));
	await sleep(300);
	const first = await json(`/bingo/claim-prizes?uuid=${a}`);
	const again = await json(`/bingo/claim-prizes?uuid=${a}`);
	check('an ended bingo pays its main prize to the child with a catch', first.body.prizes.length === 1 && first.body.prizes[0].type === 'coins' && first.body.prizes[0].amount === 50000, JSON.stringify(first.body.prizes));
	check('reading the prizes without keep=1 leaves them there', again.body.prizes.length === 1 && again.body.prizes[0].id === first.body.prizes[0].id && !!first.body.prizes[0].id);
	check('a child with no catch gets nothing', (await json(`/bingo/claim-prizes?uuid=${b}`)).body.prizes.length === 0);
	const garbage = await fetch(`${BASE}/bingo/claim-prizes?uuid=${a}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: 5 }) });
	check('a confirmation that is not a list of ids does no harm', garbage.ok && (await json(`/bingo/claim-prizes?uuid=${a}&keep=1`)).body.prizes.length === 1);
	check('keep=1 is still accepted', (await json(`/bingo/claim-prizes?uuid=${a}&keep=1`)).body.prizes.length === 1);
	check('only the confirmation takes it', (await claim(a)).length === 1 && (await json(`/bingo/claim-prizes?uuid=${a}`)).body.prizes.length === 0);
	check('a claim for something that is not an id is empty', (await json('/bingo/claim-prizes?uuid=__proto__')).body.prizes.length === 0);
}

async function endedInTheLobby() {
	const { host, code } = await bingo();
	const a = crypto.randomUUID();
	await join(code, a, 'Anna');
	hostMsg(host, { type: 'hostEndLobby', code });
	await host.next('lobbyEnded');
	await sleep(200);
	check('a bingo ended before it started pays nobody', (await json(`/bingo/claim-prizes?uuid=${a}`)).body.prizes.length === 0);
}

async function lockedThenEnded() {
	const { host, code, cells } = await bingo();
	const a = crypto.randomUUID();
	const ca = await join(code, a, 'Anna');
	await start(host, code);
	ca.send(catchMsg(code, a, targets(cells)[0]));
	await host.next('toastCatch');
	hostMsg(host, { type: 'hostLockLobby', code });
	await host.next('lobbyPrize');
	hostMsg(host, { type: 'hostEndLobby', code });
	await host.next('lobbyEnded');
	await sleep(300);
	check('a bingo whose prize was handed out pays only once when it is ended', (await claim(a)).length === 1);
}

// ── 7. A room does not grow without end ──
async function fullRoom() {
	const { host, code } = await bingo();
	const ids = Array.from({ length: 60 }, () => crypto.randomUUID());
	for (const [i, id] of ids.entries()) await join(code, id, `Barn${i}`);
	const extra = await join(code, crypto.randomUUID(), 'For mange', false);
	check('the 61st child cannot join', extra.result.ok === false);
	const back = await connect();
	back.send({ type: 'joinLobby', code, uuid: ids[0], name: 'x'.repeat(5000), icon: 'y'.repeat(5000) });
	check('a child who is already in can rejoin a full room', (await back.next('joinResult')).ok === true);
	const list = await players(host, code);
	check('a long name and icon are cut, and the room holds 60', list.length === 60 && list.every((p) => p.name.length <= 22 && p.icon.length <= 200), `${list.length} children`);
	hostMsg(host, { type: 'hostEndLobby', code });
}

await Promise.all([strangers(), strangersInRaid(), strangersInMemory(), forgedCatches(), rename(), renameInRaid(), endedBingo(), endedInTheLobby(), lockedThenEnded(), fullRoom()].map((p) => p.catch((e) => check('a scenario ran to the end', false, e.message))));
for (const c of opened) c.ws.close();
console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
