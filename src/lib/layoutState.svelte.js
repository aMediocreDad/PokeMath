// Things a page shows in the shared header and bottom bar.

/** @typedef {Record<'today' | 'week' | 'month', Record<string, number>>} WorkOverview */

export const layout = $state({
	/** @type {WorkOverview | null} Only the game page fills in the work overview, as in the legacy site. */
	workOverview: null,
	/** Shown as "🎲 Bingo: CODE" in the bottom bar on the game page. */
	bingoCode: ''
});
