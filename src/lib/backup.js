// Backup files (.pkmth), ported from static/saveandload.js.
//
// Current format: every localStorage key as JSON, base64-encoded with btoa().
// Old format: base64 of "state|...*SPLIT*shop|...*SPLIT*xmas*SPLIT*badges*SPLIT*codes".

/**
 * saveLocalStorageToFile(): the file name and contents for a backup of everything in localStorage.
 * @param {string} username  The loaded player name, as in the legacy page.
 */
export function createBackup(username) {
	const data = Object.fromEntries(Object.entries(localStorage));
	const contents = btoa(JSON.stringify(data));

	const date = new Date();
	date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
	const dateString = date.toJSON().slice(0, 10).replace(/[^a-zA-Z0-9_-]/g, '');

	if (!username || /[ `!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~]/.test(username)) username = 'Username_Error';
	const filename = `${username.replace(/[^a-zA-Z0-9_-]/g, '')}_savefile_${dateString}.pkmth`;

	return { filename, contents };
}

/**
 * Restore a backup in the current format. Throws if the file is not that format.
 * @param {string} contents
 */
export function restoreBackup(contents) {
	const data = JSON.parse(atob(contents));
	// Most Pokémon wins (live saveandload.js, 2026-10): a file with fewer Pokémon than this device
	// has is not loaded.
	const count = (/** @type {string | null | undefined} */ list) => (list || '').split('|').filter((p) => p.trim()).length;
	const incoming = count(data.pokemonlist);
	const current = count(localStorage.getItem('pokemonlist'));
	if (incoming < current) return { refused: true, incoming, current };
	for (const [key, value] of Object.entries(data)) localStorage.setItem(key, value);
	return { refused: false, incoming, current };
}

/**
 * @typedef {object} OldBackup
 * @property {Record<string, string>} state  username, totalScore, pkmnCaught, tierNSolved…
 * @property {Record<string, string>} shop  background, playerIcon, shinyLevel…
 * @property {{ year: number, opened: string } | null} xmas
 * @property {unknown} badges
 * @property {unknown} redeemedCodes
 */

/**
 * Parse a backup in the old format (handleOldFileLoad()). Throws with a Norwegian message
 * when the file cannot be read.
 * @param {string} contents
 * @returns {OldBackup}
 */
export function parseOldBackup(contents) {
	const text = atob(contents);
	if (!text) throw new Error('Filen du lastet opp hadde ingenting vi kunne lese.');
	const parts = text.split('*SPLIT*');
	if (parts.length < 2) throw new Error('Filen du lastet opp er satt sammen på feil måte.');
	const stateText = parts[0].split('|');
	const shopText = parts[1].split('|');
	if (stateText.length < 13) throw new Error('Filen din har feil format på State-data.');
	if (shopText.length < 10) throw new Error('Filen din har feil format på Shop-data.');

	/** @param {string | undefined} json */
	const parseJson = (json) => {
		if (!json || json.trim() === '') return null;
		try {
			return JSON.parse(json);
		} catch {
			return null;
		}
	};

	const [username, totalScore, , , , , pkmnList, t1, t2, t3, t4, t5, customSolved] = stateText;
	const [background, playerIcon, boughtBackgrounds, boughtPlayerIcons, claimedSecrets, shinyLevel, mythicLevel, legendLevel, specialLevel, coinLevel] = shopText;
	const xmas = parts[2] != null ? parts[2].split('|') : null;

	return {
		state: { username, totalScore, pkmnList, t1, t2, t3, t4, t5, customSolved },
		shop: { background, playerIcon, boughtBackgrounds, boughtPlayerIcons, claimedSecrets, shinyLevel, mythicLevel, legendLevel, specialLevel, coinLevel },
		xmas: xmas ? { year: Number(xmas[0]), opened: xmas[1] } : null,
		badges: parseJson(parts[3]),
		redeemedCodes: parseJson(parts[4])
	};
}
