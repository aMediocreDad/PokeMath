// Download every Pokémon picture once, in the background, so catching works offline. The pictures
// go in the same cache the service worker serves images from (src/service-worker.js), which is
// kept across builds. Normal art comes first, then shiny; shiny art not downloaded yet is shown
// with the normal art. The download picks up where it stopped on the next page load, and stops
// quietly when the device goes offline or the browser refuses more storage.

import { ART_CACHE, stamped } from '#lib/artCache.js';
import { toast } from '#lib/toast.svelte.js';

const PARALLEL = 6;

export const offline = $state({
	/** Pictures in the full set. */
	total: 0,
	/** Pictures on this device. */
	done: 0,
	/** A download is running. */
	running: false,
	/** This page load finished the set. */
	finished: false
});

let started = false;

/** Start the download, once per page load. */
export async function startArtDownload() {
	if (started || typeof caches === 'undefined' || !navigator.onLine) return;
	started = true;
	const connection = /** @type {{ saveData?: boolean } | undefined} */ (/** @type {any} */ (navigator).connection);
	if (connection?.saveData) return;

	/** @type {number[]} */
	let ids;
	try {
		ids = await fetch('/valid_images.json').then((r) => r.json());
	} catch {
		return;
	}
	const all = ['normal', 'shiny'].flatMap((kind) => ids.map((id) => `/images/pokemon/${kind}/${id}.webp`));
	const cache = await caches.open(ART_CACHE);
	const have = new Set((await cache.keys()).map((r) => new URL(r.url).pathname));
	const todo = all.filter((path) => !have.has(path));
	offline.total = all.length;
	offline.done = all.length - todo.length;
	if (!todo.length) return;

	// Ask the browser not to clear the pictures (and the save) when space runs low.
	await navigator.storage?.persist?.().catch(() => false);
	offline.running = true;
	let stop = false;
	await Promise.all(
		Array.from({ length: PARALLEL }, async () => {
			for (let path = todo.shift(); path && !stop; path = todo.shift()) {
				try {
					const res = await fetch(path);
					// A missing picture (404) or a lost session (401) is skipped, not stored.
					if (res.ok && !res.redirected && (res.headers.get('Content-Type') || '').startsWith('image/')) await cache.put(path, stamped(res));
					offline.done++;
				} catch (err) {
					// Offline again, or out of storage (QuotaExceededError): try again on a later visit.
					stop = true;
					console.warn('Pokémon download stopped:', err);
				}
			}
		})
	);
	offline.running = false;
	offline.finished = !stop;
	if (offline.finished) toast('Alle Pokémon er lastet ned. Nå kan du regne uten nett!');
	if (navigator.storage?.estimate) {
		const { usage = 0, quota = 0 } = await navigator.storage.estimate();
		console.info(`Offline storage: ${(usage / 1e6).toFixed(0)} MB of ${(quota / 1e6).toFixed(0)} MB`);
	}
}
