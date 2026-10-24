// The pages ask with an in-page dialog (src/lib/AskDialog.svelte), not confirm(). For the checks
// that only want to get past the question, answer yes to every one, as page.on('dialog') did.
const answerYes = () => {
	const click = () => document.getElementById('ask-ok')?.click();
	new MutationObserver(click).observe(document, { childList: true, subtree: true });
};

/** @param {import('playwright-core').Page} page */
export async function acceptAsks(page) {
	await page.addInitScript(answerYes);
	await page.evaluate(answerYes);
}
