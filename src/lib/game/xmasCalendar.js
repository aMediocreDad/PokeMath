// The Christmas calendar's doors and what the save keeps of it, ported from static/christmas.js.
//
// The save holds two keys, in the format the legacy page wrote: `xmasOpened`, a JSON array of the
// doors opened ("[1,3,5]"), and `xmasYear`, the year they belong to ("2026"). A restored backup
// (saveandload) stores the array's text as a JSON string, so reading accepts both. Nothing here
// needs the browser: the functions take the storage to work on.

/** The doors as they sit on the picture, row by row. */
export const GRID = [9, 6, 11, 7, 3, 20, 16, 2, 14, 12, 19, 15, 22, 1, 5, 23, 17, 10, 24, 21, 8, 18, 4, 13];

/** The doors with a Pokémon: its entry in the save, its image id and what the toast says. */
const POKEMON_DOORS = /** @type {Record<number, { entry: string, imageid: number, msg: string }>} */ ({
	1: { entry: 'N225-C1', imageid: 50038, msg: 'Luke 1 – Du har fått en Santa Delibird, og 1000 mynter!' },
	2: { entry: 'N37-C1', imageid: 50033, msg: 'Luke 2 – Rudolph Vulpix har blitt med på laget! (+1000 mynter)' },
	3: { entry: 'N198-C1', imageid: 50005, msg: 'Luke 3 – Festive Murkrow vil feire med deg! (+1000 mynter)' },
	4: { entry: 'N50-C1', imageid: 50034, msg: 'Luke 4 – En Angel Diglett har dukket opp! (+1000 mynter)' },
	5: { entry: 'N174-C1', imageid: 50012, msg: 'Luke 5 – Festive Igglybuff er klar for julen! (+1000 mynter)' },
	6: { entry: 'N104-C1', imageid: 50013, msg: 'Luke 6 – Festive Cubone er med på feiringen! (+1000 mynter)' },
	8: { entry: 'N179-C1', imageid: 50037, msg: 'Luke 8 – Christmas Mareep ønsker deg god jul! (+1000 mynter)' },
	9: { entry: 'N216-C1', imageid: 50199, msg: 'Luke 9 – Sweater Teddiursa holder deg varm! (+1000 mynter)' },
	10: { entry: 'N572-C1', imageid: 50146, msg: 'Luke 10 – Pyjama Minccino koser seg i jula! (+1000 mynter)' },
	11: { entry: 'N698-C1', imageid: 50051, msg: 'Luke 11 – Snowy Amaura dukker opp fra isen! (+1000 mynter)' },
	12: { entry: 'N149-C1', imageid: 50148, msg: 'Luke 12 – Conductor Dragonite er klar for juletog! (+1000 mynter)' },
	13: { entry: 'N861-C1', imageid: 50207, msg: 'Luke 13 – Grinchsnarl prøver å stjele julen! (+1000 mynter)' },
	15: { entry: 'N999-C1', imageid: 50209, msg: 'Luke 15 – Gingerbread Gimmighoul! Spis meg ikke! (+1000 mynter)' },
	16: { entry: 'N896-C1', imageid: 50057, msg: 'Luke 16 – Det legendariske Primal Glastrier har vist seg! (+1000 mynter)' },
	18: { entry: 'N151-U1', imageid: 130001, msg: 'Luke 18 – En Unik Pokémon! Christmas Mew er klar for Julen! (+1000 mynter)' },
	19: { entry: 'N143-C1', imageid: 50202, msg: 'Luke 19 – Ho ho ho! Santa Snorlax er klar med gavene! (+1000 mynter)' },
	20: { entry: 'N25-C1', imageid: 50054, msg: 'Luke 20 – Snowman Pikachu har ventet lenge på vintersesongen! (+1000 mynter)' },
	22: { entry: 'N311-U1', imageid: 50149, msg: 'Luke 22 – En Unik Pokémon! Pyjama Plusle & Minun koser seg! (+1000 mynter)' },
	23: { entry: 'N960-C1', imageid: 50208, msg: 'Luke 23 – Candy Cane Wiglett søter julen din! (+1000 mynter)' }
});

/** Given with the last door: shiny versions that only the calendar hands out. */
export const BONUS_ENTRIES = ['S225-C1', 'S143-C1', 'S151-U1', 'S311-U1'];
export const BONUS_MESSAGE = 'DU HAR ÅPNET ALLE LUKENE! Derfor får du noen unike shiny pokemon, som man bare kan få fra kalenderen!';
export const BONUS_IMAGE = '/images/events/christmas/present-1.png';

/** The picture behind an opened door: its Pokémon, or the calendar's own picture for coin doors. */
export function doorImage(/** @type {number} */ day) {
	const pokemon = POKEMON_DOORS[day];
	return pokemon ? `/images/pokemon/normal/${pokemon.imageid}.webp` : `/images/events/christmas/${day}.png`;
}

/**
 * What door `day` gives. Doors 17 and 24 give a background, or its price in coins when the player
 * has it already.
 * @param {number} day
 * @param {string[]} ownedBackgrounds
 * @returns {{ message: string, image: string, coins: number, entry: string | null, background: string | null }}
 */
export function doorReward(day, ownedBackgrounds) {
	const image = doorImage(day);
	const pokemon = POKEMON_DOORS[day];
	if (pokemon) return { message: pokemon.msg, image, coins: 1000, entry: pokemon.entry, background: null };
	const coins = (/** @type {number} */ amount, /** @type {string} */ message) => ({ message, image, coins: amount, entry: null, background: null });
	switch (day) {
		case 7:
			return coins(20000, 'Luke 7 – Du har fått 20 000 mynter!');
		case 14:
			return coins(30000, 'Luke 14 – Her får du 30 000 mynter!');
		case 17:
			return ownedBackgrounds.includes('bg-020')
				? coins(100000, 'Luke 17 – Her skulle du ha fått en ny bakgrunn, men denne har du allerede, så du får pengene tilbake!')
				: { ...coins(0, 'Luke 17 – Her får du en av julebakgrunnene!'), background: 'bg-020' };
		case 21:
			return coins(50000, 'Luke 21 – Her får du 50 000 mynter! Bruk dem godt!');
		case 24:
			return ownedBackgrounds.includes('bg-019')
				? coins(500000, 'Luke 24 – God Jul! Skulle du ha fått julekalenderen som bakgrunn, men den har du allerede, så du får pengene tilbake!')
				: { ...coins(0, 'Luke 24 – God Jul! Her får du en versjon av julekalenderen som du kan bruke som bakgrunn!'), background: 'bg-019' };
		default:
			return coins(0, 'Unknown date: ' + day);
	}
}

/** @typedef {Pick<Storage, 'getItem' | 'setItem'>} Store */

/**
 * The doors opened, whatever way the array was stored.
 * @param {Store} storage
 * @returns {number[]}
 */
export function readOpened(storage) {
	/** @type {unknown} */
	let value = storage.getItem('xmasOpened');
	// A backup restore leaves the array's text inside a JSON string: unwrap up to two layers.
	for (let layer = 0; layer < 3 && typeof value === 'string'; layer++) {
		try {
			value = JSON.parse(value);
		} catch {
			return [];
		}
	}
	if (!Array.isArray(value)) return [];
	return [...new Set(value.map(Number))].filter((day) => Number.isInteger(day) && day >= 1 && day <= 24);
}

/**
 * Note a door as opened. False when it already was, so that it is only ever paid once.
 * @param {Store} storage
 * @param {number} day
 */
export function recordOpened(storage, day) {
	const opened = readOpened(storage);
	if (opened.includes(day)) return false;
	opened.push(day);
	storage.setItem('xmasOpened', JSON.stringify(opened));
	return true;
}

/**
 * The calendar belongs to one year: with another year saved, or none, it starts over, with no door
 * opened and `year` saved. The legacy page did this door by door and so only got door 1 right.
 * @param {Store} storage
 * @param {number} year
 * @returns {boolean} true when the calendar started over.
 */
export function startYear(storage, year) {
	const saved = parseInt(String(storage.getItem('xmasYear') ?? '').replace(/^"+|"+$/g, ''));
	if (saved === year) return false;
	storage.setItem('xmasYear', JSON.stringify(year));
	storage.setItem('xmasOpened', '[]');
	return true;
}
