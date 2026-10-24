// The cache the service worker keeps images and fonts in, across builds. Shared with the
// background picture download in offline.svelte.js; a plain module so the worker can import it.
export const ART_CACHE = 'pm-art';

/** When a stored file was fetched; the worker reads it to know how old the copy is. */
const STAMP = 'x-pm-cached-at';

/** A stored picture or font older than this is checked against the server the next time it is used. */
export const REVALIDATE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The response to store: the same, stamped with when it was fetched, so its age is known later.
 * Takes over the body, so pass a clone when the original is still needed.
 * @param {Response} res
 */
export function stamped(res) {
	const headers = new Headers(res.headers);
	headers.set(STAMP, String(Date.now()));
	return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

/**
 * Whether a stored response is old enough to check again. A copy stored before the stamp existed
 * goes by its Date header, and one with neither is checked once, which stamps it.
 * @param {Response} res
 */
export function isStale(res) {
	const fetchedAt = Number(res.headers.get(STAMP)) || Date.parse(res.headers.get('Date') || '');
	return !(fetchedAt > 0) || Date.now() - fetchedAt > REVALIDATE_AFTER_MS;
}
