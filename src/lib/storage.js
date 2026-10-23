// Low-level access to the player's save in localStorage.
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

/**
 * Keys that belong to this device, not to the player: the cloud copy, backup files and the
 * IndexedDB copy leave them out, and restoring one never writes them. Everything else is the save,
 * which also covers keys only the legacy Christmas and Easter pages know about.
 */
export const DEVICE_KEYS = new Set([
	'pm-cloud', 'pm-round', 'teacherSession', 'teacherBingoCode', 'teacherRaidCode', 'bingoJoinedCode', 'bingoCode',
	'__pm_bw__', 'storageNoticeSeen', 'backupReminder', 'alertDismissed', 'bingoMuted', 'dexBarsCollapsed', 'foilTilt'
]);

/** The player's save: every key in localStorage but the device's own. @returns {Record<string, string>} */
export function saveData() {
	/** @type {Record<string, string>} */
	const data = {};
	for (let i = 0; i < localStorage.length; i++) {
		const key = /** @type {string} */ (localStorage.key(i));
		if (!DEVICE_KEYS.has(key)) data[key] = /** @type {string} */ (localStorage.getItem(key));
	}
	return data;
}

/** Write a save into localStorage, skipping keys that belong to whichever device it came from. */
export function writeSaveData(/** @type {Record<string, string>} */ data) {
	for (const [key, value] of Object.entries(data)) if (!DEVICE_KEYS.has(key)) localStorage.setItem(key, String(value));
}

/** Whether the old cookie notice was accepted: it set cookies=true, setLegacySaveFlag() sets cookies=saved. */
export function acceptedOldNotice() {
	return document.cookie.split(';').some((c) => c.trim() === 'cookies=true');
}

/**
 * The legacy pages (static/global.js) save only when a cookie named 'cookies' exists. Saving is
 * needed for the game to work at all, so it never waits for a tap on the notice. Every page load
 * sets the flag again, since Safari drops cookies set from page script after seven days.
 */
export function setLegacySaveFlag() {
	const expires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString();
	document.cookie = `cookies=saved;expires=${expires};path=/;SameSite=Lax`;
}
