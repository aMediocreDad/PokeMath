// The cloud save: a copy of the save per Access login (GET/PUT /api/save), so a player can move
// between the iPad and a phone.
//
// It copies localStorage the way a backup file does (everything but a few keys that belong to
// this device), which also covers the legacy Christmas and Easter pages. Nothing is uploaded
// until the cloud copy has been checked: a fresh device has an empty save, and uploading that
// first would hide the real one. When the two differ in a way that is not plainly one side
// moving on, the player chooses (cloud.offer). The Worker also refuses an upload with fewer
// Pokémon than the cloud copy unless the player chose it.
//
// 'pm-cloud' remembers a fingerprint of the save as it was when this device and the cloud last
// agreed; comparing both sides to it tells which one has moved since.

const META = 'pm-cloud';
const UPLOAD_EVERY = 60_000;
/** Keys that belong to this device, not to the player. */
const DEVICE_KEYS = new Set([META, 'teacherSession', 'teacherBingoCode', 'bingoJoinedCode', 'bingoCode', '__pm_bw__']);

/**
 * @typedef {{ data: Record<string, string>, pokemon: number, updatedAt: number }} CloudCopy
 * @typedef {{ kind: 'restore' | 'conflict', cloud: CloudCopy, local: number }} Offer
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

/** @returns {{ hash?: string, pending?: string }} */
function readMeta() {
	try {
		return JSON.parse(localStorage.getItem(META) || '{}');
	} catch {
		return {};
	}
}

function writeMeta(/** @type {{ hash?: string, pending?: string }} */ meta) {
	localStorage.setItem(META, JSON.stringify(meta));
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

/** @param {boolean} [force] */
async function upload(force = false) {
	if (!ready) return;
	const data = snapshot();
	const hash = fingerprint(data);
	if (!force && hash === readMeta().hash) return;
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
			cloud.offer = { kind: 'conflict', cloud: save, local: countPokemon(data.pokemonlist) };
			return;
		}
		if (!res.ok) return;
		writeMeta({ hash });
		cloud.savedAt = (await res.json()).updatedAt;
	} catch {
		// Offline: the next round tries again.
	}
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
	return () => {
		clearInterval(timer);
		document.removeEventListener('visibilitychange', onHide);
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

	const local = snapshot();
	const localHash = fingerprint(local);
	const localCount = countPokemon(local.pokemonlist);
	const meta = readMeta();
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
		// A fresh or cleared device: offer the cloud copy, and upload nothing until then.
		cloud.offer = { kind: 'restore', cloud: copy, local: 0 };
	} else if (cloudMoved && !localMoved) {
		// Played elsewhere since this device last synced, nothing new here: bring it over.
		useCloud(copy);
	} else if (cloudMoved && localMoved) {
		cloud.offer = { kind: 'conflict', cloud: copy, local: localCount };
	} else {
		ready = true;
		await upload();
	}
}
