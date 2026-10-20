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

/** The legacy pages only save once the cookie notice has been accepted. */
export function hasCookieConsent() {
	return document.cookie.split(';').some((c) => c.trim().startsWith('cookies='));
}
