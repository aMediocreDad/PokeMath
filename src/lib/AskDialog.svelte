<script>
	// The question asked by ask() in ask.svelte.js: a card over a dimmed page. Escape or a tap on
	// the dimmed page answers no. #ask-ok and #ask-cancel are what the tests press.
	import { asking, answer } from '#lib/ask.svelte.js';

	/** @param {HTMLElement} node */
	const focus = (node) => node.focus();

	/** @param {KeyboardEvent} event */
	function onKey(event) {
		if (asking.current && event.key === 'Escape') answer(false);
	}
</script>

<svelte:window onkeydown={onKey} />

{#if asking.current}
	{@const q = asking.current}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div class="ask-backdrop" onclick={(e) => e.target === e.currentTarget && answer(false)}>
		<div class="ask" role="alertdialog" aria-modal="true" aria-labelledby="ask-text">
			<p id="ask-text">{q.text}</p>
			<div class="ask-actions">
				<button id="ask-cancel" class="pm-button secondary" onclick={() => answer(false)}>{q.cancel}</button>
				{#key q.id}
					<button id="ask-ok" class="pm-button" onclick={() => answer(true)} use:focus>{q.ok}</button>
				{/key}
			</div>
		</div>
	</div>
{/if}

<style>
	.ask-backdrop {
		position: fixed;
		inset: 0;
		/* Above the toasts (1250) and the header's dialogs (1200), under the catch screen's overlays. */
		z-index: 1280;
		display: grid;
		place-items: center;
		padding: 16px;
		background: oklch(0.28 0.035 265 / 0.55);
	}
	.ask {
		box-sizing: border-box;
		width: min(400px, 100%);
		padding: 22px;
		border-radius: var(--pm-radius);
		background: var(--pm-paper);
		box-shadow: var(--pm-shadow);
		color: var(--pm-ink);
	}
	p {
		margin: 0 0 18px;
		font-size: 17px;
		line-height: 1.45;
		/* Questions may carry a line break between the question and what it means. */
		white-space: pre-line;
	}
	.ask-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 10px;
	}
	.ask-actions .pm-button {
		flex: 1 1 auto;
		margin: 0;
	}
</style>
