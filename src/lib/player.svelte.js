// The player's save, shared by every Svelte page.
//
// It reads and writes the same localStorage keys, in the same formats, as loadAll()/loadShop()
// and saveAll() in static/global.js, so legacy and Svelte pages can be used side by side.
// One difference: a change is written straight away, and only the keys it touches are written,
// instead of everything at the end of a round.
import { getStorageArray, getStorageInt, getStorageString } from '#lib/storage.js';
import { maybeSaveBackup } from '#lib/idbBackup.js';

/** How saveAll() writes each field. */
const writers = {
	money: (/** @type {Player} */ p) => ({ money: String(p.money || 0) }),
	pkmnList: (/** @type {Player} */ p) => ({
		pkmncaught: String(p.pkmnList.length || 0),
		pokemonlist: p.pkmnList.filter((entry) => entry.trim() !== '').join('|')
	}),
	username: (/** @type {Player} */ p) => ({ username: p.username || 'Ash' }),
	tiersSolved: (/** @type {Player} */ p) =>
		Object.fromEntries(p.tiersSolved.map((n, i) => [`tier${i + 1}Solved`, String(n)])),
	customSolved: (/** @type {Player} */ p) => ({ customSolved: String(p.customSolved) }),
	adaptiveSolved: (/** @type {Player} */ p) => ({ adaptiveSolved: String(p.adaptiveSolved) }),
	playerIcon: (/** @type {Player} */ p) => ({
		playerIcon: p.playerIcon || '',
		boughtPlayerIcons: p.boughtPlayerIcons.filter((icon) => icon.trim() !== '').join('|')
	}),
	background: (/** @type {Player} */ p) => ({
		shopBackground: p.background || '',
		boughtBackgrounds: p.boughtBackgrounds.filter((bg) => bg.trim() !== '').join('|')
	}),
	upgrades: (/** @type {Player} */ p) => ({
		shinyLevel: String(p.shinyLevel || 1),
		legendLevel: String(p.legendLevel || 0),
		mythicLevel: String(p.mythicLevel || 0),
		specialLevel: String(p.specialLevel || 0),
		coinLevel: String(p.coinLevel || 0)
	}),
	// saveAll() only writes claimedSecrets when there are any.
	claimedSecrets: (/** @type {Player} */ p) =>
		p.claimedSecrets.length > 0 ? { claimedSecrets: p.claimedSecrets.join('|') } : {},
	shinyBait: (/** @type {Player} */ p) => ({
		shinyBaitCount: String(p.shinyBaitCount || 0),
		shinyBaitPurchases: String(p.shinyBaitPurchases || 0)
	})
};

/** @typedef {keyof typeof writers} Field */

class Player {
	username = $state('Ash');
	money = $state(0);
	/** @type {string[]} Entries like "N25", "S6" (shiny) or "N52-2" (alternate form). */
	pkmnList = $state([]);
	tiersSolved = $state([0, 0, 0, 0, 0]);
	customSolved = $state(0);
	/** Problems solved on the adaptive level ("Tilpasset nivå"). */
	adaptiveSolved = $state(0);

	background = $state('');
	playerIcon = $state('');
	playerIconImg = $state('');
	/** @type {string[]} */
	boughtBackgrounds = $state([]);
	/** @type {string[]} */
	boughtPlayerIcons = $state([]);
	/** @type {string[]} */
	claimedSecrets = $state([]);
	shinyLevel = $state(1);
	mythicLevel = $state(0);
	legendLevel = $state(0);
	specialLevel = $state(0);
	coinLevel = $state(0);
	shinyBaitCount = $state(0);
	shinyBaitPurchases = $state(0);

	/** The last change, shown by the header's coin animation: "+10" or "-5000". */
	moneyDelta = $state('0');
	moneyAnimating = $state(false);

	loaded = $state(false);

	caught = $derived(this.pkmnList.length);

	// As on the live site (global.js, 2026-10): icons are .webp now, so a saved .png path is read as
	// .webp; the header falls back to .png if that image is missing. Icons bought before the site
	// moved them out of unconverted/ still have that folder saved.
	playerImage = $derived(
		this.playerIcon
			? (this.playerIconImg.replace('/playericons/unconverted/', '/playericons/') || `/images/playericons/${this.playerIcon}.webp`).replace(
					/\.png$/,
					'.webp'
				)
			: '/images/player.png'
	);

	backgroundImage = $derived(this.background ? `/images/backgrounds/${this.background}.png` : '');

	/** Read the save, as loadAll() and loadShop() do. */
	load() {
		cleanupCorruptedData();

		this.money = getStorageInt('money');
		this.pkmnList = getStorageArray('pokemonlist', '|');
		this.tiersSolved = [1, 2, 3, 4, 5].map((tier) => getStorageInt(`tier${tier}Solved`));
		this.customSolved = getStorageInt('customSolved');
		this.adaptiveSolved = getStorageInt('adaptiveSolved');

		const username = getStorageString('username');
		if (!username || username.length > 22) {
			this.username = 'Ash';
			localStorage.setItem('username', 'Ash');
		} else {
			this.username = username;
		}

		this.background = getStorageString('shopBackground');
		this.boughtBackgrounds = getStorageArray('boughtBackgrounds', '|');
		this.playerIcon = getStorageString('playerIcon');
		this.playerIconImg = localStorage.getItem('playerIconImg')?.trim() ?? '';
		this.boughtPlayerIcons = getStorageArray('boughtPlayerIcons', '|');
		this.claimedSecrets = getStorageArray('claimedSecrets', '|');
		this.shinyLevel = getStorageInt('shinyLevel') || 1;
		this.mythicLevel = getStorageInt('mythicLevel');
		this.legendLevel = getStorageInt('legendLevel');
		this.specialLevel = getStorageInt('specialLevel');
		this.coinLevel = getStorageInt('coinLevel');
		this.shinyBaitCount = getStorageInt('shinyBaitCount');
		this.shinyBaitPurchases = getStorageInt('shinyBaitPurchases');

		this.loaded = true;
	}

	/**
	 * Write the given fields, in saveAll()'s format.
	 * @param {...Field} fields
	 */
	save(...fields) {
		for (const field of fields) {
			for (const [key, value] of Object.entries(writers[field](this))) {
				localStorage.setItem(key, value);
			}
		}
		maybeSaveBackup();
	}

	/** Every field, as saveAll() writes them. */
	saveAll() {
		this.save(.../** @type {Field[]} */ (Object.keys(writers)));
	}

	/** @param {number} amount */
	addMoney(amount) {
		this.money += amount;
		this.save('money');
		this.#animate('+' + amount);
	}

	/** @param {number} amount */
	spendMoney(amount) {
		this.money -= amount;
		this.save('money');
		this.#animate('-' + amount);
	}

	/** @param {string} delta */
	#animate(delta) {
		this.moneyDelta = delta;
		this.moneyAnimating = true;
		setTimeout(() => (this.moneyAnimating = false), 500);
	}

	/** @param {string} entry */
	addPokemon(entry) {
		this.pkmnList.push(entry);
		this.save('pkmnList');
	}
}

/** cleanupCorruptedData() from static/global.js, which loadAll() runs on every page. */
function cleanupCorruptedData() {
	for (const key of ['pokemonlist', 'boughtPlayerIcons']) {
		const raw = localStorage.getItem(key);
		if (raw && (raw.includes('"') || raw.includes('%22'))) {
			localStorage.setItem(key, raw.replace(/%22/g, '"').replace(/"/g, '').split('|').join('|'));
		}
	}
}

export const player = new Player();

if (typeof window !== 'undefined') {
	// Another tab, or a legacy page restored from the back/forward cache, may have changed the save.
	window.addEventListener('storage', (event) => {
		if (event.storageArea === localStorage) player.load();
	});
	window.addEventListener('pageshow', (event) => {
		if (event.persisted) player.load();
	});
}
