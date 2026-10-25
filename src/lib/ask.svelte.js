// In-page questions in place of confirm(), rendered and styled by AskDialog.svelte. A native
// confirm() stops the whole page, cannot be styled, and on iPhone shows the site's address.

/** @typedef {{ id: number, text: string, ok: string, cancel: string, answer: (yes: boolean) => void }} Question */

/** The question showing, or null. One at a time: a second waits for the first to be answered. */
export const asking = $state(/** @type {{ current: Question | null }} */ ({ current: null }));

/** @type {Question[]} */
const queue = [];
let nextId = 1;

/**
 * Ask a yes/no question. Resolves to true for `ok`, false for `cancel`, a tap outside or Escape.
 * @param {string} text
 * @param {{ ok?: string, cancel?: string }} [options]
 * @returns {Promise<boolean>}
 */
export function ask(text, { ok = 'OK', cancel = 'Avbryt' } = {}) {
	return new Promise((resolve) => {
		queue.push({ id: nextId++, text, ok, cancel, answer: resolve });
		asking.current ??= queue.shift() ?? null;
	});
}

/** @param {boolean} yes */
export function answer(yes) {
	const question = asking.current;
	if (!question) return;
	asking.current = queue.shift() ?? null;
	question.answer(yes);
}
