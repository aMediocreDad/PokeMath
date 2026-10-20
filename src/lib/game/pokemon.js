// Catching Pokémon, ported from static/pokestuff.js. The order of Math.random() calls is kept
// identical to the original.

const PKMN_NUM = 1025;
const SPECIAL_BONUS = 3;

/** @typedef {{ name?: string, types?: string | string[], imageid?: number, is_legendary?: boolean, is_mythical?: boolean, spawn_season?: string, enabled?: boolean }} Variant */
/** @typedef {Record<string, Record<string, Variant>>} PokemonInfo */

/** @type {PokemonInfo | null} */
let info = null;
/** @type {number[]} */
let legendaries = [];
/** @type {number[]} */
let mythics = [];
/** @type {number[]} */
let specialforms = [];

/** @type {Promise<void> | null} */
let loading = null;

/** Load static/pokemon_info.json once. It is fetched, not imported, to keep it out of the JS bundle. */
export function loadPokemonInfo() {
	loading ??= fetch('/pokemon_info.json')
		.then((r) => r.json())
		.then((/** @type {PokemonInfo} */ data) => {
			info = data;
			for (const [dex, variants] of Object.entries(data)) {
				const base = variants['0'];
				if (!base) continue;
				const dexNum = parseInt(dex);
				if (base.is_legendary) legendaries.push(dexNum);
				if (base.is_mythical) mythics.push(dexNum);
				if (Object.keys(variants).some((k) => /^\d+$/.test(k) && k !== '0')) specialforms.push(dexNum);
			}
		});
	return loading;
}

export const isLegendary = (/** @type {number} */ id) => legendaries.includes(id);
export const isMythic = (/** @type {number} */ id) => mythics.includes(id);

function currentSeason() {
	const month = new Date().getMonth() + 1;
	if ([3, 4, 5].includes(month)) return 'spring';
	if ([6, 7, 8].includes(month)) return 'summer';
	if ([9, 10, 11].includes(month)) return 'autumn';
	return 'winter';
}

/**
 * @typedef {object} CatchContext
 * @property {string | number} stage
 * @property {number} streak  Correct answers in a row; reset to 0 by a legendary, mythic or shiny.
 * @property {{ shinyLevel: number, legendLevel: number, mythicLevel: number }} upgrades
 */

/** @param {CatchContext} ctx */
function canCaptureLegendary(ctx) {
	const value = Math.max(
		0,
		Math.floor(Math.random() * (31 - (Number(ctx.stage) * 3 + ctx.upgrades.legendLevel + ctx.streak / 1000)))
	);
	if (value === 0) ctx.streak = 0;
	return value === 0;
}

/** @param {CatchContext} ctx */
function canCaptureMythic(ctx) {
	const value = Math.max(
		0,
		Math.floor(Math.random() * (41 - (Number(ctx.stage) * 3 + ctx.upgrades.mythicLevel + ctx.streak / 1000)))
	);
	if (value === 0) ctx.streak = 0;
	return value === 0;
}

/**
 * createRandomPokemon(): which Pokémon the ball gives. Legendaries and mythics get a second
 * roll that must succeed, otherwise the whole roll starts over.
 * @param {CatchContext} ctx
 * @returns {number}
 */
export function rollPokemonId(ctx) {
	let id = Math.floor(Math.random() * (PKMN_NUM + (SPECIAL_BONUS + Number(ctx.stage)))) + 1;
	if (id > PKMN_NUM) id = specialforms[Math.floor(Math.random() * specialforms.length)];
	if (legendaries.includes(id) && !canCaptureLegendary(ctx)) return rollPokemonId(ctx);
	if (mythics.includes(id) && !canCaptureMythic(ctx)) return rollPokemonId(ctx);
	return id;
}

/**
 * createSpecificPokemon(): pick the normal form or, sometimes, an alternate form.
 * @param {number} dexId
 * @param {string | number} stage
 * @returns {string} "25", or "25-1" for an alternate form.
 */
export function pickForm(dexId, stage) {
	const variants = info?.[String(dexId)];
	if (!variants) return String(dexId);
	const season = currentSeason();
	const variantPool = Object.entries(variants).filter(([key, v]) => {
		if (!/^\d+$/.test(key) || key === '0') return false;
		return !(v.spawn_season && v.spawn_season !== season);
	});
	const s = stage || 3;
	const altThreshold = Number(s) <= 1 ? 0.95 : Number(s) <= 2 ? 0.85 : 0.4;
	if (variantPool.length > 0 && Math.random() > altThreshold) {
		const [key] = variantPool[Math.floor(Math.random() * variantPool.length)];
		return `${dexId}-${key}`;
	}
	return String(dexId);
}

/**
 * Event forms (H1, C2, E3, …), from createEventPokemon().
 * @param {string} eventType  "H" Halloween, "C" Christmas, "E" Easter, "S" summer, "U" unique.
 * @returns {string | null}
 */
export function pickEventForm(eventType) {
	if (!info) return null;
	const pattern = new RegExp(`^${eventType}\\d+$`);
	/** @type {string[]} */
	const pool = [];
	for (const [dex, variants] of Object.entries(info)) {
		for (const [key, v] of Object.entries(variants)) {
			if (pattern.test(key) && v.enabled) pool.push(`${dex}-${key}`);
		}
	}
	return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}

/**
 * calculateShinyChance(): 1 in `chance` catches is shiny.
 * @param {CatchContext} ctx
 */
function shinyChance(ctx) {
	const stage = ctx.stage ?? 1;
	return Math.max(0, 55 + (15 - Number(stage) * 3) - ctx.upgrades.shinyLevel / 3.3 - ctx.streak / 1000);
}

/**
 * The shiny roll in addToPokedex(). Stardust (shiny bait) makes it shiny without a roll.
 * @param {CatchContext} ctx
 * @param {boolean} baitActive
 */
export function rollShiny(ctx, baitActive) {
	const shiny = baitActive || Math.floor(Math.random() * shinyChance(ctx)) === 0;
	if (shiny) ctx.streak = 0;
	return shiny;
}

const GENERATIONS = [
	[1, 151], [152, 251], [252, 386], [387, 493], [494, 649], [650, 721], [722, 809], [810, 898], [899, 1025]
];

/**
 * @param {number} id
 * @param {string} name
 */
function generation(id, name) {
	if (name.includes('Hisuian')) return 4;
	if (name.includes('Alolan')) return 7;
	const index = GENERATIONS.findIndex(([from, to]) => id >= from && id <= to);
	return index + 1;
}

/** @param {string | string[] | undefined} types */
const typeList = (types) => (Array.isArray(types) ? types : types ? [types] : ['Unknown']);

/**
 * @typedef {object} PokemonCard
 * @property {string} entry  As stored, e.g. "S52-2".
 * @property {number} id  Dex number, 0 for unknown entries.
 * @property {string} cardId  Shown as "#25" or "#52-2".
 * @property {string} name
 * @property {string[]} types
 * @property {boolean} shiny
 * @property {'' | 'legendary' | 'mythic'} rarity
 * @property {string} image
 * @property {number} repeatMultiplier  Coins for a duplicate are multiplied by this.
 * @property {string} filterText  CSS classes the Pokédex filters on.
 */

/**
 * What loadFromList() shows for a stored entry.
 * @param {string} rawEntry
 * @returns {PokemonCard}
 */
export function describe(rawEntry) {
	const entry = rawEntry.startsWith('"') && rawEntry.endsWith('"') ? rawEntry.slice(1, -1) : rawEntry;
	const shiny = entry[0] === 'S';
	let id = 0;
	let cardId = entry.substring(1);
	let name = '';
	/** @type {string[]} */
	let types = [];
	let imageId = 0;

	if (entry.includes('-')) {
		const [idPart, variantKey] = entry.split('-');
		id = Number(idPart.replace(/\D/g, ''));
		const variant = info?.[id]?.[variantKey];
		const base = info?.[id]?.['0'];
		name = (variant ?? base)?.name || '???';
		types = typeList((variant ?? base)?.types);
		imageId = variant ? variant.imageid ?? id : id;
	} else {
		id = Number(entry.replace(/\D/g, ''));
		imageId = id;
		const base = info?.[id]?.['0'];
		if (!base) {
			types = [`Unknown (${id})`];
			cardId = '???';
			name = 'Missing No.';
			id = 0;
			imageId = 0;
		} else {
			types = typeList(base.types);
			name = base.name ?? '';
		}
	}
	if (!name) name = '???';
	if (!types.length) types = ['Unknown'];

	const rarity = legendaries.includes(id) ? 'legendary' : mythics.includes(id) ? 'mythic' : '';
	const repeatMultiplier = (rarity === 'legendary' ? 2 : rarity === 'mythic' ? 3 : 1) * (shiny ? 2 : 1);
	const shinyText = shiny ? 'Shiny ' : '';
	const rarityText = rarity === 'legendary' ? 'Legendarisk ' : rarity === 'mythic' ? 'Mytisk ' : '';
	const filterText = [`filtered #${entry} ${shinyText} ${rarityText}${name} gen-${generation(id, name)}`, ...types].join(' ');

	return {
		entry,
		id,
		cardId,
		name,
		types,
		shiny,
		rarity,
		image: `images/pokemon/${shiny ? 'shiny' : 'normal'}/${imageId}.png`,
		repeatMultiplier,
		filterText
	};
}

/** "Shiny Legendarisk Mewtwo", as in the catch messages. @param {PokemonCard} card */
export function catchTitle(card) {
	const rarityText = card.rarity === 'legendary' ? 'Legendarisk ' : card.rarity === 'mythic' ? 'Mytisk ' : '';
	return `${card.shiny ? 'Shiny ' : ''}${rarityText}${card.name}`;
}
