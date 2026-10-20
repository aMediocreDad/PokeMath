// Things a page shows in the shared header and bottom bar.

/** @typedef {Record<'today' | 'week' | 'month', Record<string, number>>} WorkOverview */

export const layout = $state({
	/** @type {WorkOverview | null} Only the game page fills in the work overview, as in the legacy site. */
	workOverview: null,
	/** Shown as "🎲 Bingo: CODE" in the bottom bar on the game page. */
	bingoCode: '',
	/** @type {'good' | 'okay' | 'disconnected'} The light in the bottom bar (updateConnectionIndicator()). */
	connection: 'okay',
	/** The game's joke for a tampered ?stage=: the header briefly shows -99999 coins and "Juksemaker". */
	cheater: false
});
