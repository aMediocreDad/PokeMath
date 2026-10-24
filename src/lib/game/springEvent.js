// The spring event ("Våren er her!") and what the save keeps of it, ported from static/easter.js.
//
// In March and April every Pokémon caught in the game fills a bar on this device (prizes.js,
// countEventCatch) and one for everyone (the Worker's /api/easter/catch). Each bar has ten prizes.
// The save holds, as the legacy page wrote them:
//   easterYear           the year the rest belongs to ("2026")
//   easterCaught         catches on this device ("175")
//   easterClaimed        indexes of the device prizes taken, JSON array ("[0,1]")
//   easterLocalTs        when each block of 50 was reached, JSON object ("{"1":1745000000000}")
//   easterGlobalClaimed  indexes of the global prizes taken
//   easterExtraClaimed   indexes of the extra goals taken
// Nothing here needs the browser: the functions take the storage to work on.

export const LOCAL_CAP = 500;
export const GLOBAL_CAP = 1_500_000;
export const SEG_COUNT = 10;
export const LOCAL_STEP = LOCAL_CAP / SEG_COUNT;
export const GLOBAL_STEP = GLOBAL_CAP / SEG_COUNT;

/**
 * The event is March and April of every year: when it starts and ends (ms) in the year of `time`.
 * @param {number} time
 */
export function springWindow(time) {
	const year = new Date(time).getFullYear();
	return { year, start: new Date(year, 2, 1).getTime(), end: new Date(year, 3, 30, 23, 59, 59).getTime() };
}

/** @typedef {{ entry: string, imageid: number, name: string, coins: number }} Prize */

/** Once everyone together has caught this many, a bonus prize opens for everyone. */
export const EXTRA_PRIZES = /** @type {(Prize & { threshold: number })[]} */ ([
	{ threshold: 3_000_000, entry: 'S421-E1', imageid: 50161, name: 'Shiny Blossom Cherrim', coins: 150_000 },
	{ threshold: 4_000_000, entry: 'S915-E1', imageid: 50167, name: 'Shiny Egg Forager Lechonk', coins: 200_000 },
	{ threshold: 5_000_000, entry: 'S132-E1', imageid: 50227, name: 'Shiny Cracked Ditto', coins: 300_000 }
]);

/** One for every 50 caught on this device. */
export const LOCAL_PRIZES = /** @type {Prize[]} */ ([
	{ entry: 'N659-E1', imageid: 50143, name: 'Nibbling Bunnelby', coins: 1000 },
	{ entry: 'N298-E1', imageid: 50164, name: 'Easter Egg Azurill', coins: 2000 },
	{ entry: 'N427-E1', imageid: 50096, name: 'Egg Basket Buneary', coins: 3000 },
	{ entry: 'N399-E1', imageid: 50228, name: 'Easter Bidoof', coins: 4000 },
	{ entry: 'N52-E1', imageid: 50163, name: 'Egg Painter Meowth', coins: 5000 },
	{ entry: 'N82-E1', imageid: 50092, name: 'Eggneton', coins: 7500 },
	{ entry: 'N115-E1', imageid: 50093, name: 'Egg Hunter Kangaskhan', coins: 10000 },
	{ entry: 'N719-E1', imageid: 50097, name: 'Spring Blooming Diancie', coins: 15000 },
	{ entry: 'N492-E1', imageid: 50060, name: 'Bouquet Shaymin', coins: 20000 },
	{ entry: 'S795-E1', imageid: 50099, name: 'Shiny Flower Pheromosa', coins: 50000 }
]);

/** One for every 150 000 caught by everyone. */
export const GLOBAL_PRIZES = /** @type {Prize[]} */ ([
	{ entry: 'N43-E1', imageid: 50059, name: 'Sprouting Oddish', coins: 5000 },
	{ entry: 'N660-E1', imageid: 50253, name: 'Bonnersby', coins: 7500 },
	{ entry: 'N46-E1', imageid: 50091, name: 'Flower Paras', coins: 10000 },
	{ entry: 'N131-E1', imageid: 50226, name: 'Egg Nest Lapras', coins: 15000 },
	{ entry: 'N267-E1', imageid: 50094, name: 'Hatching Beautifly', coins: 20000 },
	{ entry: 'N421-E1', imageid: 50161, name: 'Blossom Cherrim', coins: 25000 },
	{ entry: 'N777-E1', imageid: 50166, name: 'Easter Togedemaru', coins: 30000 },
	{ entry: 'N915-E1', imageid: 50167, name: 'Egg Forager Lechonk', coins: 50000 },
	{ entry: 'N132-E1', imageid: 50227, name: 'Cracked Ditto', coins: 75000 },
	{ entry: 'S719-E1', imageid: 50097, name: 'Shiny Spring Diancie', coins: 100000 }
]);

/** @typedef {Pick<Storage, 'getItem' | 'setItem'>} Store */

/**
 * Whether the save is this year's; if not, it starts over: nothing counted and no prize taken, the
 * global and bonus ones included (the legacy page left those, so last year's stayed taken).
 * @param {Store} storage
 * @param {number} year
 * @returns {boolean} true when it started over.
 */
export function startYear(storage, year) {
	if (parseInt(storage.getItem('easterYear') || '0') === year) return false;
	storage.setItem('easterYear', String(year));
	storage.setItem('easterCaught', '0');
	storage.setItem('easterClaimed', '[]');
	storage.setItem('easterLocalTs', '{}');
	storage.setItem('easterGlobalClaimed', '[]');
	storage.setItem('easterExtraClaimed', '[]');
	return true;
}

/** Catches on this device. @param {Store} storage */
export function readCaught(storage) {
	return parseInt(storage.getItem('easterCaught') || '0') || 0;
}

/**
 * A list of prize indexes, or [] when the value is missing or broken.
 * @param {Store} storage
 * @param {'easterClaimed' | 'easterGlobalClaimed' | 'easterExtraClaimed'} key
 * @returns {number[]}
 */
export function readClaimed(storage, key) {
	try {
		const list = JSON.parse(storage.getItem(key) || '[]');
		return Array.isArray(list) ? list.filter((index) => Number.isInteger(index)) : [];
	} catch {
		return [];
	}
}

/** When each block of 50 was reached, by block number. @param {Store} storage @returns {Record<string, number>} */
export function readTimestamps(storage) {
	try {
		const reached = JSON.parse(storage.getItem('easterLocalTs') || '{}');
		return reached && typeof reached === 'object' && !Array.isArray(reached) ? reached : {};
	} catch {
		return {};
	}
}

/**
 * Write a prize down as taken. False when it already was, so that it is only ever paid once.
 * @param {Store} storage
 * @param {'easterClaimed' | 'easterGlobalClaimed' | 'easterExtraClaimed'} key
 * @param {number} index
 */
export function markClaimed(storage, key, index) {
	const claimed = readClaimed(storage, key);
	if (claimed.includes(index)) return false;
	claimed.push(index);
	storage.setItem(key, JSON.stringify(claimed));
	return true;
}
