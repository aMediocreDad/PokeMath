// Giving the player a specific Pokémon outside a normal catch: bingo prizes and redeemed codes.
// Ported from addSpecificToPokedex() in static/pokestuff.js.
import { player } from '#lib/player.svelte.js';
import { trackEvent } from '#lib/track.js';
import { getOrCreateUUID } from '#lib/uuid.js';

/** @param {string} entry  As stored, e.g. "N150" or "S25". */
export function giveSpecificPokemon(entry) {
	player.addPokemon(entry);
	const month = new Date().getMonth();
	if (month === 2 || month === 3) countEasterCatch();
	trackEvent('/track-catch', {});
}

/** The Easter event (March and April) counts these Pokémon, locally and site-wide. */
function countEasterCatch() {
	const year = new Date().getFullYear();
	if (parseInt(localStorage.getItem('easterYear') || '0') === year) {
		const caught = parseInt(localStorage.getItem('easterCaught') || '0') + 1;
		localStorage.setItem('easterCaught', String(caught));
		// Remember when each block of 50 was reached.
		const segment = Math.floor(caught / 50);
		if (caught % 50 === 0 && segment >= 1 && segment <= 10) {
			try {
				const reached = JSON.parse(localStorage.getItem('easterLocalTs') || '{}');
				if (!reached[segment]) {
					reached[segment] = Date.now();
					localStorage.setItem('easterLocalTs', JSON.stringify(reached));
				}
			} catch {}
		}
	}
	// The original sent getOrCreateUUID() without awaiting it, so the server got {"uuid":{}}.
	getOrCreateUUID().then((ids) => {
		if (!ids) return;
		fetch('/api/easter/catch', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ uuid: ids.uuid })
		}).catch(() => {});
	});
}
