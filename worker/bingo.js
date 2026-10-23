// Classroom bingo, ported from dev/bingo.js: the /ws WebSocket used by the teacher's host page
// and the players' game page, plus /bingo/claim-prizes. The class raid (worker/raid.js) runs
// in the same object as a room of kind "raid"; bingo-only handlers ignore raid rooms.
//
// One Durable Object holds every lobby. The client names its lobby only in messages sent after
// the socket opens, so the Worker cannot pick a lobby's object when the socket connects; at
// family scale one object is plenty. Sockets hibernate between messages, so each socket's role
// lives in its attachment and each lobby in the object's storage.
import { DurableObject } from 'cloudflare:workers';
import bingoTasks from '../static/bingo-tasks.js';
import { log } from './http.js';
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
function computePrize(room) {
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
			const pot = 2000 * players.length + 50 * room.totalCatches;
			const share = Math.round(pot / Math.max(1, eligible.length));
			return { prize: { type: 'participation_coins', pot }, perPlayer: () => [{ type: 'coins', amount: share, participationPot: pot }] };
		}
		case 'per_catch_coins':
			return { prize: { type: 'per_catch_coins' }, perPlayer: (p) => [{ type: 'coins', amount: 50 * p.catchCount }] };
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
			// The game page reads the prizes with keep=1, gives them, then confirms their ids with a
			// POST, so an answer lost on bad wifi cannot lose a prize. A page from before that gets
			// them deleted as it reads them.
			const key = `prizes:${url.searchParams.get('uuid') || ''}`;
			const stored = await this.ctx.storage.get(key);
			const at = Array.isArray(stored) ? Date.now() : stored?.at;
			let prizes = unwrapPrizes(stored);
			if (request.method === 'POST') {
				const ids = new Set((await request.json().catch(() => null))?.ids || []);
				prizes = prizes.filter((p) => !ids.has(p.id));
				if (prizes.length) await this.ctx.storage.put(key, { at, prizes });
				else await this.ctx.storage.delete(key);
				return Response.json({ ok: true });
			}
			if (url.searchParams.get('keep') === '1') {
				if (prizes.some((p) => !p.id)) {
					prizes = prizes.map((p) => (p.id ? p : { ...p, id: crypto.randomUUID() }));
					await this.ctx.storage.put(key, { at, prizes });
				}
				return Response.json({ ok: true, prizes });
			}
			await this.ctx.storage.delete(key);
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
	async webSocketClose(ws) {
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
				// A raid left mid-fight (the teacher closed the lid) still pays every child for their hits.
				if (room.kind === 'raid' && room.phase === 'fight') await this.awardRaid(room);
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

	/** @param {any} room @param {WebSocket} [closing] a socket that is closing and no longer counts */
	playerList(room, closing) {
		const live = new Set(this.sockets((w) => w.role === 'player' && w.code === room.code).filter((ws) => ws !== closing).map((ws) => ws.deserializeAttachment().uuid));
		return Object.values(room.players).map(({ uuid, name, icon, catchCount }) => ({ uuid, name, icon, catchCount, connected: live.has(uuid) }));
	}

	snapshot(room) {
		if (room.kind === 'raid') return { kind: 'raid', code: room.code, className: room.settings.className || '', players: this.playerList(room), raid: raidState(room), recent: room.recent };
		return { kind: 'bingo', code: room.code, board: room.board, className: room.settings.className || '', players: this.playerList(room), totalCatches: room.totalCatches, locked: Boolean(room.locked) };
	}

	/** @param {string} code @param {unknown} msg */
	toPlayers(code, msg) {
		for (const ws of this.sockets((w) => w.role === 'player' && w.code === code)) send(ws, msg);
	}

	/**
	 * Pay each newly completed row or column once, to every child with a catch. Only storage calls
	 * are awaited, so a catch arriving meanwhile cannot pay the same line twice.
	 * @param {any} room @returns {Promise<{ labels: string[], eligible: number }>}
	 */
	async payLines(room) {
		room.paidLines ??= [];
		const fresh = room.locked ? [] : completedLines(room.board).filter((l) => !room.paidLines.includes(l.key));
		const eligible = Object.values(room.players).filter((p) => p.catchCount > 0);
		if (!fresh.length) return { labels: [], eligible: eligible.length };
		room.paidLines.push(...fresh.map((l) => l.key));
		for (const player of eligible) {
			await this.addPrizes(player.uuid, fresh.map((l) => ({ type: 'coins', amount: LINE_COINS, source: 'line', label: l.label })));
			this.toPlayer(room.code, player.uuid, { type: 'bingoReward' });
		}
		return { labels: fresh.map((l) => l.label), eligible: eligible.length };
	}

	/** Tell the host screens which lines just paid out. @param {any} room @param {{ labels: string[], eligible: number }} paid */
	announceLines(room, paid) {
		if (paid.labels.length) this.toHosts(room.code, { type: 'linePrize', lines: paid.labels, amount: LINE_COINS, eligibleCount: paid.eligible });
	}

	/** Add to a child's unclaimed prizes, each with an id the game page confirms it by. @param {string} uuid @param {any[]} list */
	async addPrizes(uuid, list) {
		const key = `prizes:${uuid}`;
		const prizes = [...unwrapPrizes(await this.ctx.storage.get(key)), ...list.map((p) => ({ ...p, id: crypto.randomUUID() }))];
		await this.ctx.storage.put(key, { at: Date.now(), prizes });
	}

	/** Store each child's prizes from a finished raid and tell them to claim. @param {any} room */
	async awardRaid(room) {
		const players = Object.values(room.players).filter((p) => p.catchCount > 0);
		for (const player of players) {
			await this.addPrizes(player.uuid, raidPrizes(room, player));
			this.toPlayer(room.code, player.uuid, { type: 'bingoReward' });
		}
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
	 * @param {WebSocket} ws @param {any} msg @param {'bingo' | 'raid'} [kind] only a lobby of this kind
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
			board: buildBoard(settings.difficulty || 'easy', settings.gridSize), totalCatches: 0, events: [], locked: false,
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
		send(ws, { type: room.kind === 'raid' ? 'raidState' : 'lobbyState', ...this.snapshot(room), events: room.events });
	},

	async hostMarkCell(ws, msg) {
		const room = await this.hostRoom(ws, msg, 'bingo');
		const cell = room?.board.cells.find((c) => c.cellId === msg.cellId);
		if (!cell || cell.free) return;
		cell.marked = Boolean(msg.mark);
		// A line the teacher completes by hand pays too.
		const paid = await this.payLines(room);
		await this.saveRoom(room);
		this.toHosts(room.code, { type: 'boardUpdate', board: room.board, totalCatches: room.totalCatches });
		this.announceLines(room, paid);
	},

	async hostLockLobby(ws, msg) {
		const room = await this.hostRoom(ws, msg, 'bingo');
		if (!room || room.locked) return;
		room.locked = true;
		const { prize, perPlayer } = computePrize(room);
		const eligible = Object.values(room.players).filter((p) => p.catchCount > 0);
		for (const player of eligible) {
			await this.addPrizes(player.uuid, perPlayer(player));
			this.toPlayer(room.code, player.uuid, { type: 'bingoReward' });
		}
		await this.saveRoom(room);
		log('bingo', `rom ${room.code} låst, ${eligible.length} vinnere`);
		this.toHosts(room.code, { type: 'lobbyPrize', prize, eligibleCount: eligible.length });
	},

	async hostEndLobby(ws, msg) {
		const room = await this.hostRoom(ws, msg);
		if (!room) return;
		// A raid ended before the boss fell still pays every child for their hits.
		if (room.kind === 'raid' && room.phase === 'fight') await this.awardRaid(room);
		for (const p of this.sockets((w) => w.role === 'player' && w.code === room.code)) send(p, { type: 'ended' });
		await this.ctx.storage.delete(`room:${room.code}`);
		// The host forgets the room only on this, so an End lost on a dropped connection shows.
		send(ws, { type: 'lobbyEnded', code: room.code });
		log('bingo', `rom ${room.code} avsluttet`);
	},

	// The host's player menu: kick out, ask to rename, or rename directly.
	async hostKickPlayer(ws, msg) {
		const room = await this.hostRoom(ws, msg);
		const player = room?.players[msg.uuid];
		if (!player) return;
		this.toPlayer(room.code, msg.uuid, { type: 'kicked' });
		delete room.players[msg.uuid];
		// A sleeping iPad misses the message and would join again on waking: remember the kick.
		room.kicked = [...(room.kicked || []), msg.uuid];
		await this.saveRoom(room);
		log('bingo', `${player.name} kastet ut av ${room.code}`);
		this.toHosts(room.code, { type: 'playersUpdate', players: this.playerList(room) });
	},

	async hostForceRename(ws, msg) {
		const room = await this.hostRoom(ws, msg);
		const player = room?.players[msg.uuid];
		if (!player) return;
		this.toPlayer(room.code, msg.uuid, { type: 'forceRename' });
		delete room.players[msg.uuid];
		// The player may join again only with another name.
		room.renameAsked = { ...room.renameAsked, [msg.uuid]: player.name };
		await this.saveRoom(room);
		this.toHosts(room.code, { type: 'playersUpdate', players: this.playerList(room) });
	},

	async hostSetName(ws, msg) {
		const room = await this.hostRoom(ws, msg);
		const player = room?.players[msg.uuid];
		const name = String(msg.name || '').trim().slice(0, 22);
		if (!player || !name) return;
		player.name = name;
		player.renamedByHost = true;
		await this.saveRoom(room);
		this.toPlayer(room.code, msg.uuid, { type: 'nameChanged', name });
		this.toHosts(room.code, { type: 'playersUpdate', players: this.playerList(room) });
	},

	async joinLobby(ws, msg) {
		const room = await this.room(msg.code);
		if (!room || room.locked || room.phase === 'won' || !msg.uuid) return send(ws, { type: 'joinResult', ok: false });
		// Kicked, or asked for a new name and still using the old one: tell them again, as the
		// message may have reached a sleeping iPad.
		if (room.kicked?.includes(msg.uuid)) return send(ws, { type: 'kicked' });
		const name = String(msg.name || 'Ash').trim().slice(0, 22) || 'Ash';
		if (room.renameAsked && msg.uuid in room.renameAsked) {
			if (room.renameAsked[msg.uuid] === name) return send(ws, { type: 'forceRename' });
			delete room.renameAsked[msg.uuid];
		}
		const existing = room.players[msg.uuid];
		// A rejoin keeps what the room knows (catches, raid hits); a name the teacher gave wins.
		room.players[msg.uuid] = { ...existing, uuid: msg.uuid, name: existing?.renamedByHost ? existing.name : name, icon: String(msg.icon || '').slice(0, 200), catchCount: existing?.catchCount || 0 };
		await this.saveRoom(room);
		ws.serializeAttachment({ role: 'player', code: room.code, uuid: msg.uuid });
		if (!existing) log('bingo', `${name} ble med i ${room.code}`);
		send(ws, { type: 'joinResult', ok: true, kind: room.kind || 'bingo', raid: room.kind === 'raid' ? raidState(room) : undefined });
		if (existing?.renamedByHost && existing.name !== name) send(ws, { type: 'nameChanged', name: existing.name });
		this.toHosts(room.code, { type: 'playersUpdate', players: this.playerList(room) });
	},

	async catchPokemon(_ws, msg) {
		const room = await this.room(msg.code);
		const player = room?.players[msg.uuid];
		// Children in a raid catch Pokémon too; only their correct answers count there (raidHit).
		if (!room || !player || room.locked || room.kind === 'raid') return;

		const minLevel = room.settings.minLevel || 'alle';
		// "tilpasset" is the adaptive level. The settings page offers "only adaptive" and, for a
		// stage minimum, a box to also accept adaptive catches.
		let belowLevel;
		if (minLevel === 'alle') belowLevel = false;
		else if (minLevel === 'tilpasset') belowLevel = msg.difficulty !== 'tilpasset';
		else if (msg.difficulty === 'tilpasset') belowLevel = !room.settings.allowAdaptive;
		else belowLevel = STAGE_ORDER.indexOf(msg.difficulty) < STAGE_ORDER.indexOf(minLevel);
		const event = {
			ts: Date.now(), uuid: msg.uuid, name: player.name, pokemonCode: msg.pokemonCode, pokedexId: msg.pokedexId,
			pokemonName: msg.pokemonName, difficulty: msg.difficulty, types: msg.types, flags: msg.flags, matched: false,
		};
		if (belowLevel) {
			this.toHosts(room.code, { type: 'toastCatch', ...event, belowLevel: true, totalCatches: room.totalCatches });
			return;
		}

		const matchedCells = room.board.cells.filter((c) => !c.free && !c.marked && matches(c.task.rule, msg));
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
		await this.saveRoom(room);

		const names = matchedCells.map((c) => c.task.name);
		this.toHosts(room.code, { type: 'toastCatch', ...event, totalCatches: room.totalCatches, matchedCells: names, matchedCell: names[0] || null });
		this.toHosts(room.code, { type: 'boardUpdate', board: room.board, totalCatches: room.totalCatches, lastEvent: event });
		this.announceLines(room, paid);
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
	async raidHit(_ws, msg) {
		const room = await this.room(msg.code);
		if (room?.kind !== 'raid' || !hit(room, msg.uuid, Date.now())) return;
		const won = room.phase === 'won';
		const winners = won ? await this.awardRaid(room) : [];
		await this.saveRoom(room);
		const player = room.players[msg.uuid];
		this.toHosts(room.code, { type: 'raidHit', name: player.name, uuid: player.uuid, raid: raidState(room), players: this.playerList(room) });
		this.toPlayers(room.code, { type: 'raidUpdate', raid: raidState(room) });
		if (won) {
			log('raid', `raid ${room.code} vunnet av ${winners.length}`);
			this.toHosts(room.code, { type: 'raidWon', raid: raidState(room), winners });
		}
	},
};
