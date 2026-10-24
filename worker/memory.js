// Classroom memory: pairs of face-down Pokémon on the teacher's screen. Every correct answer on a
// child's game page fills the class's meter; a full meter is one turn, and on a turn the teacher
// turns over the two cards the class calls out. When every pair is found, everyone who answered
// catches one of the board's Pokémon. Like the raid (worker/raid.js), it lives in the bingo
// Durable Object as a room of its own kind, "memory".
//
// Phases: "lobby" (children join, answers do nothing), "play" (started by the teacher; a turn
// costs one answer per child), "won". A child's answers are kept as catchCount, the field the
// player lists already show.

import { CARDS, MAX_TURNS } from '../src/lib/memoryConfig.js';
import { MAX_PAID_ANSWERS, paidCount, playerOf } from './players.js';

/** A child's answers closer together than this are dropped: nobody answers that fast. */
const MIN_ANSWER_GAP = 1000;
const RECENT = 20;
const SHINY_CHANCE = 0.1;
const LAST_POKEMON = 1025;

/**
 * What the screens show. A face-down card's Pokémon is left out, so no screen can peek.
 * @param {any} room
 */
export function memoryState(room) {
	return {
		phase: room.phase,
		size: room.settings.size,
		cards: room.cards.map((/** @type {any} */ c, /** @type {number} */ i) => ({ id: c.matched || room.open.includes(i) ? c.id : null, matched: c.matched })),
		open: room.open,
		pool: room.pool,
		turnCost: room.turnCost,
		turns: room.turns,
		found: room.found.length,
		pairs: room.cards.length / 2,
	};
}

/** @param {{ size?: unknown, className?: unknown }} settings @param {string} code */
export function newMemory(settings, code) {
	const size = Object.hasOwn(CARDS, String(settings.size)) ? String(settings.size) : 'medium';
	const pairs = CARDS[/** @type {keyof typeof CARDS} */ (size)] / 2;
	const ids = new Set();
	while (ids.size < pairs) ids.add(1 + Math.floor(Math.random() * LAST_POKEMON));
	const cards = [...ids, ...ids].map((id) => ({ id, matched: false }));
	// Fisher–Yates, so every layout is as likely.
	for (let i = cards.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[cards[i], cards[j]] = [cards[j], cards[i]];
	}
	return {
		kind: 'memory',
		code,
		settings: { className: String(settings.className || '').slice(0, 40), size },
		phase: 'lobby',
		cards,
		open: [],
		found: [],
		pool: 0,
		turnCost: 0,
		turns: 0,
		players: {},
		recent: [],
		events: [],
		totalCatches: 0,
	};
}

/** A turn costs one answer per child in the lobby, and the class starts with one turn. @param {any} room */
export function startMemory(room) {
	room.turnCost = Math.max(2, Object.keys(room.players).length);
	room.turns = 1;
	room.phase = 'play';
}

/**
 * One correct answer. Returns false when it does not count (wrong phase, unknown child, too fast).
 * @param {any} room @param {string} uuid @param {number} now
 */
export function answer(room, uuid, now) {
	const player = playerOf(room, uuid);
	if (room.phase !== 'play' || !player || now - (player.lastHit || 0) < MIN_ANSWER_GAP) return false;
	player.lastHit = now;
	player.catchCount += 1;
	room.totalCatches += 1;
	// With a full store of turns the meter waits; the answer still earns coins.
	if (room.turns < MAX_TURNS) {
		room.pool += 1;
		if (room.pool >= room.turnCost) {
			room.pool = 0;
			room.turns += 1;
		}
	}
	room.recent.push({ name: player.name, at: now });
	if (room.recent.length > RECENT) room.recent.splice(0, room.recent.length - RECENT);
	return true;
}

/**
 * The teacher turns a card over. The first card of a turn needs a turn in store; the second
 * spends it. Two cards left open from a miss turn back over first.
 * @param {any} room @param {unknown} index
 * @returns {'first' | 'match' | 'miss' | null} null when the flip is not allowed
 */
export function flip(room, index) {
	const i = Number(index);
	const card = room.cards[i];
	if (room.phase !== 'play' || !card || card.matched || !Number.isInteger(i)) return null;
	if (room.open.length === 2) room.open = [];
	if (room.open.includes(i)) return null;
	if (!room.open.length) {
		if (room.turns < 1) return null;
		room.open = [i];
		return 'first';
	}
	room.open.push(i);
	room.turns -= 1;
	const [a, b] = room.open.map((/** @type {number} */ k) => room.cards[k]);
	if (a.id !== b.id) return 'miss';
	a.matched = b.matched = true;
	room.found.push(a.id);
	room.open = [];
	if (room.cards.every((/** @type {any} */ c) => c.matched)) room.phase = 'won';
	return 'match';
}

/**
 * What a child gets: one Pokémon from the pairs the class found, and coins for every answer (up to
 * what a child can play, MAX_PAID_ANSWERS). An unfinished board pays the Pokémon too, if a pair
 * was found.
 * @param {any} room @param {any} player
 */
export function memoryPrizes(room, player) {
	const coins = { type: 'coins', amount: 25 * paidCount(player.catchCount, MAX_PAID_ANSWERS) + (room.phase === 'won' ? 1000 : 0), source: 'memory' };
	if (!room.found.length) return [coins];
	const id = room.found[Math.floor(Math.random() * room.found.length)];
	const shiny = Math.random() < SHINY_CHANCE;
	return [{ type: 'pokemon', pokedexId: id, entry: `${shiny ? 'S' : 'N'}${id}`, shiny, legendary: false, source: 'memory' }, coins];
}
