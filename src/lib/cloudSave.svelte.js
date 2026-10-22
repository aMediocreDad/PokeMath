// The cloud save: a copy of the save per login (GET/PUT /api/save), an email or a child's code,
// so a player can move between the iPad and a phone, and children can share one.
//
// It copies localStorage the way a backup file does (everything but a few keys that belong to
// this device), which also covers the legacy Christmas and Easter pages. Nothing is uploaded
// until the cloud copy has been checked: a fresh device has an empty save, and uploading that
// first would hide the real one; an empty device takes the cloud copy instead. When both sides
// have moved on, the player chooses (cloud.offer). The Worker also refuses an upload with fewer
// Pokémon than the cloud copy unless the player chose it.
//
// 'pm-cloud' remembers whose save this device holds and a fingerprint of it as it was when this
// device and the cloud last agreed; comparing both sides to it tells which one has moved since.
// A device holding someone else's save (two children, one iPad) never uploads it: it takes the
// new player's cloud copy, or starts them afresh. Logging out uploads, then clears the device.

import { deleteBackup } from '#lib/idbBackup.js';
import { forgetMe, loadMe, me } from '#lib/me.svelte.js';

const META = 'pm-cloud';
const UPLOAD_EVERY = 60_000;
/** Keys that belong to this device, not to the player. */
const DEVICE_KEYS = new Set([META, 'teacherSession', 'teacherBingoCode', 'bingoJoinedCode', 'bingoCode', '__pm_bw__', 'storageNoticeSeen', 'pm-round']);

/**
 * @typedef {{ data: Record<string, string>, pokemon: number, updatedAt: number }} CloudCopy
 * @typedef {{ cloud: CloudCopy, local: number }} Offer
 */

export const cloud = $state({
	/** @type {Offer | null} A choice the player has to make. */
	offer: null,
	/** @type {number | null} When the cloud copy was last brought up to date from this device. */
	savedAt: null,
	/** The cloud copy has been checked (or could not be), so other restore offers may show. */
	checked: false
});

/** Uploads wait until the cloud copy has been checked and any choice made. */
let ready = false;

/** @param {string | null | undefined} list */
export const countPokemon = (list) => String(list || '').split('|').filter((p) => p.trim()).length;

/** @returns {Record<string, string>} */
function snapshot() {
	/** @type {Record<string, string>} */
	const data = {};
	for (let i = 0; i < localStorage.length; i++) {
		const key = /** @type {string} */ (localStorage.key(i));
		if (!DEVICE_KEYS.has(key)) data[key] = /** @type {string} */ (localStorage.getItem(key));
	}
	return data;
}

/** A short fingerprint of a save, the same whatever order its keys are in (FNV-1a). */
function fingerprint(/** @type {Record<string, string>} */ data) {
	const text = JSON.stringify(Object.keys(data).sort().map((k) => [k, data[k]]));
	let h = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
	return (h >>> 0).toString(36) + ':' + text.length;
}

/** @typedef {{ owner?: string, hash?: string, pending?: string }} Meta */

/** @returns {Meta} */
function readMeta() {
	try {
		return JSON.parse(localStorage.getItem(META) || '{}');
	} catch {
		return {};
	}
}

/** Always records the current player as the owner. */
function writeMeta(/** @type {Meta} */ meta) {
	localStorage.setItem(META, JSON.stringify({ ...meta, owner: me.id }));
}

/** Remove the save from this device (everything but this module's own note). */
function clearSave() {
	for (const key of Object.keys(snapshot())) localStorage.removeItem(key);
	for (const key of DEVICE_KEYS) if (key !== META) localStorage.removeItem(key);
}

/** Replace this device's save with the cloud copy, and start the page over with it. */
export function useCloud(/** @type {CloudCopy} */ copy) {
	for (const key of Object.keys(snapshot())) if (!(key in copy.data)) localStorage.removeItem(key);
	for (const [key, value] of Object.entries(copy.data)) localStorage.setItem(key, value);
	writeMeta({ hash: fingerprint(copy.data) });
	location.reload();
}

/** Keep this device's save, and put it in the cloud even if it has fewer Pokémon. */
export async function keepDevice() {
	cloud.offer = null;
	ready = true;
	await upload(true);
}

/** Not now: ask again the next time the site opens, and upload nothing until then. */
export function decideLater() {
	cloud.offer = null;
}

/** @param {boolean} [force] @returns {Promise<boolean>} whether the cloud copy is now this device's save */
async function upload(force = false) {
	if (!ready) return false;
	const data = snapshot();
	const hash = fingerprint(data);
	if (!force && hash === readMeta().hash) return true;
	try {
		const res = await fetch('/api/save', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ data, force })
		});
		if (res.status === 409) {
			// The cloud has more Pokémon than this device: let the player choose.
			ready = false;
			const { save } = await res.json();
			cloud.offer = { cloud: save, local: countPokemon(data.pokemonlist) };
			return false;
		}
		if (!res.ok) return false;
		writeMeta({ hash });
		cloud.savedAt = (await res.json()).updatedAt;
		return true;
	} catch {
		// Offline: the next round tries again.
		return false;
	}
}

/** Log out: put the save in the cloud, then clear it from this device for the next player. */
export async function logOut() {
	const saved = !ready || readMeta().owner !== me.id || (await upload());
	if (!saved && !confirm('Fikk ikke lagret i skyen. Logge ut likevel? Det du har gjort siden sist, blir borte.')) return;
	clearSave();
	localStorage.removeItem(META);
	await deleteBackup();
	forgetMe();
	await fetch('/logout', { method: 'POST' }).catch(() => {});
	location.href = '/login.html';
}

/** When the page is hidden there is no time to wait for an answer; remember what was sent. */
function uploadOnLeave() {
	if (!ready) return;
	const data = snapshot();
	const hash = fingerprint(data);
	const meta = readMeta();
	if (hash === meta.hash) return;
	writeMeta({ ...meta, pending: hash });
	fetch('/api/save', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data }), keepalive: true }).catch(() => {});
}

/**
 * Check the cloud copy, then keep it up to date. Sets cloud.checked when done, so the IndexedDB
 * restore offer can wait and stay out of the way of a cloud offer.
 * @returns {() => void} stops the uploads
 */
export function startCloudSave() {
	const timer = setInterval(() => upload(), UPLOAD_EVERY);
	const onHide = () => document.visibilityState === 'hidden' && uploadOnLeave();
	document.addEventListener('visibilitychange', onHide);
	check().finally(() => (cloud.checked = true));
	// A page opened offline has not checked the cloud copy yet, so it uploads nothing until it has.
	const onOnline = () => !ready && !cloud.offer && check();
	window.addEventListener('online', onOnline);
	return () => {
		clearInterval(timer);
		document.removeEventListener('visibilitychange', onHide);
		window.removeEventListener('online', onOnline);
	};
}

async function check() {
	/** @type {CloudCopy | null} */
	let copy;
	try {
		const res = await fetch('/api/save');
		if (!res.ok) return;
		copy = (await res.json()).save;
	} catch {
		return;
	}

	await loadMe();
	if (!me.id) return;
	const meta = readMeta();
	// Someone else's save (the last player on this device did not log out): never upload it.
	// Take this player's cloud copy, or start them afresh.
	if (meta.owner && meta.owner !== me.id) {
		if (copy) return useCloud(copy);
		clearSave();
		writeMeta({ hash: fingerprint(snapshot()) });
		return location.reload();
	}

	const local = snapshot();
	const localHash = fingerprint(local);
	const localCount = countPokemon(local.pokemonlist);
	// An upload sent while leaving the last page counts if it arrived.
	if (copy && meta.pending && fingerprint(copy.data) === meta.pending) {
		meta.hash = meta.pending;
		writeMeta({ hash: meta.hash });
	}

	if (!copy) {
		ready = true;
		if (localCount > 0) await upload();
		return;
	}

	const cloudHash = fingerprint(copy.data);
	const cloudMoved = cloudHash !== meta.hash;
	const localMoved = localHash !== meta.hash;

	if (cloudHash === localHash) {
		writeMeta({ hash: localHash });
		ready = true;
	} else if (localCount === 0 && copy.pokemon > 0) {
		// A fresh or cleared device, or a child logging in after another: nothing to lose here.
		useCloud(copy);
	} else if (cloudMoved && !localMoved) {
		// Played elsewhere since this device last synced, nothing new here: bring it over.
		useCloud(copy);
	} else if (cloudMoved && localMoved) {
		cloud.offer = { cloud: copy, local: localCount };
	} else {
		ready = true;
		await upload();
	}
}
