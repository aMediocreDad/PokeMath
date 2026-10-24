// Low-level access to the player's save in localStorage.
// These mirror getStorageInt/getStorageString/getStorageArray in static/global.js exactly,
// because both the legacy pages and the Svelte pages read and write the same keys.
import { toast } from '#lib/toast.svelte.js';

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
	'__pm_bw__', 'storageNoticeSeen', 'backupReminder', 'alertDismissed', 'bingoMuted', 'dexBarsCollapsed', 'foilTilt', 'dexMode',
	'teacherMemoryCode', 'teacherRaidChoice', 'teacherMemoryChoice', 'teacherBingoSettings'
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

/** Whether the player has been told that the device is full. Once per page load: it would otherwise repeat every answer. */
let toldFull = false;

/**
 * localStorage.setItem() that never throws. A full storage (QuotaExceededError) or a blocked one
 * must not stop what the player is doing, such as the round: the player is told once, and the
 * change is not kept.
 * @param {string} key
 * @param {string} value
 * @returns {boolean} whether it was written
 */
export function writeItem(key, value) {
	try {
		localStorage.setItem(key, value);
		return true;
	} catch (error) {
		console.warn(`Could not save ${key}:`, error);
		if (!toldFull) {
			toldFull = true;
			toast('Det er ikke plass til å lagre fremdriften på denne enheten. Frigjør plass, ellers kan den gå tapt.', { bad: true });
		}
		return false;
	}
}

/**
 * Replace the save with `data`: what it holds is written, and every other key of the save goes,
 * but the device's own keys stay. All or nothing: if a write fails (the device is full), the save
 * is put back as it was.
 * @param {Record<string, string>} data
 * @returns {boolean} whether the save was replaced
 */
export function replaceSaveData(data) {
	const current = saveData();
	const written = Object.keys(data).filter((key) => !DEVICE_KEYS.has(key));
	/** @type {Map<string, string | null>} What every key touched held before. */
	const before = new Map([...Object.keys(current), ...written].map((key) => [key, localStorage.getItem(key)]));
	try {
		// New values first, so a failure leaves the old ones to put back.
		for (const key of written) localStorage.setItem(key, String(data[key]));
		for (const key of Object.keys(current)) if (!(key in data)) localStorage.removeItem(key);
		return true;
	} catch (error) {
		console.warn('Could not replace the save:', error);
		for (const [key, value] of before) {
			try {
				if (value === null) localStorage.removeItem(key);
				else localStorage.setItem(key, value);
			} catch {
				// Putting back what was there needs no more room than it took; nothing more to do.
			}
		}
		return false;
	}
}

/** Whether the old cookie notice was accepted: it set cookies=true. */
export function acceptedOldNotice() {
	return document.cookie.split(';').some((c) => c.trim() === 'cookies=true');
}
