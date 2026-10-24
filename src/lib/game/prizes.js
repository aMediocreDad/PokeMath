// Giving the player a specific Pokémon outside a normal catch: bingo prizes and redeemed codes.
// Ported from addSpecificToPokedex() in static/pokestuff.js.
import { player } from '#lib/player.svelte.js';
import { trackEvent } from '#lib/track.js';
import { writeItem } from '#lib/storage.js';
import { startYear } from '#lib/game/springEvent.js';

/** @param {string} entry  As stored, e.g. "N150" or "S25". */
export function giveSpecificPokemon(entry) {
	player.addPokemon(entry);
	trackEvent('/track-catch', {});
}

/**
 * The spring event (March and April) counts every Pokémon caught in the game, on this device and
 * site-wide. Since the live pokestuff.js of 2026-10 it counts normal catches only, starts over each
 * year (springEvent.js, which the event page uses too), and sends the stored id and token instead
 * of creating one.
 */
export function countEventCatch() {
	// Through writeItem, so a full storage does not stop the catch.
	startYear({ getItem: (key) => localStorage.getItem(key), setItem: writeItem }, new Date().getFullYear());
	const caught = parseInt(localStorage.getItem('easterCaught') || '0') + 1;
	writeItem('easterCaught', String(caught));
	// Remember when each block of 50 was reached.
	const segment = Math.floor(caught / 50);
	if (caught % 50 === 0 && segment >= 1 && segment <= 10) {
		try {
			const reached = JSON.parse(localStorage.getItem('easterLocalTs') || '{}');
			if (!reached[segment]) {
				reached[segment] = Date.now();
				writeItem('easterLocalTs', JSON.stringify(reached));
			}
		} catch {
			// A broken value is left as it is, as before.
		}
	}
	const uuid = localStorage.getItem('UUID');
	const token = localStorage.getItem('token');
	if (!uuid || !token) return;
	fetch('/api/easter/catch', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ uuid, token, username: localStorage.getItem('username') || null })
	}).catch(() => {});
}
