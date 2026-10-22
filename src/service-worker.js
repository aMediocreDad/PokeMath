// Keeps the game playable offline once it has been opened online.
//
// - The app's code and the player pages are cached when this worker installs, per build.
// - Pages are fetched from the network first, so the Worker's login check still runs whenever
//   the device is online; offline, the cached copy is served.
// - Images and fonts are kept in a cache that outlives builds (ART), filled as they are seen and
//   by the background download in #lib/offline.svelte.js. A shiny picture not downloaded yet is
//   shown with the normal art, as the Worker does for shinies without their own art.
// - Everything else (the API, bingo, logging in) goes to the network as before.
//
// Nothing is stored unless it is a real answer for that file: with an expired session the Worker
// answers every path with a redirect to the login page or a 401, and those must never be cached
// as a page or a picture.
/// <reference lib="webworker" />
import { self } from '$app/service-worker';
import { immutable, prerendered } from '$app/manifest';
import { version } from '$app/env';
import { ART_CACHE } from '#lib/artCache.js';

const APP = `pm-app-${version}`;
/** Pages that only work online (teacher and bingo host pages) are left out. */
/** @type {string[]} */
const PAGES = prerendered.map((p) => '/' + p.path).filter((p) => !p.startsWith('/lærer/') && p !== '/bingo_join.html');
const DATA = ['/pokemon_info.json', '/valid_images.json'];

/** @param {Response} res @param {RegExp} type */
const usable = (res, type) => res.ok && !res.redirected && type.test(res.headers.get('Content-Type') || '');

self.addEventListener('install', (/** @type {ExtendableEvent} */ event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(APP);
			for (const [paths, type] of /** @type {const} */ ([
				[immutable.map((f) => '/' + f.path.replace(/^\//, '')), /./],
				[PAGES, /text\/html/],
				[DATA, /json/]
			])) {
				await Promise.all(
					paths.map(async (path) => {
						const res = await fetch(path, { cache: 'no-cache' });
						// Throwing fails the install; the next page load tries again.
						if (!usable(res, type)) throw new Error(`not cached: ${path} (${res.status})`);
						await cache.put(path, res);
					})
				);
			}
			await self.skipWaiting();
		})()
	);
});

self.addEventListener('activate', (/** @type {ExtendableEvent} */ event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) if (key.startsWith('pm-app-') && key !== APP) await caches.delete(key);
			await self.clients.claim();
		})()
	);
});

self.addEventListener('fetch', (/** @type {FetchEvent} */ event) => {
	const { request } = event;
	const url = new URL(request.url);
	if (request.method !== 'GET' || url.origin !== self.location.origin) return;
	const path = url.pathname;

	if (path.startsWith('/_app/immutable/')) {
		event.respondWith(caches.match(path).then((hit) => hit ?? fetch(request)));
	} else if (request.mode === 'navigate') {
		event.respondWith(page(request, path));
	} else if (/^\/(images|fonts)\/|\.(svg|png|webp|gif|ico|woff2?)$/.test(path)) {
		event.respondWith(art(request, path));
	} else if (DATA.includes(path)) {
		event.respondWith(networkFirst(request, path, /json/));
	}
});

/** @param {Request} request @param {string} path */
async function page(request, path) {
	try {
		const res = await fetch(request);
		// Only the page itself; a redirect to the login page is passed on but not kept.
		if (usable(res, /text\/html/) && PAGES.includes(path)) {
			const cache = await caches.open(APP);
			await cache.put(path, res.clone());
		}
		return res;
	} catch {
		return (await caches.match(path, { cacheName: APP })) ?? (await caches.match('/', { cacheName: APP })) ?? Response.error();
	}
}

/** @param {Request} request @param {string} path @param {RegExp} type */
async function networkFirst(request, path, type) {
	try {
		const res = await fetch(request);
		if (usable(res, type)) {
			const cache = await caches.open(APP);
			await cache.put(path, res.clone());
		}
		return res;
	} catch {
		return (await caches.match(path, { cacheName: APP })) ?? Response.error();
	}
}

/** @param {Request} request @param {string} path */
async function art(request, path) {
	const cache = await caches.open(ART_CACHE);
	const hit = await cache.match(path);
	if (hit) return hit;
	try {
		const res = await fetch(request);
		if (usable(res, /^(image|font)\//)) await cache.put(path, res.clone()).catch(() => {});
		return res;
	} catch {
		const normal = path.startsWith('/images/pokemon/shiny/') && (await cache.match(path.replace('/shiny/', '/normal/')));
		return normal || Response.error();
	}
}
