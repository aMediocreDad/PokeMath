// Classroom bingo, ported from dev/bingo.js: the /ws WebSocket used by the teacher's host page
// and the players' game page, plus /bingo/claim-prizes. The class raid (worker/raid.js) and
// memory (worker/memory.js) run in the same object as rooms of kind "raid" and "memory";
// bingo-only handlers ignore them.
//
// One Durable Object holds every lobby. The client names its lobby only in messages sent after
// the socket opens, so the Worker cannot pick a lobby's object when the socket connects; at
// family scale one object is plenty. Sockets hibernate between messages, so each socket's role
// lives in its attachment and each lobby in the object's storage.
import { DurableObject } from 'cloudflare:workers';
import bingoTasks from '../static/bingo-tasks.js';
import { log } from './http.js';
import { answer, flip, memoryPrizes, memoryState, newMemory, startMemory } from './memory.js';
import { MAX_PAID_CATCHES, MAX_PLAYERS, isUuid, paidCount, playerOf } from './players.js';
import { hit, newRaid, raidPrizes, raidState, startRaid } from './raid.js';
import { sessionTeacher } from './teacher.js';

const GEN_END = [151, 251, 386, 493, 649, 721, 809, 905, 1025];
const STAGE_ORDER = ['custom', 'stage1', 'stage2', 'stage3', 'stage4', 'stage5'];
const COIN_PRIZE = { easy: 5000, medium: 10000, hard: 25000, extreme: 35000, unik: 50000 };
/** Every completed row or column pays this to each child who has caught something. */
const LINE_COINS = 500;
const MAX_EVENTS = 500;
const HOUR = 60 * 60 * 1000;
const CLEANUP_EVERY = 6 * HOUR;
const ROOM_LIFETIME = 24 * HOUR;
const PRIZE_LIFETIME = 30 * 24 * HOUR;
/**
 * A child's catches closer together than this are dropped. A catch takes 3 to 5 correct answers
 * and two taps, so nobody plays faster; a page that sends faster is not a child playing.
 */
const MIN_CATCH_GAP = 5000;
const LAST_POKEMON = 1025;
/** The lobby remembers kicked and rename-asked ids, and the Pokémon each child has caught; this many of the newest are kept. */
const MAX_REMEMBERED = 200;
/** The flags a catch can carry; bingo's flag cells read these and nothing else. */
const CATCH_FLAGS = ['shiny', 'mega', 'gmax', 'hisuian', 'alolan', 'legendary', 'mythic'];

/** Unclaimed prizes are stored as { at, prizes }; the first deploy stored the bare list. */
const unwrapPrizes = (value) => (Array.isArray(value) ? value : value?.prizes || []);

// The production server's category lists are not public; these are a reasonable stand-in.
const CATEGORIES = {
	starter: [1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393, 495, 498, 501, 650, 653, 656, 722, 725, 728, 810, 813, 816, 906, 909, 912],
	dog: [58, 59, 209, 210, 228, 229, 243, 244, 245, 261, 262, 506, 507, 508, 667, 668, 744, 745, 835, 836, 888, 889, 926, 927],
	bird: [16, 17, 18, 21, 22, 83, 84, 85, 144, 145, 146, 163, 164, 276, 277, 396, 397, 398, 519, 520, 521, 661, 662, 663, 731, 732, 733, 821, 822, 823],
	fish: [118, 119, 129, 130, 170, 171, 211, 222, 223, 224, 318, 319, 339, 340, 349, 350, 369, 370, 456, 457, 550, 594, 846, 847],
	plant: [43, 44, 45, 69, 70, 71, 102, 103, 114, 182, 187, 188, 189, 191, 192, 315, 406, 407, 420, 421, 455, 465, 546, 547, 548, 549],
	cat: [52, 53, 300, 301, 403, 404, 405, 431, 432, 509, 510, 677, 678, 725, 726, 727, 863],
	mouse: [19, 20, 25, 26, 27, 28, 172, 311, 312, 417, 587, 702, 777, 819, 820, 921, 922, 923],
	eevee: [133, 134, 135, 136, 196, 197, 470, 471, 700],
	alien: [120, 121, 343, 344, 386, 436, 437, 599, 600, 601, 605, 606, 794, 795, 796, 797, 798, 799, 803, 804, 805, 806],
	machine: [81, 82, 137, 233, 462, 474, 599, 600, 601, 649, 774, 781, 801],
	farm: [83, 84, 85, 128, 241, 273, 274, 275, 672, 673, 819, 820, 916],
};

const BAD_SESSION = { type: 'error', message: 'Lærerøkten er ugyldig. Logg inn på nytt.' };

/**
 * A bingo waits in "lobby" while the class joins; catches count from "play", once the teacher
 * presses Start. Rooms made before the lobby existed have no phase and are already playing.
 * @param {any} room
 */
const bingoPhase = (room) => room.phase || 'play';

/**
 * A game still being played, whose children are still owed their prize: a raid being fought, a
 * memory game being played, or a bingo started and not yet locked. Ending it now pays them.
 * @param {any} room
 */
export const unfinished = (room) =>
	!room.awarded &&
	((room.kind === 'raid' && room.phase === 'fight') ||
		(room.kind === 'memory' && room.phase === 'play') ||
		(!room.kind && !room.locked && bingoPhase(room) === 'play'));

/** The teacher asked this child for a new name, and they have not come back with one. @param {any} room @param {string} uuid */
const askedToRename = (room, uuid) => Boolean(room.renameAsked && Object.hasOwn(room.renameAsked, uuid));

/** The newest `count` entries of an object. @template T @param {Record<string, T>} object @param {number} count */
const newest = (object, count) => Object.fromEntries(Object.entries(object).slice(-count));

/** @param {unknown} value @param {number} max */
const text = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');

/**
 * What a catch message says, cut down to what bingo reads. The pokedex number comes from the
 * catch's own code, as the game page makes it ("N25", "S25-1"), not from a field a page could set
 * to anything. Null when the code is not a Pokémon.
 * @param {any} msg
 */
export function catchFacts(msg) {
	const pokemonCode = text(msg.pokemonCode, 16);
	const match = /^[NS](\d{1,4})(?:-[A-Z0-9]{1,8})?$/i.exec(pokemonCode);
	const pokedexId = Number(match?.[1]);
	if (!match || pokedexId < 1 || pokedexId > LAST_POKEMON) return null;
	return {
		pokemonCode,
		pokedexId,
		pokemonName: text(msg.pokemonName, 40),
		difficulty: text(msg.difficulty, 12),
		types: Array.isArray(msg.types) ? msg.types.slice(0, 4).map((/** @type {unknown} */ t) => text(t, 20)) : [],
		flags: Object.fromEntries(CATCH_FLAGS.map((flag) => [flag, msg.flags?.[flag] === true])),
	};
}

/** @template T @param {T[]} list @param {number} count */
const pick = (list, count) => [...list].sort(() => Math.random() - 0.5).slice(0, count);

/** @param {string} difficulty @param {unknown} gridSize */
function buildBoard(difficulty, gridSize = 5) {
	const size = [5, 7, 9, 11, 13, 15].includes(Number(gridSize)) ? Number(gridSize) : 5;
	const count = size * size - 1;
	const config = bingoTasks.difficultyConfig[difficulty] || bingoTasks.difficultyConfig.easy;
	let chosen;
	if (config.uniqueIds) {
		chosen = bingoTasks.generateUniqueIdTasks(config.uniqueIds);
	} else {
		chosen = [
			...pick(bingoTasks.tasks.filter((t) => t.difficulty === 'easy' && t.rule), config.easy),
			...pick(bingoTasks.tasks.filter((t) => t.difficulty === 'medium' && t.rule), config.medium),
			...Array.from({ length: config.randomRange }, bingoTasks.generateRandomRangeTask),
			...Array.from({ length: config.random }, bingoTasks.generateRandomNumberTask),
		];
	}
	// Bigger boards need more tasks than the lists hold; random numbers and ranges fill up.
	while (chosen.length < count) chosen.push(chosen.length % 2 ? bingoTasks.generateRandomRangeTask() : bingoTasks.generateRandomNumberTask());
	chosen = pick(chosen, count);
	const cells = chosen.map((task, i) => ({ cellId: `c${i}-${task.id}`, free: false, marked: false, hits: 0, task }));
	cells.splice((count / 2) | 0, 0, { cellId: 'free', free: true, marked: true, hits: 0 });
	return { difficulty, cells, rows: size, cols: size };
}

/** Every cell is marked (or free): the game is over. @param {any} board */
const boardFull = (board) => board.cells.every((/** @type {any} */ c) => c.free || c.marked);

/** Rows and columns whose every cell is marked (or free). @param {any} board */
function completedLines(board) {
	const n = board.rows;
	const done = (/** @type {number} */ i) => board.cells[i]?.free || board.cells[i]?.marked;
	const lines = [];
	for (let r = 0; r < n; r++) if (Array.from({ length: n }, (_, c) => r * n + c).every(done)) lines.push({ key: `row${r}`, label: `Rad ${r + 1}` });
	for (let c = 0; c < n; c++) if (Array.from({ length: n }, (_, r) => r * n + c).every(done)) lines.push({ key: `col${c}`, label: `Kolonne ${c + 1}` });
	return lines;
}

function matches(rule, catchMsg) {
	if (!rule) return false;
	const id = Number(catchMsg.pokedexId);
	switch (rule.kind) {
		case 'gen': return id > (GEN_END[rule.gen - 2] || 0) && id <= GEN_END[rule.gen - 1];
		case 'type': return (catchMsg.types || []).includes(rule.type);
		case 'flag': return Boolean(catchMsg.flags?.[rule.flag]);
		case 'category': return (CATEGORIES[rule.category] || []).includes(id);
		case 'pokedexExact': return id === rule.id;
		case 'pokedexRange': return id >= rule.start && id <= rule.end;
		case 'nameStartsWith': return String(catchMsg.pokemonName || '').toUpperCase().startsWith(rule.letter);
		default: return false;
	}
}

// Prize the host modal shows, and the prizes each eligible player receives.
export function computePrize(room) {
	const players = Object.values(room.players);
	const eligible = players.filter((p) => p.catchCount > 0);
	const legendary = [144, 145, 146, 150, 243, 244, 245, 249, 250, 377, 378, 379, 380, 381, 382, 383, 384];
	const mythic = [151, 251, 385, 386, 490, 491, 492, 493, 494, 647, 648, 649];
	let type = room.settings.prizeType || 'random';
	if (type === 'random') type = pick(['coins', 'legendary', 'mythic', 'shiny'], 1)[0];

	switch (type) {
		case 'coins': {
			const amount = COIN_PRIZE[room.board.difficulty] || 5000;
			return { prize: { type: 'coins', amount }, perPlayer: () => [{ type: 'coins', amount }] };
		}
		case 'participation_coins': {
			// A child counts for as many catches as one can play (MAX_PAID_CATCHES), not for what a page sent.
			const caught = players.reduce((sum, p) => sum + paidCount(p.catchCount, MAX_PAID_CATCHES), 0);
			const pot = 2000 * players.length + 50 * caught;
			const share = Math.round(pot / Math.max(1, eligible.length));
			return { prize: { type: 'participation_coins', pot }, perPlayer: () => [{ type: 'coins', amount: share, participationPot: pot }] };
		}
		case 'per_catch_coins':
			return { prize: { type: 'per_catch_coins' }, perPlayer: (p) => [{ type: 'coins', amount: 50 * paidCount(p.catchCount, MAX_PAID_CATCHES) }] };
		case 'stardust':
			return { prize: { type: 'stardust', amount: 1 }, perPlayer: () => [{ type: 'stardust', amount: 1 }] };
		case 'shiny': {
			const prizes = Array.from({ length: 3 }, () => {
				const id = Math.floor(Math.random() * 1000) + 1;
				return { type: 'pokemon', pokedexId: id, entry: `S${id}`, shiny: true, legendary: false };
			});
			return { prize: prizes, perPlayer: () => prizes };
		}
		default: {
			const isLegendary = type === 'legendary';
			const id = pick(isLegendary ? legendary : mythic, 1)[0];
			const prize = { type: 'pokemon', pokedexId: id, entry: `N${id}`, shiny: false, legendary: isLegendary };
			return { prize, perPlayer: () => [prize] };
		}
	}
}

/** @param {WebSocket} ws @param {unknown} msg */
function send(ws, msg) {
	try {
		ws.send(JSON.stringify(msg));
	} catch {
		// The socket closed under us; its close handler tidies up.
	}
}

export class BingoHub extends DurableObject {
	/** @param {Request} request */
	async fetch(request) {
		const url = new URL(request.url);
		if (url.pathname === '/bingo/claim-prizes') {
			// The game page reads the prizes, gives them, then confirms their ids with a POST, so an
			// answer lost on bad wifi cannot lose a prize. Only the POST takes a prize away.
			const uuid = url.searchParams.get('uuid');
			if (!isUuid(uuid)) return Response.json({ ok: true, prizes: [] });
			const key = `prizes:${uuid}`;
			if (request.method === 'POST') {
				// The body first: from the read below to the write, only storage may be awaited, or a
				// prize stored meanwhile would be written over.
				const body = await request.json().catch(() => null);
				const ids = new Set(Array.isArray(body?.ids) ? body.ids : []);
				const stored = await this.ctx.storage.get(key);
				const prizes = unwrapPrizes(stored).filter((p) => !ids.has(p.id));
				if (prizes.length) await this.ctx.storage.put(key, { at: Array.isArray(stored) ? Date.now() : stored?.at, prizes });
				else await this.ctx.storage.delete(key);
				return Response.json({ ok: true });
			}
			const stored = await this.ctx.storage.get(key);
			let prizes = unwrapPrizes(stored);
			if (prizes.some((p) => !p.id)) {
				prizes = prizes.map((p) => (p.id ? p : { ...p, id: crypto.randomUUID() }));
				await this.ctx.storage.put(key, { at: Array.isArray(stored) ? Date.now() : stored?.at, prizes });
			}
			return Response.json({ ok: true, prizes });
		}
		if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
		const { 0: client, 1: server } = new WebSocketPair();
		this.ctx.acceptWebSocket(server);
		return new Response(null, { status: 101, webSocket: client });
	}

	/** @param {WebSocket} ws @param {string | ArrayBuffer} raw */
	async webSocketMessage(ws, raw) {
		let msg;
		try {
			msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
		} catch {
			return;
		}
		const handler = msg && typeof msg.type === 'string' && Object.hasOwn(HANDLERS, msg.type) ? HANDLERS[msg.type] : null;
		// The old bingo.js still sends an older message shape (lobbyCode, playerUUID); ignore it.
		if (handler && !msg.lobbyCode) await handler.call(this, ws, msg);
	}

	/** @param {WebSocket} ws */
	/** @param {WebSocket} ws @param {number} [code] @param {string} [reason] */
	async webSocketClose(ws, code, reason) {
		// Answer the browser's close, or its socket waits half-closed and never says it has gone.
		try {
			ws.close(code === 1005 || code === 1006 || !code ? 1000 : code, reason);
		} catch {
			// Already closed.
		}
		const who = ws.deserializeAttachment();
		if (who?.role !== 'player') return;
		const room = await this.room(who.code);
		if (room) this.toHosts(room.code, { type: 'playersUpdate', players: this.playerList(room, ws) });
	}

	async webSocketError(ws) {
		await this.webSocketClose(ws);
	}

	/** @param {string} code */
	room(code) {
		return code ? this.ctx.storage.get(`room:${String(code).toUpperCase()}`) : Promise.resolve(undefined);
	}

	async saveRoom(room) {
		room.updatedAt = Date.now();
		await this.ctx.storage.put(`room:${room.code}`, room);
		await this.scheduleCleanup();
	}

	async scheduleCleanup() {
		if (!(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(Date.now() + CLEANUP_EVERY);
	}

	/** Lobbies nobody has touched for a day, and prizes nobody has claimed for a month, go. */
	async alarm() {
		const now = Date.now();
		let left = 0;
		for (const [key, room] of await this.ctx.storage.list({ prefix: 'room:' })) {
			if (now - (room.updatedAt || 0) > ROOM_LIFETIME) {
				// A game left mid-play (the teacher closed the lid) still pays every child for their play.
				if (unfinished(room)) await this.award(room);
				for (const p of this.sockets((w) => w.code === room.code)) send(p, { type: 'ended' });
				await this.ctx.storage.delete(key);
				log('bingo', `rom ${room.code} ryddet bort`);
			} else left++;
		}
		for (const [key, value] of await this.ctx.storage.list({ prefix: 'prizes:' })) {
			// A bare list from the first deploy has no date; it waits for its player.
			if (!Array.isArray(value) && now - (value?.at || 0) > PRIZE_LIFETIME) await this.ctx.storage.delete(key);
			else left++;
		}
		if (left) await this.ctx.storage.setAlarm(now + CLEANUP_EVERY);
	}

	/** Sockets whose attachment matches. @param {(who: any) => boolean} test */
	sockets(test) {
		return this.ctx.getWebSockets().filter((ws) => {
			const who = ws.deserializeAttachment();
			return who && test(who);
		});
	}

	/** @param {string} code @param {unknown} msg */
	toHosts(code, msg) {
		for (const ws of this.sockets((w) => w.role === 'host' && w.code === code)) send(ws, msg);
	}

	/** @param {string} code @param {string} uuid @param {unknown} msg */
	toPlayer(code, uuid, msg) {
		for (const ws of this.sockets((w) => w.role === 'player' && w.code === code && w.uuid === uuid)) send(ws, msg);
	}

	/**
	 * The child a player's message is from. The socket must have joined this lobby as that id: a
	 * page speaks for its own child only. A child the teacher kicked, or asked for a new name
	 * (until they come back with one), is not playing.
	 * @param {WebSocket} ws @param {any} room @param {unknown} uuid
	 */
	activePlayer(ws, room, uuid) {
		const who = ws.deserializeAttachment();
		if (!isUuid(uuid) || who?.role !== 'player' || who.code !== room.code || who.uuid !== uuid) return undefined;
		return askedToRename(room, uuid) ? undefined : playerOf(room, uuid);
	}

	/** @param {any} room @param {WebSocket} [closing] a socket that is closing and no longer counts */
	playerList(room, closing) {
		const live = new Set(this.sockets((w) => w.role === 'player' && w.code === room.code).filter((ws) => ws !== closing).map((ws) => ws.deserializeAttachment().uuid));
		return Object.values(room.players).map(({ uuid, name, icon, catchCount, damage }) => ({
			uuid, name, icon, catchCount, damage, connected: live.has(uuid), needsRename: askedToRename(room, uuid) || undefined,
		}));
	}

	snapshot(room) {
		if (room.kind === 'raid') return { kind: 'raid', code: room.code, className: room.settings.className || '', players: this.playerList(room), raid: raidState(room), recent: room.recent };
		if (room.kind === 'memory') return { kind: 'memory', code: room.code, className: room.settings.className || '', players: this.playerList(room), memory: memoryState(room), recent: room.recent };
		return { kind: 'bingo', code: room.code, phase: bingoPhase(room), board: room.board, className: room.settings.className || '', players: this.playerList(room), totalCatches: room.totalCatches, locked: Boolean(room.locked) };
	}

	/** @param {string} code @param {unknown} msg */
	toPlayers(code, msg) {
		for (const ws of this.sockets((w) => w.role === 'player' && w.code === code)) send(ws, msg);
	}

	/**
	 * Pay each newly completed row or column once, to every child with a catch, and save the room.
	 * The lines and their prizes are written together (payOut), so a failure cannot pay one twice.
	 * @param {any} room @returns {Promise<{ labels: string[], eligible: number }>}
	 */
	async payLines(room) {
		room.paidLines ??= [];
		const fresh = room.locked ? [] : completedLines(room.board).filter((l) => !room.paidLines.includes(l.key));
		const eligible = Object.values(room.players).filter((p) => p.catchCount > 0);
		if (!fresh.length) {
			await this.saveRoom(room);
			return { labels: [], eligible: eligible.length };
		}
		room.paidLines.push(...fresh.map((l) => l.key));
		const prizes = fresh.map((l) => ({ type: 'coins', amount: LINE_COINS, source: 'line', label: l.label }));
		await this.payOut(room, eligible.map((p) => [p.uuid, prizes]));
		for (const player of eligible) this.toPlayer(room.code, player.uuid, { type: 'bingoReward' });
		return { labels: fresh.map((l) => l.label), eligible: eligible.length };
	}

	/** Tell the host screens which lines just paid out. @param {any} room @param {{ labels: string[], eligible: number }} paid */
	announceLines(room, paid) {
		if (paid.labels.length) this.toHosts(room.code, { type: 'linePrize', lines: paid.labels, amount: LINE_COINS, eligibleCount: paid.eligible });
	}

	/**
	 * Add to children's unclaimed prizes, each prize with an id the game page confirms it by, and
	 * save the room, all in one write. A game's payout and the state that says it was paid
	 * (a line, the lock, the win) therefore stand or fall together: a failure pays nobody, and a
	 * retry pays once. One write holds 128 keys, so a room is paid in batches of 100 children,
	 * and the room goes with the last.
	 * @param {any} room @param {[string, any[]][]} payouts a child's id and the prizes to add
	 */
	async payOut(room, payouts) {
		room.updatedAt = Date.now();
		for (let from = 0; from === 0 || from < payouts.length; from += 100) {
			const batch = payouts.slice(from, from + 100);
			const keys = batch.map(([uuid]) => `prizes:${uuid}`);
			const stored = keys.length ? await this.ctx.storage.get(keys) : new Map();
			/** @type {Record<string, unknown>} */
			const writes = from + 100 >= payouts.length ? { [`room:${room.code}`]: room } : {};
			batch.forEach(([, list], i) => {
				const prizes = [...unwrapPrizes(stored.get(keys[i])), ...list.map((p) => ({ ...p, id: crypto.randomUUID() }))];
				writes[keys[i]] = { at: Date.now(), prizes };
			});
			await this.ctx.storage.put(writes);
		}
		await this.scheduleCleanup();
	}

	/**
	 * End a bingo with the main prize: when the teacher hands it out, or when the board is full.
	 * The server does the second itself, so the prize is paid even if the host page is asleep.
	 * @param {any} room
	 */
	async lockRoom(room) {
		if (room.locked) return;
		room.locked = true;
		const { prize, perPlayer } = computePrize(room);
		const eligible = Object.values(room.players).filter((p) => p.catchCount > 0);
		await this.payOut(room, eligible.map((p) => [p.uuid, perPlayer(p)]));
		for (const player of eligible) this.toPlayer(room.code, player.uuid, { type: 'bingoReward' });
		log('bingo', `rom ${room.code} låst, ${eligible.length} vinnere`);
		this.toHosts(room.code, { type: 'lobbyPrize', prize, eligibleCount: eligible.length });
		this.toPlayers(room.code, { type: 'finished' });
	}

	/**
	 * Store each child's prizes from a finished or ended game and tell them to claim: the boss and
	 * coins from a raid, a Pokémon and coins from memory, the main prize from a bingo. Everyone
	 * with a catch, hit or answer is paid, and the room remembers it, so an End that was cut short
	 * cannot pay twice. @param {any} room
	 */
	async award(room) {
		const players = Object.values(room.players).filter((p) => p.catchCount > 0);
		const prizes =
			room.kind === 'memory' ? (/** @type {any} */ p) => memoryPrizes(room, p) : room.kind === 'raid' ? (/** @type {any} */ p) => raidPrizes(room, p) : computePrize(room).perPlayer;
		room.awarded = true;
		await this.payOut(room, players.map((p) => [p.uuid, prizes(p)]));
		for (const player of players) this.toPlayer(room.code, player.uuid, { type: 'bingoReward' });
		return players.map((p) => p.name);
	}

	async makeCode() {
		const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
		let code;
		do code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
		while (await this.room(code));
		return code;
	}

	/**
	 * The lobby a host message names, once its teacher session checks out.
	 * @param {WebSocket} ws @param {any} msg @param {'bingo' | 'raid' | 'memory'} [kind] only a lobby of this kind
	 */
	async hostRoom(ws, msg, kind) {
		if (!(await sessionTeacher(this.env, msg.teacherSession))) {
			send(ws, BAD_SESSION);
			return null;
		}
		const room = (await this.room(msg.code)) || null;
		return room && (!kind || (room.kind || 'bingo') === kind) ? room : null;
	}
}

/** @type {Record<string, (this: BingoHub, ws: WebSocket, msg: any) => Promise<void>>} */
const HANDLERS = {
	async hostCreateLobby(ws, msg) {
		if (!(await sessionTeacher(this.env, msg.teacherSession))) return send(ws, BAD_SESSION);
		const settings = msg.settings || {};
		const room = {
			code: await this.makeCode(), settings, players: {},
			board: buildBoard(settings.difficulty || 'easy', settings.gridSize), totalCatches: 0, events: [], locked: false, phase: 'lobby',
		};
		await this.saveRoom(room);
		ws.serializeAttachment({ role: 'host', code: room.code });
		log('bingo', `rom ${room.code} opprettet (${room.board.difficulty})`);
		send(ws, { type: 'lobbyCreated', ...this.snapshot(room) });
	},

	async hostJoinLobby(ws, msg) {
		if (!(await sessionTeacher(this.env, msg.teacherSession))) return send(ws, BAD_SESSION);
		const room = await this.room(msg.code);
		if (!room) return send(ws, { type: 'lobbyNotFound', code: msg.code });
		ws.serializeAttachment({ role: 'host', code: room.code });
		const type = room.kind === 'raid' ? 'raidState' : room.kind === 'memory' ? 'memoryState' : 'lobbyState';
		send(ws, { type, ...this.snapshot(room), events: room.events });
	},

	async hostStartBingo(ws, msg) {
		const room = await this.hostRoom(ws, msg, 'bingo');
		if (!room || bingoPhase(room) !== 'lobby') return;
		room.phase = 'play';
		await this.saveRoom(room);
		log('bingo', `rom ${room.code} startet, ${Object.keys(room.players).length} spillere`);
		this.toHosts(room.code, { type: 'bingoStarted' });
		this.toPlayers(room.code, { type: 'bingoUpdate', bingo: { phase: 'play' } });
	},

	async hostMarkCell(ws, msg) {
		const room = await this.hostRoom(ws, msg, 'bingo');
		if (room && bingoPhase(room) !== 'play') return;
		const cell = room?.board.cells.find((c) => c.cellId === msg.cellId);
		if (!cell || cell.free) return;
		cell.marked = Boolean(msg.mark);
		// A line the teacher completes by hand pays too.
		const paid = await this.payLines(room);
		this.toHosts(room.code, { type: 'boardUpdate', board: room.board, totalCatches: room.totalCatches });
		this.announceLines(room, paid);
		if (boardFull(room.board)) await this.lockRoom(room);
	},

	async hostLockLobby(ws, msg) {
		const room = await this.hostRoom(ws, msg, 'bingo');
		if (room && !room.locked) await this.lockRoom(room);
	},

	async hostEndLobby(ws, msg) {
		if (!(await sessionTeacher(this.env, msg.teacherSession))) return send(ws, BAD_SESSION);
		const room = await this.room(msg.code);
		if (room) {
			// A game ended before it was won or locked (a raid before the boss fell, a bingo before the
			// board is full) still pays every child who played.
			if (unfinished(room)) await this.award(room);
			for (const p of this.sockets((w) => w.role === 'player' && w.code === room.code)) send(p, { type: 'ended' });
			await this.ctx.storage.delete(`room:${room.code}`);
			log('bingo', `rom ${room.code} avsluttet`);
		}
		// The host forgets the room only on this, so an End lost on a dropped connection shows. A
		// room that is already gone answers too: ending it twice is the same as ending it once.
		send(ws, { type: 'lobbyEnded', code: room?.code ?? String(msg.code ?? '').toUpperCase().slice(0, 12) });
	},

	// The host's player menu: kick out, ask to rename, or rename directly.
	async hostKickPlayer(ws, msg) {
		const room = await this.hostRoom(ws, msg);
		const player = room && playerOf(room, msg.uuid);
		if (!room || !player) return;
		this.toPlayer(room.code, msg.uuid, { type: 'kicked' });
		delete room.players[msg.uuid];
		// A sleeping iPad misses the message and would join again on waking: remember the kick.
		room.kicked = [...new Set([...(room.kicked || []), msg.uuid])].slice(-MAX_REMEMBERED);
		if (askedToRename(room, msg.uuid)) delete room.renameAsked[msg.uuid];
		await this.saveRoom(room);
		log('bingo', `${player.name} kastet ut av ${room.code}`);
		this.toHosts(room.code, { type: 'playersUpdate', players: this.playerList(room) });
	},

	async hostForceRename(ws, msg) {
		const room = await this.hostRoom(ws, msg);
		const player = room && playerOf(room, msg.uuid);
		if (!room || !player) return;
		this.toPlayer(room.code, msg.uuid, { type: 'forceRename' });
		// The record stays, with its catches, hits and damage: the child comes back to the same game.
		// They may play again only with another name, and the one the teacher gave no longer holds.
		delete player.renamedByHost;
		room.renameAsked = newest({ ...room.renameAsked, [msg.uuid]: player.name }, MAX_REMEMBERED);
		await this.saveRoom(room);
		this.toHosts(room.code, { type: 'playersUpdate', players: this.playerList(room) });
	},

	async hostSetName(ws, msg) {
		const room = await this.hostRoom(ws, msg);
		const player = room && playerOf(room, msg.uuid);
		const name = String(msg.name || '').trim().slice(0, 22);
		if (!room || !player || !name) return;
		player.name = name;
		player.renamedByHost = true;
		// The teacher has given the new name themself, so the child need not pick one.
		if (askedToRename(room, msg.uuid)) delete room.renameAsked[msg.uuid];
		await this.saveRoom(room);
		this.toPlayer(room.code, msg.uuid, { type: 'nameChanged', name });
		this.toHosts(room.code, { type: 'playersUpdate', players: this.playerList(room) });
	},

	async joinLobby(ws, msg) {
		const room = await this.room(msg.code);
		if (!room || room.locked || room.phase === 'won' || !isUuid(msg.uuid)) return send(ws, { type: 'joinResult', ok: false });
		// Kicked, or asked for a new name and still using the old one: tell them again, as the
		// message may have reached a sleeping iPad.
		if (room.kicked?.includes(msg.uuid)) return send(ws, { type: 'kicked' });
		const name = String(msg.name || 'Ash').trim().slice(0, 22) || 'Ash';
		if (askedToRename(room, msg.uuid)) {
			if (room.renameAsked[msg.uuid] === name) return send(ws, { type: 'forceRename' });
			delete room.renameAsked[msg.uuid];
		}
		const existing = playerOf(room, msg.uuid);
		// A full room lets nobody new in; a child who is already in can always come back.
		if (!existing && Object.keys(room.players).length >= MAX_PLAYERS) return send(ws, { type: 'joinResult', ok: false, full: true });
		// A rejoin keeps what the room knows (catches, raid hits); a name the teacher gave wins.
		room.players[msg.uuid] = { ...existing, uuid: msg.uuid, name: existing?.renamedByHost ? existing.name : name, icon: String(msg.icon || '').slice(0, 200), catchCount: existing?.catchCount || 0 };
		await this.saveRoom(room);
		ws.serializeAttachment({ role: 'player', code: room.code, uuid: msg.uuid });
		if (!existing) log('bingo', `${name} ble med i ${room.code}`);
		send(ws, {
			type: 'joinResult', ok: true, kind: room.kind || 'bingo',
			raid: room.kind === 'raid' ? raidState(room) : undefined,
			memory: room.kind === 'memory' ? memoryState(room) : undefined,
			bingo: room.kind ? undefined : { phase: bingoPhase(room) },
		});
		if (existing?.renamedByHost && existing.name !== name) send(ws, { type: 'nameChanged', name: existing.name });
		this.toHosts(room.code, { type: 'playersUpdate', players: this.playerList(room) });
	},

	async catchPokemon(ws, msg) {
		const room = await this.room(msg.code);
		const player = room && this.activePlayer(ws, room, msg.uuid);
		// Children in a raid or memory game catch Pokémon too; only their correct answers count
		// there (answer).
		if (!room || !player || room.locked || (room.kind && room.kind !== 'bingo')) return;
		// Before the start, catches count for nobody: the class is still joining.
		if (bingoPhase(room) !== 'play') return;
		const facts = catchFacts(msg);
		if (!facts) return;

		const minLevel = room.settings.minLevel || 'alle';
		// "tilpasset" is the adaptive level. The settings page offers "only adaptive" and, for a
		// stage minimum, a box to also accept adaptive catches.
		let belowLevel;
		if (minLevel === 'alle') belowLevel = false;
		else if (minLevel === 'tilpasset') belowLevel = facts.difficulty !== 'tilpasset';
		else if (facts.difficulty === 'tilpasset') belowLevel = !room.settings.allowAdaptive;
		else belowLevel = STAGE_ORDER.indexOf(facts.difficulty) < STAGE_ORDER.indexOf(minLevel);
		const now = Date.now();
		const event = { ts: now, uuid: msg.uuid, name: player.name, ...facts, matched: false };
		if (belowLevel) {
			this.toHosts(room.code, { type: 'toastCatch', ...event, belowLevel: true, totalCatches: room.totalCatches });
			return;
		}
		// From here a catch counts for the child, so it must be one a child could have made: not
		// sooner than they can have answered, and not a Pokémon they have already caught in this game.
		player.caught ??= [];
		if (now - (player.lastCatch || 0) < MIN_CATCH_GAP || player.caught.includes(facts.pokemonCode)) return;
		player.lastCatch = now;
		player.caught = [...player.caught, facts.pokemonCode].slice(-MAX_REMEMBERED);

		const matchedCells = room.board.cells.filter((c) => !c.free && !c.marked && matches(c.task.rule, facts));
		for (const cell of matchedCells) {
			cell.marked = true;
			cell.hits += 1;
		}
		event.matched = matchedCells.length > 0;
		player.catchCount += 1;
		room.totalCatches += 1;
		room.events.push(event);
		// The whole lobby is one stored value, so the log keeps only the latest catches.
		if (room.events.length > MAX_EVENTS) room.events.splice(0, room.events.length - MAX_EVENTS);
		const paid = await this.payLines(room);

		const names = matchedCells.map((c) => c.task.name);
		this.toHosts(room.code, { type: 'toastCatch', ...event, totalCatches: room.totalCatches, matchedCells: names, matchedCell: names[0] || null });
		this.toHosts(room.code, { type: 'boardUpdate', board: room.board, totalCatches: room.totalCatches, lastEvent: event });
		this.announceLines(room, paid);
		if (boardFull(room.board)) await this.lockRoom(room);
		this.toHosts(room.code, { type: 'playersUpdate', players: this.playerList(room) });
	},

	// ── Raid ──

	async hostCreateRaid(ws, msg) {
		if (!(await sessionTeacher(this.env, msg.teacherSession))) return send(ws, BAD_SESSION);
		const room = newRaid(msg.settings || {}, await this.makeCode());
		await this.saveRoom(room);
		ws.serializeAttachment({ role: 'host', code: room.code });
		log('raid', `raid ${room.code} opprettet (#${room.bossId})`);
		send(ws, { type: 'raidState', ...this.snapshot(room) });
	},

	async hostStartRaid(ws, msg) {
		const room = await this.hostRoom(ws, msg, 'raid');
		if (!room || room.phase !== 'lobby') return;
		startRaid(room);
		await this.saveRoom(room);
		log('raid', `raid ${room.code} startet, ${room.maxHp} liv`);
		this.toHosts(room.code, { type: 'raidState', ...this.snapshot(room) });
		this.toPlayers(room.code, { type: 'raidUpdate', raid: raidState(room) });
	},

	// Only storage calls may be awaited between reading and saving the room: the object's input
	// gate then keeps two hits from interleaving, so none is lost and the win is awarded once.
	async raidHit(ws, msg) {
		const room = await this.room(msg.code);
		// Pages from before the memory game call every correct answer a raid hit.
		if (room?.kind === 'memory') return HANDLERS.answer.call(this, ws, msg);
		const damage = room?.kind === 'raid' && this.activePlayer(ws, room, msg.uuid) ? hit(room, msg.uuid, Date.now(), msg.value, msg.stage) : 0;
		if (!damage) return;
		const won = room.phase === 'won';
		const winners = won ? await this.award(room) : [];
		await this.saveRoom(room);
		const player = room.players[msg.uuid];
		this.toHosts(room.code, { type: 'raidHit', name: player.name, uuid: player.uuid, damage, raid: raidState(room), players: this.playerList(room) });
		this.toPlayers(room.code, { type: 'raidUpdate', raid: raidState(room) });
		this.toPlayer(room.code, player.uuid, { type: 'raidDamage', damage });
		if (won) {
			log('raid', `raid ${room.code} vunnet av ${winners.length}`);
			this.toHosts(room.code, { type: 'raidWon', raid: raidState(room), winners });
			this.toPlayers(room.code, { type: 'finished' });
		}
	},

	/** A correct answer on a child's game page, in whichever game the code is. */
	async answer(ws, msg) {
		const room = await this.room(msg.code);
		if (room?.kind === 'raid') return HANDLERS.raidHit.call(this, ws, msg);
		if (room?.kind !== 'memory' || !this.activePlayer(ws, room, msg.uuid) || !answer(room, msg.uuid, Date.now())) return;
		await this.saveRoom(room);
		const player = room.players[msg.uuid];
		this.toHosts(room.code, { type: 'memoryAnswer', name: player.name, uuid: player.uuid, memory: memoryState(room), players: this.playerList(room) });
		this.toPlayers(room.code, { type: 'memoryUpdate', memory: memoryState(room) });
	},

	// ── Memory ──

	async hostCreateMemory(ws, msg) {
		if (!(await sessionTeacher(this.env, msg.teacherSession))) return send(ws, BAD_SESSION);
		const room = newMemory(msg.settings || {}, await this.makeCode());
		await this.saveRoom(room);
		ws.serializeAttachment({ role: 'host', code: room.code });
		log('memory', `memory ${room.code} opprettet (${room.cards.length} kort)`);
		send(ws, { type: 'memoryState', ...this.snapshot(room) });
	},

	async hostStartMemory(ws, msg) {
		const room = await this.hostRoom(ws, msg, 'memory');
		if (!room || room.phase !== 'lobby') return;
		startMemory(room);
		await this.saveRoom(room);
		log('memory', `memory ${room.code} startet, ${room.turnCost} svar per trekk`);
		this.toHosts(room.code, { type: 'memoryState', ...this.snapshot(room) });
		this.toPlayers(room.code, { type: 'memoryUpdate', memory: memoryState(room) });
	},

	async hostMemoryFlip(ws, msg) {
		const room = await this.hostRoom(ws, msg, 'memory');
		const result = room && flip(room, msg.index);
		if (!result) return;
		const won = room.phase === 'won';
		const winners = won ? await this.award(room) : [];
		await this.saveRoom(room);
		this.toHosts(room.code, { type: 'memoryFlip', index: Number(msg.index), result, memory: memoryState(room) });
		if (result !== 'first') this.toPlayers(room.code, { type: 'memoryUpdate', memory: memoryState(room) });
		if (won) {
			log('memory', `memory ${room.code} løst av ${winners.length}`);
			this.toHosts(room.code, { type: 'memoryWon', memory: memoryState(room), winners });
			this.toPlayers(room.code, { type: 'finished' });
		}
	},
};
