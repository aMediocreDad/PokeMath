// The cloud save: a copy of the save per login (GET/PUT /api/save), an email or a child's code,
// so a player can move between the iPad and a phone, and children can share one.
//
// It copies localStorage the way a backup file does (everything but the keys that belong to this
// device, DEVICE_KEYS), which also covers the legacy Christmas and Easter pages. Nothing is
// uploaded until the cloud copy has been checked: a fresh device has an empty save, and uploading
// that first would hide the real one; an empty device takes the cloud copy instead. When both
// sides have moved on, the player chooses (cloud.offer).
//
// 'pm-cloud' remembers whose save this device holds, a fingerprint of it as it was when this
// device and the cloud last agreed, and that cloud copy's updatedAt (base). Comparing both sides
// to the fingerprint tells which one has moved since. Every upload names its base, and the Worker
// refuses it when the cloud copy has changed since then, so a device left open on old progress
// can never overwrite what was played elsewhere: it is checked again instead.
// A device holding someone else's save (two children, one iPad) never uploads it: it takes the
// new player's cloud copy, or starts them afresh. Logging out uploads, then clears the device.

import { deleteBackup } from '#lib/idbBackup.js';
import { forgetMe, loadMe, me } from '#lib/me.svelte.js';
import { DEVICE_KEYS, saveData as snapshot } from '#lib/storage.js';

const META = 'pm-cloud';
const UPLOAD_EVERY = 60_000;

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

/** A short fingerprint of a save, the same whatever order its keys are in (FNV-1a). */
function fingerprint(/** @type {Record<string, string>} */ data) {
	const text = JSON.stringify(Object.keys(data).sort().map((k) => [k, data[k]]));
	let h = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
	return (h >>> 0).toString(36) + ':' + text.length;
}

/** @typedef {{ owner?: string, hash?: string, base?: number, pending?: string }} Meta */

/** @returns {Meta} */
function readMeta() {
	try {
		return JSON.parse(localStorage.getItem(META) || '{}');
	} catch {
		return {};
	}
}

/** Replaces the note, and always records the current player as the owner. */
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
	writeMeta({ hash: fingerprint(copy.data), base: copy.updatedAt });
	location.reload();
}

/** Keep this device's save: it replaces the cloud copy the player was shown. */
export async function keepDevice() {
	const offer = cloud.offer;
	cloud.offer = null;
	if (offer) writeMeta({ ...readMeta(), base: offer.cloud.updatedAt });
	ready = true;
	await upload(true);
}

/** Not now: ask again the next time the site opens, and upload nothing until then. */
export function decideLater() {
	cloud.offer = null;
}

/**
 * @param {boolean} [always] upload even when nothing changed since the last upload
 * @returns {Promise<boolean>} whether the cloud copy is now this device's save
 */
async function upload(always = false) {
	if (!ready) return false;
	const data = snapshot();
	const hash = fingerprint(data);
	const meta = readMeta();
	if (!always && hash === meta.hash) return true;
	try {
		const res = await fetch('/api/save', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ data, base: meta.base ?? null })
		});
		if (res.status === 409) {
			// The cloud copy changed since this device last saw it: decide again, as on a page load.
			ready = false;
			await reconcile((await res.json()).save);
			return ready && readMeta().hash === hash;
		}
		if (!res.ok) return false;
		const { updatedAt } = await res.json();
		writeMeta({ hash, base: updatedAt });
		cloud.savedAt = updatedAt;
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

/**
 * When the page is hidden there is no time to wait for an answer; remember what was sent. The
 * next check sees whether it arrived, since this device never learns the new updatedAt.
 */
function uploadOnLeave() {
	if (!ready) return;
	const data = snapshot();
	const hash = fingerprint(data);
	const meta = readMeta();
	if (hash === meta.hash) return;
	writeMeta({ ...meta, pending: hash });
	fetch('/api/save', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, base: meta.base ?? null }), keepalive: true }).catch(() => {});
}

/** Check the cloud copy now, e.g. right after a backup file was restored. */
export function syncNow() {
	return check();
}

/**
 * Check the cloud copy, then keep it up to date. Sets cloud.checked when done, so the IndexedDB
 * restore offer can wait and stay out of the way of a cloud offer.
 * @returns {() => void} stops the uploads
 */
export function startCloudSave() {
	const timer = setInterval(() => upload(), UPLOAD_EVERY);
	// Hidden: upload. Shown again: an iPad wakes on a page left open for days, so check first.
	const onVisibility = () => {
		if (document.visibilityState === 'hidden') uploadOnLeave();
		else if (ready && !cloud.offer) check();
	};
	document.addEventListener('visibilitychange', onVisibility);
	check().finally(() => (cloud.checked = true));
	// A page opened offline has not checked the cloud copy yet, so it uploads nothing until it has.
	const onOnline = () => !ready && !cloud.offer && check();
	window.addEventListener('online', onOnline);
	return () => {
		clearInterval(timer);
		document.removeEventListener('visibilitychange', onVisibility);
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
	await reconcile(copy);
}

/**
 * Bring this device and the cloud copy together: on a page load, and when an upload is refused.
 * @param {CloudCopy | null} copy
 */
async function reconcile(copy) {
	const meta = readMeta();
	const local = snapshot();
	const localHash = fingerprint(local);
	const localCount = countPokemon(local.pokemonlist);

	if (!copy) {
		ready = true;
		if (localCount > 0) await upload();
		return;
	}

	const cloudHash = fingerprint(copy.data);
	// An upload sent while leaving the last page counts if it arrived.
	if (meta.pending && cloudHash === meta.pending) meta.hash = meta.pending;
	const cloudMoved = cloudHash !== meta.hash;
	const localMoved = localHash !== meta.hash;

	if (cloudHash === localHash) {
		writeMeta({ hash: localHash, base: copy.updatedAt });
		ready = true;
	} else if (localCount === 0 && copy.pokemon > 0) {
		// A fresh or cleared device, or a child logging in after another: nothing to lose here.
		useCloud(copy);
	} else if (cloudMoved && !localMoved) {
		// Played elsewhere since this device last synced, nothing new here: bring it over.
		useCloud(copy);
	} else if (cloudMoved && localMoved) {
		ready = false;
		cloud.offer = { cloud: copy, local: localCount };
	} else {
		// Only this device has moved, from the copy the cloud still holds.
		writeMeta({ hash: meta.hash, base: copy.updatedAt });
		ready = true;
		await upload();
	}
}
