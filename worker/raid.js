// Classroom raid: the class works together to beat one big Pokémon. Every correct answer on a
// child's game page is a hit for the answer itself, scaled to the child's level (damageFor in
// src/lib/raidConfig.js); when the boss's HP reaches zero, everyone who hit it catches it. The raid lives in the bingo Durable Object (worker/bingo.js) as a room of kind "raid", so it
// shares the lobby codes, the join page, the player socket and the prize claim with bingo.
//
// Phases: "lobby" (children join, hits do nothing), "fight" (started by the teacher, HP set from
// the boss's base HP and the number of children), "won". A child's hits are kept as catchCount,
// the field bingo's player list already shows, and the damage they did as damage.

import { HP_PER_CHILD, RAID_BOSSES, damageFor, raidHp } from '../src/lib/raidConfig.js';
import { MAX_PAID_ANSWERS, paidCount, playerOf } from './players.js';

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
	const length = Object.hasOwn(HP_PER_CHILD, String(settings.length)) ? String(settings.length) : 'medium';
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

/** HP for the children in the lobby; at least one child's share, so one tester can win. @param {any} room */
export function startRaid(room) {
	room.maxHp = room.hp = raidHp(room.bossId, Object.keys(room.players).length, room.settings.length);
	room.phase = 'fight';
}

/**
 * One correct answer, and the level it was given on. Returns the damage done, or 0 when it does
 * not count (wrong phase, unknown child, too fast).
 * @param {any} room @param {string} uuid @param {number} now @param {unknown} [value] @param {unknown} [stage]
 */
export function hit(room, uuid, now, value, stage) {
	const player = playerOf(room, uuid);
	if (room.phase !== 'fight' || !player || now - (player.lastHit || 0) < MIN_HIT_GAP) return 0;
	// The answer and its level come from the child's page, so a made-up one cannot do more than
	// damageFor allows: the level is clamped to 1-5 and one hit to MAX_HIT.
	const damage = Math.min(room.hp, damageFor(value, stage));
	player.lastHit = now;
	player.catchCount += 1;
	player.damage = (player.damage || 0) + damage;
	room.totalCatches += 1;
	room.hp -= damage;
	room.recent.push({ name: player.name, damage, at: now });
	if (room.recent.length > RECENT) room.recent.splice(0, room.recent.length - RECENT);
	if (room.hp === 0) room.phase = 'won';
	// At least 1: damageFor never says less, and a boss still fighting has HP left.
	return damage;
}

/**
 * What a child gets: the boss when it was beaten, and coins for every hit either way (up to what a
 * child can play, MAX_PAID_ANSWERS). @param {any} room @param {any} player
 */
export function raidPrizes(room, player) {
	const coins = { type: 'coins', amount: 25 * paidCount(player.catchCount, MAX_PAID_ANSWERS) + (room.phase === 'won' ? 1000 : 0), source: 'raid' };
	if (room.phase !== 'won') return [coins];
	const shiny = Math.random() < SHINY_CHANCE;
	return [{ type: 'pokemon', pokedexId: room.bossId, entry: `${shiny ? 'S' : 'N'}${room.bossId}`, shiny, legendary: true, source: 'raid' }, coins];
}
