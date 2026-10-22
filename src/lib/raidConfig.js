// The raid's rules that the teacher's page shows and the Worker enforces (worker/raid.js).

/** Bosses the teacher can pick; "random" picks one of them. */
export const RAID_BOSSES = [144, 145, 146, 150, 249, 250, 382, 383, 384, 483, 484, 487, 643, 644, 716, 717, 791, 792, 888, 889];

/** Hits each child is expected to land, by the length the teacher chose (about 3 to 4 a minute). */
export const HITS_PER_CHILD = { short: 10, medium: 20, long: 35 };

export const LENGTHS = /** @type {const} */ ([
	['short', 'Kort', 'ca. 3 min'],
	['medium', 'Middels', 'ca. 6 min'],
	['long', 'Lang', 'ca. 10 min']
]);
