// The cache the service worker keeps images and fonts in, across builds. Shared with the
// background picture download in offline.svelte.js; a plain module so the worker can import it.
export const ART_CACHE = 'pm-art';
