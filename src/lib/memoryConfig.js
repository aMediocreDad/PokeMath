// The memory game's rules that the teacher's page shows and the Worker enforces (worker/memory.js).

/** Cards on the board, by the size the teacher chose; always an even number. */
export const CARDS = { small: 12, medium: 16, large: 20 };

/** Columns the board is laid out in, by size, so it fills a projector's width. */
export const COLUMNS = { small: 4, medium: 4, large: 5 };

export const SIZES = /** @type {const} */ ([
	['small', 'Liten', '12 kort'],
	['medium', 'Middels', '16 kort'],
	['large', 'Stor', '20 kort']
]);

/** The class can save up this many turns; answers beyond that still earn coins. */
export const MAX_TURNS = 3;
