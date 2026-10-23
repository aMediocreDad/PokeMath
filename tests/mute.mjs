// The browser checks run on a developer's own machine: keep the bingo host's sounds out of the
// speakers. Every page a muted browser opens plays its media muted.
const mute = () => {
	const play = HTMLMediaElement.prototype.play;
	HTMLMediaElement.prototype.play = function () {
		this.muted = true;
		return play.call(this);
	};
};

/** @param {import('playwright-core').Browser} browser */
export function muteAudio(browser) {
	const newContext = browser.newContext.bind(browser);
	browser.newContext = async (...args) => {
		const ctx = await newContext(...args);
		await ctx.addInitScript(mute);
		return ctx;
	};
	// newPage() makes its own context, which would skip the one above.
	browser.newPage = async (...args) => (await browser.newContext(...args)).newPage();
	return browser;
}
