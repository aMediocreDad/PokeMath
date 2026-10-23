// The raid's rules that the teacher's page shows and the Worker enforces (worker/raid.js).

/** Bosses the teacher can pick; "random" picks one of them. */
export const RAID_BOSSES = [144, 145, 146, 150, 249, 250, 382, 383, 384, 483, 484, 487, 643, 644, 716, 717, 791, 792, 888, 889];

/** Each boss's base HP, from pokemon_info.json (tests/raid-rules.mjs checks it still matches). */
export const BOSS_HP = /** @type {Record<number, number>} */ ({
	144: 90, 145: 90, 146: 90, 150: 106, 249: 106, 250: 106, 382: 100, 383: 100, 384: 105, 483: 100,
	484: 90, 487: 150, 643: 100, 644: 100, 716: 126, 717: 126, 791: 137, 792: 137, 888: 92, 889: 92
});

/**
 * The boss's HP per child, as a multiple of its base HP, by the length the teacher chose. With a
 * 100-HP boss and average hits that is 10, 20 or 35 hits per child (about 3 to 4 a minute).
 */
export const HP_PER_CHILD = { short: 1, medium: 2, long: 3.5 };

/** [value, title, minutes with a 100-HP boss] */
export const LENGTHS = /** @type {const} */ ([
	['short', 'Kort', 3],
	['medium', 'Middels', 6],
	['long', 'Lang', 10]
]);

/** A hit is the answer divided by this, by level: 42 on level 3 hits for 42, 420 on level 4 too. */
const DIVISOR = /** @type {Record<number, number>} */ ({ 1: 1, 2: 1, 3: 1, 4: 10, 5: 1000 });
/** Every correct answer hits for at least this, so 0·7 counts too. */
export const MIN_HIT = 1;
/** Big products cannot end a raid alone. */
export const MAX_HIT = 50;
/** What a correct answer hits for when the page did not send it (pages from before damage). */
export const AVERAGE_HIT = 10;

/**
 * The damage a correct answer does: the answer, scaled to its level.
 * @param {unknown} value the answer @param {unknown} stage the level, 1–5
 */
export function damageFor(value, stage) {
	if (value === undefined || value === null || value === '') return AVERAGE_HIT;
	const answer = Math.abs(Number(value));
	if (!Number.isFinite(answer)) return AVERAGE_HIT;
	const level = Math.min(5, Math.max(1, Math.round(Number(stage)) || 3));
	return Math.min(MAX_HIT, Math.max(MIN_HIT, Math.round(answer / DIVISOR[level])));
}

/** The boss's HP for this many children. @param {number} bossId @param {number} children @param {string} length */
export function raidHp(bossId, children, length) {
	const factor = HP_PER_CHILD[/** @type {keyof typeof HP_PER_CHILD} */ (length)] ?? HP_PER_CHILD.medium;
	return Math.round((BOSS_HP[bossId] ?? 100) * Math.max(1, children) * factor);
}

/**
 * About how long a raid takes, in minutes: a boss with more HP takes longer.
 * @param {number | 'random'} bossId @param {number} minutes with a 100-HP boss
 */
export const raidMinutes = (bossId, minutes) =>
	Math.max(1, Math.round((minutes * (bossId === 'random' ? 100 : (BOSS_HP[bossId] ?? 100))) / 100));
