// Read-only access to the player's save in localStorage.
// These mirror getStorageInt/getStorageString/getStorageArray in static/global.js exactly,
// because both the legacy pages and the Svelte pages read and write the same keys.

/** @param {string} key */
export function getStorageInt(key) {
	const stored = localStorage.getItem(key);
	return stored ? parseInt(JSON.parse(stored)) : 0;
}

/** @param {string} key */
export function getStorageString(key) {
	const stored = localStorage.getItem(key);
	return stored ? stored.replace(/^"+|"+$/g, '').trim() : '';
}

/**
 * @param {string} key
 * @param {string} splitter
 */
export function getStorageArray(key, splitter) {
	const stored = localStorage.getItem(key);
	return stored ? stored.split(splitter).map((item) => item.replace(/^"+|"+$/g, '').trim()) : [];
}

/** Everything the header shows, read the same way loadAll() and loadShop() do. */
export function readPlayer() {
	let username = getStorageString('username');
	if (!username || username.length > 22) username = 'Ash';

	const playerIcon = getStorageString('playerIcon');
	const background = getStorageString('shopBackground');

	return {
		username,
		money: getStorageInt('money'),
		caught: getStorageArray('pokemonlist', '|').length,
		tiersSolved: [1, 2, 3, 4, 5].map((tier) => getStorageInt(`tier${tier}Solved`)),
		playerImage: playerIcon
			? localStorage.getItem('playerIconImg')?.trim() || `/images/playericons/${playerIcon}.png`
			: '/images/player.png',
		backgroundImage: background ? `/images/backgrounds/${background}.png` : ''
	};
}
