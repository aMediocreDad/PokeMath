// Things a page shows in the shared header.

/** @typedef {Record<'today' | 'week' | 'month', Record<string, number>>} WorkOverview */

export const layout = $state({
	/** @type {WorkOverview | null} Only the game page fills in the work overview, as in the legacy site. */
	workOverview: null,
	/** @type {'good' | 'okay' | 'disconnected'} 'disconnected' puts a warning dot on the menu button. */
	connection: 'okay',
	/** The game's joke for a tampered ?stage=: the header briefly shows -99999 coins and "Juksemaker". */
	cheater: false
});
