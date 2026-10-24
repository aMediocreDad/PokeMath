// A copy of the save in IndexedDB, ported from the live global.js (pokemath.online, 2026-10).
// Clearing the browser history often clears localStorage but keeps IndexedDB, so when the save is
// gone the page can offer to bring it back. The copy is refreshed at most every three hours and
// never leaves the device, and never replaces a copy that holds more Pokémon. Private browsing can
// block IndexedDB; every call then does nothing.
// It holds the whole save, as the cloud copy and backup files do (saveData()).
import { saveData } from '#lib/storage.js';

const DB_NAME = 'PokemathBackup';
const STORE = 'snapshots';
const KEY = 'daily';
const INTERVAL_MS = 3 * 60 * 60 * 1000;

/** @typedef {{ timestamp: number, data: Record<string, string> }} Snapshot */

/** @returns {Promise<IDBDatabase>} */
function open() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = () => req.result.createObjectStore(STORE);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

/**
 * @template T
 * @param {IDBDatabase} db
 * @param {IDBTransactionMode} mode
 * @param {(store: IDBObjectStore) => IDBRequest<T>} op
 * @returns {Promise<T>}
 */
function run(db, mode, op) {
	return new Promise((resolve, reject) => {
		const req = op(db.transaction(STORE, mode).objectStore(STORE));
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

/** Until when the stored copy is known to be fresh, so most saves skip IndexedDB entirely. */
let freshUntil = 0;

/** Store a fresh copy if the last one is three hours old (idbMaybeSave()). */
export async function maybeSaveBackup() {
	if (Date.now() < freshUntil) return;
	try {
		const db = await open();
		/** @type {Snapshot | undefined} */
		const existing = await run(db, 'readonly', (s) => s.get(KEY));
		const now = Date.now();
		if (existing && now - existing.timestamp < INTERVAL_MS) {
			freshUntil = existing.timestamp + INTERVAL_MS;
			return db.close();
		}
		const data = saveData();
		// Never over a copy with more Pokémon: after a localStorage wipe the first catch would
		// replace the good copy with an almost empty save, and the restore offer would be gone.
		if (data.pokemonlist) {
			if (countPokemon(data.pokemonlist) >= countPokemon(existing?.data?.pokemonlist)) {
				await run(db, 'readwrite', (s) => s.put({ timestamp: now, data }, KEY));
			}
			freshUntil = now + INTERVAL_MS;
		}
		db.close();
	} catch (e) {
		console.warn('IDB backup failed:', e);
	}
}

/** @returns {Promise<Snapshot | null>} */
export async function readBackup() {
	try {
		const db = await open();
		const snapshot = await run(db, 'readonly', (s) => s.get(KEY));
		db.close();
		return snapshot || null;
	} catch (e) {
		console.warn('IDB check failed:', e);
		return null;
	}
}

export async function deleteBackup() {
	try {
		const db = await open();
		await run(db, 'readwrite', (s) => s.delete(KEY));
		db.close();
	} catch (e) {
		console.warn('IDB delete failed:', e);
	}
}

/** @param {string | undefined | null} list */
export const countPokemon = (list) => (list || '').split('|').filter((p) => p.trim()).length;
