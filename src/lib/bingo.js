// The player's side of the class games, ported from static/bingo_client_live.js: bingo, the
// raid (worker/raid.js) and memory (worker/memory.js) share one lobby code. Joins the lobby whose
// code bingo_join.html stored, reports catches (bingo) or correct answers (raid, memory), and
// claims prizes.
import { goto } from '$app/navigation';
import { player } from '#lib/player.svelte.js';
import { toast } from '#lib/toast.svelte.js';
import { generateUUID, getOrCreateUUID } from '#lib/uuid.js';

/** @param {string | null | undefined} s */
export const code6 = (s) => String(s || '').toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 6);
/** @param {unknown} value */
export const isUuidLike = (value) =>
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));

/**
 * The lobby code in a join link: ?code=ABC123, or a path ending in the code.
 * @param {URL} url @returns {string} the code, or ''
 */
export function codeFromUrl(url) {
	const query = code6(url.searchParams.get('code'));
	if (query.length === 6) return query;
	const lastPart = url.pathname.split('/').filter(Boolean).at(-1) || '';
	// The page's own name is not a code: "bingo_join.html" would otherwise become "BINGOJ".
	if (lastPart.endsWith('.html')) return '';
	const last = code6(lastPart);
	return last.length === 6 ? last : '';
}

/**
 * The lobby code in a scanned QR code: the teacher's join link (from any address, as a school
 * may show an old one), or the bare code. Never followed as a link. @param {string} text
 */
export function scannedCode(text) {
	const trimmed = text.trim();
	if (/^[0-9A-Z]{6}$/i.test(trimmed)) return trimmed.toUpperCase();
	try {
		return codeFromUrl(new URL(trimmed));
	} catch {
		return '';
	}
}

/** The lobby code, from bingoJoinedCode or the older bingoCode key. */
export function storedBingoCode() {
	const primary = code6(localStorage.getItem('bingoJoinedCode'));
	if (primary.length === 6) return primary;
	const legacy = code6(localStorage.getItem('bingoCode'));
	if (legacy.length === 6) {
		localStorage.setItem('bingoJoinedCode', legacy);
		return legacy;
	}
	return '';
}

function playerName() {
	const name = (localStorage.getItem('username') || localStorage.getItem('playerName') || localStorage.getItem('name') || '').trim();
	return name || 'Ash';
}

/** The ids of prizes already given, part of the save (see claimPrizes). */
const PRIZES_GIVEN = 'bingoPrizesGiven';
/** Held while one tab claims prizes, so a second tab cannot give the same ones (Safari 15.4 and up). */
const PRIZE_LOCK = 'pokemath-bingo-prizes';

/**
 * A prize from GET /bingo/claim-prizes.
 * @typedef {{ id?: string, type: string, amount?: number, participationPot?: number, source?: string,
 *   entry?: string, pokedexId?: number, shiny?: boolean, legendary?: boolean,
 *   easterName?: string, easterCoins?: number, label?: string }} Prize
 */

/**
 * What a prize is remembered by once given: its id, or for one the server gave no id (the first
 * deploy's), everything it says.
 * @param {Prize} prize
 */
const prizeKey = (prize) => prize.id || 'c:' + JSON.stringify(Object.entries(prize).sort(([a], [b]) => (a < b ? -1 : 1)));

/**
 * @typedef {object} CatchInfo
 * @property {string} pokemonCode  The stored entry, e.g. "S25" or "N52-2".
 * @property {string} difficulty  "stage1"–"stage5" or "custom".
 * @property {number} pokedexId
 * @property {string | null} pokemonName
 * @property {string[]} types
 * @property {Record<string, boolean>} flags  shiny, mega, gmax, hisuian, alolan, legendary, mythic
 */

/** @typedef {{ phase: 'lobby' | 'fight' | 'won', hp: number, maxHp: number, bossId: number }} RaidState */
/** @typedef {{ phase: 'lobby' | 'play' }} BingoState */
/**
 * A face-down card has no id. `pool` answers of `turnCost` fill the meter towards the next turn.
 * @typedef {{ phase: 'lobby' | 'play' | 'won', size: string, cards: { id: number | null, matched: boolean }[], open: number[],
 *   pool: number, turnCost: number, turns: number, found: number, pairs: number }} MemoryState
 */
/** @typedef {{ kind: 'bingo', state: BingoState } | { kind: 'raid', state: RaidState } | { kind: 'memory', state: MemoryState }} ClassGame */

/**
 * @param {object} handlers
 * @param {(prizes: Prize[]) => void} handlers.onPrizes  Prizes from a finished game, to give the player.
 * @param {(code: string) => void} handlers.onCodeChange  The lobby code changed ('' when it ended).
 * @param {(message: string, duration: number, position: string) => void} [handlers.onAdminPopup]
 *   Never called: the server has no adminPopup message. Only the game page still passes it.
 * @param {(game: ClassGame) => void} [handlers.onGame]
 *   The lobby was joined, or the game moved on (started, hit, won).
 * @param {(damage: number) => void} [handlers.onDamage]  This child's answer hit the raid boss for this much.
 */
export function startBingo({ onPrizes, onCodeChange, onGame, onDamage }) {
	const url = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;
	/** @type {WebSocket | null} */
	let ws = null;
	/** @type {string | null} */
	let joinedCode = null;
	let joinedOk = false;
	let connecting = false;
	let stopped = false;
	/** @type {ReturnType<typeof setTimeout> | undefined} */
	let reconnectTimer;
	/** @type {string | null} */
	let cachedUUID = null;

	/** @returns {Promise<string>} */
	async function uuid() {
		if (cachedUUID) return cachedUUID;
		const result = await getOrCreateUUID();
		if (result && isUuidLike(result.uuid)) return (cachedUUID = result.uuid);
		for (const candidate of [localStorage.getItem('uuid'), localStorage.getItem('user_uuid'), localStorage.getItem('pokemath_uuid')]) {
			if (isUuidLike(candidate)) {
				localStorage.setItem('uuid', /** @type {string} */ (candidate));
				return (cachedUUID = /** @type {string} */ (candidate));
			}
		}
		// crypto.randomUUID() needs iOS 15.4; school iPads can be older.
		const fresh = generateUUID();
		localStorage.setItem('uuid', fresh);
		return (cachedUUID = fresh);
	}

	/** @param {object} message */
	function send(message) {
		if (!ws || ws.readyState !== WebSocket.OPEN) return false;
		ws.send(JSON.stringify(message));
		return true;
	}

	/** @param {string} code */
	async function join(code) {
		if (!ws || ws.readyState !== WebSocket.OPEN) return false;
		const id = await uuid();
		const icon = (localStorage.getItem('playerIcon') || '').replace(/^"|"$/g, '').trim();
		return send({ type: 'joinLobby', code: code6(code), uuid: id, name: playerName(), icon });
	}

	/** @type {Promise<void>} */
	let claiming = Promise.resolve();
	function claimPrizes() {
		// One claim at a time: a second one waits, then asks for whatever is left.
		return (claiming = claiming.then(claimOnce).catch((e) => console.error('[BINGO] claimBingoPrizes failed', e)));
	}

	/**
	 * Give the prizes waiting on the server, then confirm them so the server drops them. The ids
	 * given are kept in the save too, so a confirm lost on bad wifi never pays a prize twice.
	 * Open in two tabs, only one claims at a time: the other then finds nothing left, or the
	 * prizes already given.
	 */
	function claimOnce() {
		return navigator.locks?.request ? navigator.locks.request(PRIZE_LOCK, claimLocked) : claimLocked();
	}

	async function claimLocked() {
		const id = await uuid();
		const url = '/bingo/claim-prizes?uuid=' + encodeURIComponent(id);
		try {
			const d = await (await fetch(url)).json();
			if (!d.ok || !Array.isArray(d.prizes) || !d.prizes.length) return;
			/** @type {string[]} */
			let given = [];
			try {
				given = JSON.parse(localStorage.getItem(PRIZES_GIVEN) || '[]');
			} catch {
				// A broken list: the server's copy decides.
			}
			const fresh = d.prizes.filter((/** @type {Prize} */ p) => !given.includes(prizeKey(p)));
			if (fresh.length) {
				localStorage.setItem(PRIZES_GIVEN, JSON.stringify([...given, ...fresh.map(prizeKey)].slice(-200)));
				onPrizes(fresh);
			}
			const ids = d.prizes.map((/** @type {Prize} */ p) => p.id).filter(Boolean);
			await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
		} catch (e) {
			console.error('[BINGO] claimBingoPrizes failed', e);
		}
	}

	function forgetCode() {
		localStorage.removeItem('bingoJoinedCode');
		localStorage.removeItem('bingoCode');
		joinedCode = null;
		joinedOk = false;
		onCodeChange('');
	}

	function connect() {
		if (stopped || connecting) return;
		if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
		connecting = true;
		joinedOk = false;
		ws = new WebSocket(url);

		ws.addEventListener('open', async () => {
			connecting = false;
			const code = storedBingoCode();
			if (code) {
				joinedCode = code;
				await join(code);
			}
			claimPrizes();
		});
		ws.addEventListener('close', () => {
			connecting = false;
			joinedOk = false;
			if (!stopped && storedBingoCode()) reconnectTimer = setTimeout(connect, 1500);
		});
		ws.addEventListener('error', () => (connecting = false));
		ws.addEventListener('message', (event) => {
			let msg;
			try {
				msg = JSON.parse(event.data);
			} catch {
				return;
			}
			if (msg.type === 'joinResult') {
				if (msg.ok) {
					joinedOk = true;
					if (msg.kind === 'raid') onGame?.({ kind: 'raid', state: msg.raid });
					else if (msg.kind === 'memory') onGame?.({ kind: 'memory', state: msg.memory });
					else onGame?.({ kind: 'bingo', state: msg.bingo ?? { phase: 'play' } });
				} else {
					forgetCode();
					ws?.close();
				}
			} else if (msg.type === 'ended' || msg.type === 'lobbyEnded') {
				forgetCode();
				ws?.close();
			} else if (msg.type === 'raidUpdate') {
				onGame?.({ kind: 'raid', state: msg.raid });
			} else if (msg.type === 'raidDamage') {
				onDamage?.(msg.damage);
			} else if (msg.type === 'memoryUpdate') {
				onGame?.({ kind: 'memory', state: msg.memory });
			} else if (msg.type === 'bingoUpdate') {
				onGame?.({ kind: 'bingo', state: msg.bingo });
			} else if (msg.type === 'finished') {
				// The bingo locked, the boss fell or the board is solved: take the prizes, then leave,
				// so the page stops showing a game that is over. The teacher's screen keeps it until
				// they end it.
				setTimeout(async () => {
					await claimPrizes();
					// Forget first, or the socket's close would reconnect to the old code.
					forgetCode();
					ws?.close();
				}, 300);
			} else if (msg.type === 'bingoReward') {
				// Give the server a moment to store the prize before claiming it.
				setTimeout(claimPrizes, 300);
			} else if (msg.type === 'kicked' || msg.type === 'forceRename') {
				// The teacher removed the player, or asked for a new name (live bingo_client_live.js, 2026-10).
				forgetCode();
				ws?.close();
				const kicked = msg.type === 'kicked';
				toast(kicked ? 'Du ble kastet ut av bingo-sesjonen av læreren.' : 'Læreren har bedt deg endre navn. Gå til profilen din for å oppdatere det.', { bad: true });
				goto(kicked ? '/' : '/player_profile.html');
			} else if (msg.type === 'nameChanged') {
				localStorage.setItem('username', msg.name);
				player.username = msg.name;
			} else if (msg.type === 'error') {
				console.warn('[BINGO] Server error:', msg.message || 'unknown');
			}
		});
	}

	if (storedBingoCode()) connect();
	// Prizes left from a game whose answer got lost: the code is forgotten when a game ends, so
	// without this nothing would ask for them until the next game.
	else claimPrizes();

	/** Join first when the socket reconnected or the code changed. @returns {Promise<string>} the code, or '' */
	async function ready() {
		const code = storedBingoCode();
		if (!code) return '';
		if (!ws || ws.readyState !== WebSocket.OPEN) {
			connect();
			return '';
		}
		if (code !== joinedCode || !joinedOk) {
			joinedCode = code;
			await join(code);
		}
		return code;
	}

	return {
		/** @param {CatchInfo} info */
		async reportCatch(info) {
			const code = await ready();
			if (!code || !info.pokemonCode) return false;
			return send({ type: 'catchPokemon', code, uuid: await uuid(), name: playerName(), ...info });
		},
		/**
		 * A correct answer: a hit on the raid boss, as hard as the answer on its level, or towards
		 * memory's next turn. Bingo ignores it.
		 * @param {number} value the answer @param {string | number} stage the level
		 */
		async reportHit(value, stage) {
			const code = await ready();
			return code ? send({ type: 'answer', code, uuid: await uuid(), value, stage: Number(stage) }) : false;
		},
		stop() {
			stopped = true;
			clearTimeout(reconnectTimer);
			ws?.close();
		}
	};
}
