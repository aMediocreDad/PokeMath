// The player's side of classroom bingo, ported from static/bingo_client_live.js.
// Joins the lobby whose code bingo_join.html stored, reports catches, and claims prizes.
import { generateUUID, getOrCreateUUID } from '#lib/uuid.js';

/** @param {string | null | undefined} s */
const code6 = (s) => String(s || '').toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 6);
/** @param {unknown} value */
const isUuidLike = (value) =>
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));

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

/**
 * A prize from GET /bingo/claim-prizes.
 * @typedef {{ type: string, amount?: number, participationPot?: number, source?: string,
 *   entry?: string, pokedexId?: number, shiny?: boolean, legendary?: boolean,
 *   easterName?: string, easterCoins?: number }} Prize
 */

/**
 * @typedef {object} CatchInfo
 * @property {string} pokemonCode  The stored entry, e.g. "S25" or "N52-2".
 * @property {string} difficulty  "stage1"–"stage5" or "custom".
 * @property {number} pokedexId
 * @property {string | null} pokemonName
 * @property {string[]} types
 * @property {Record<string, boolean>} flags  shiny, mega, gmax, hisuian, alolan, legendary, mythic
 */

/**
 * @param {object} handlers
 * @param {(prizes: Prize[]) => void} handlers.onPrizes  Prizes from a finished game, to give the player.
 * @param {(code: string) => void} handlers.onCodeChange  The lobby code changed ('' when it ended).
 * @param {(message: string, duration: number, position: string) => void} handlers.onAdminPopup
 */
export function startBingo({ onPrizes, onCodeChange, onAdminPopup }) {
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

	async function claimPrizes() {
		const id = await uuid();
		try {
			const r = await fetch('/bingo/claim-prizes?uuid=' + encodeURIComponent(id));
			const d = await r.json();
			if (d.ok && Array.isArray(d.prizes) && d.prizes.length) onPrizes(d.prizes);
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
				if (msg.ok) joinedOk = true;
				else {
					forgetCode();
					ws?.close();
				}
			} else if (msg.type === 'ended' || msg.type === 'lobbyEnded') {
				forgetCode();
				ws?.close();
			} else if (msg.type === 'bingoReward') {
				// Give the server a moment to store the prize before claiming it.
				setTimeout(claimPrizes, 300);
			} else if (msg.type === 'adminPopup') {
				onAdminPopup(msg.message, msg.duration || 5, msg.position);
			} else if (msg.type === 'error') {
				console.warn('[BINGO] Server error:', msg.message || 'unknown');
			}
		});
	}

	if (storedBingoCode()) connect();

	return {
		/** @param {CatchInfo} info */
		async reportCatch(info) {
			const code = storedBingoCode();
			if (!code) return false;
			if (!ws || ws.readyState !== WebSocket.OPEN) {
				connect();
				return false;
			}
			if (code !== joinedCode || !joinedOk) {
				joinedCode = code;
				await join(code);
			}
			if (!info.pokemonCode) return false;
			return send({ type: 'catchPokemon', code, uuid: await uuid(), name: playerName(), ...info });
		},
		stop() {
			stopped = true;
			clearTimeout(reconnectTimer);
			ws?.close();
		}
	};
}
