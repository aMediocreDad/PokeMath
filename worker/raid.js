// Classroom raid: the class works together to beat one big Pokémon. Every correct answer on a
// child's game page is one hit; when the boss's health reaches zero, everyone who hit it catches
// it. The raid lives in the bingo Durable Object (worker/bingo.js) as a room of kind "raid", so it
// shares the lobby codes, the join page, the player socket and the prize claim with bingo.
//
// Phases: "lobby" (children join, hits do nothing), "fight" (started by the teacher, health set
// from the number of children), "won". A child's hits are kept as catchCount, the field bingo's
// player list already shows.

import { HITS_PER_CHILD, RAID_BOSSES } from '../src/lib/raidConfig.js';

/** A child's hits closer together than this are dropped: nobody answers that fast. */
const MIN_HIT_GAP = 1000;
const RECENT = 20;
const SHINY_CHANCE = 0.1;

/** @param {any} room */
export function raidState(room) {
	return { phase: room.phase, hp: room.hp, maxHp: room.maxHp, bossId: room.bossId, length: room.settings.length };
}

/** @param {{ boss?: unknown, length?: unknown, className?: unknown }} settings @param {string} code */
export function newRaid(settings, code) {
	const boss = Number(settings.boss);
	const length = Object.hasOwn(HITS_PER_CHILD, String(settings.length)) ? String(settings.length) : 'medium';
	return {
		kind: 'raid',
		code,
		settings: { className: String(settings.className || '').slice(0, 40), length },
		bossId: RAID_BOSSES.includes(boss) ? boss : RAID_BOSSES[Math.floor(Math.random() * RAID_BOSSES.length)],
		phase: 'lobby',
		hp: 0,
		maxHp: 0,
		players: {},
		recent: [],
		events: [],
		totalCatches: 0,
	};
}

/** Health for the children in the lobby; at least one child's share, so one tester can win. @param {any} room */
export function startRaid(room) {
	const children = Math.max(1, Object.keys(room.players).length);
	room.maxHp = room.hp = children * HITS_PER_CHILD[/** @type {keyof typeof HITS_PER_CHILD} */ (room.settings.length)];
	room.phase = 'fight';
}

/**
 * One correct answer. Returns false when it does not count (wrong phase, unknown child, too fast).
 * @param {any} room @param {string} uuid @param {number} now
 */
export function hit(room, uuid, now) {
	const player = room.players[uuid];
	if (room.phase !== 'fight' || !player || now - (player.lastHit || 0) < MIN_HIT_GAP) return false;
	player.lastHit = now;
	player.catchCount += 1;
	room.totalCatches += 1;
	room.hp = Math.max(0, room.hp - 1);
	room.recent.push({ name: player.name, at: now });
	if (room.recent.length > RECENT) room.recent.splice(0, room.recent.length - RECENT);
	if (room.hp === 0) room.phase = 'won';
	return true;
}

/** What a child gets: the boss when it was beaten, and coins for every hit either way. @param {any} room @param {any} player */
export function raidPrizes(room, player) {
	const coins = { type: 'coins', amount: 25 * player.catchCount + (room.phase === 'won' ? 1000 : 0), source: 'raid' };
	if (room.phase !== 'won') return [coins];
	const shiny = Math.random() < SHINY_CHANCE;
	return [{ type: 'pokemon', pokedexId: room.bossId, entry: `${shiny ? 'S' : 'N'}${room.bossId}`, shiny, legendary: true, source: 'raid' }, coins];
}
