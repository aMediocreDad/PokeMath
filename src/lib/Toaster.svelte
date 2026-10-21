<script>
	// Same markup and behaviour as the Toast class in static/global.js: 8 seconds, a progress
	// bar, paused while hovered or while the tab is hidden, and closed by a tap.
	import { onMount } from 'svelte';
	import { toasts, dismissToast, notifications } from '#lib/toast.svelte.js';

	const AUTO_CLOSE = 8000;

	/**
	 * @param {HTMLElement} node
	 * @param {number} id
	 */
	function autoClose(node, id) {
		let visible = 0;
		let paused = false;
		/** @type {number | null} */
		let last = null;
		const pause = () => (paused = true);
		const resume = () => (paused = false);
		node.addEventListener('mouseover', pause);
		node.addEventListener('mouseleave', resume);

		/** @param {number} time */
		const frame = (time) => {
			if (document.visibilityState !== 'visible') last = null;
			if (last !== null && !paused) visible += time - last;
			last = time;
			node.style.setProperty('--progress', String(1 - visible / AUTO_CLOSE));
			if (visible >= AUTO_CLOSE) return dismissToast(id);
			raf = requestAnimationFrame(frame);
		};
		let raf = requestAnimationFrame(frame);
		requestAnimationFrame(() => node.classList.add('show'));

		return { destroy: () => cancelAnimationFrame(raf) };
	}

	let mounted = $state(false);
	onMount(() => (mounted = true));
</script>

{#if mounted && toasts.length}
	<div class="pm-toasts" role="status" aria-live="polite">
		{#each toasts as t (t.id)}
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
			<div class="toast pm-toast" class:bad={t.bad} class:closable={t.canClose} onclick={() => t.canClose && dismissToast(t.id)} use:autoClose={t.id}>
				<span class="icon" aria-hidden="true">{t.bad ? '!' : '✓'}</span>
				<span class="text">{t.text}</span>
				{#if t.canClose}<span class="close" aria-hidden="true">×</span>{/if}
			</div>
		{/each}
	</div>
{/if}

<div id="notification-container">
	{#each notifications as n (n.id)}
		<div class="notification pm-notification">
			<img src={n.image} alt={n.text} width="250" />
			<p>{n.text}</p>
		</div>
	{/each}
</div>

<style>
	/* Toasts drop in under the header, top right on wide screens and full width on phones. */
	.pm-toasts {
		position: fixed;
		top: calc(var(--pm-bar-height) + 10px);
		right: 12px;
		/* Above the header and its panels (1000–1200), under the game's catch screen (1300). */
		z-index: 1250;
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: min(360px, calc(100vw - 24px));
	}
	.pm-toast {
		position: relative;
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		box-sizing: border-box;
		margin: 0;
		padding: 12px 14px 14px;
		overflow: hidden;
		border: 0;
		border-radius: 16px;
		background: var(--pm-paper);
		box-shadow: 0 12px 28px -12px oklch(0.3 0.04 265 / 0.45), 0 0 0 1px var(--pm-line);
		color: var(--pm-ink);
		font-family: var(--pm-body);
		font-size: 16px;
		font-weight: 600;
		line-height: 1.3;
		text-align: left;
		opacity: 0;
		transform: translateY(-12px);
		transition: transform 250ms cubic-bezier(0.25, 1, 0.5, 1), opacity 250ms ease-out;
	}
	.pm-toast:global(.show) {
		opacity: 1;
		transform: translateY(0);
	}
	/* Time left, as a thin bar along the bottom. */
	.pm-toast::before {
		content: '';
		position: absolute;
		left: 0;
		bottom: 0;
		width: calc(100% * var(--progress, 1));
		height: 4px;
		background: var(--pm-green);
	}
	.pm-toast.bad::before {
		background: var(--pm-red);
	}
	.icon {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: var(--pm-green-deep);
		color: var(--pm-paper);
		font-family: var(--pm-display);
		font-size: 16px;
	}
	.bad .icon {
		background: var(--pm-red);
	}
	.text {
		flex: 1;
		min-width: 0;
	}
	.close {
		flex-shrink: 0;
		color: var(--pm-ink-soft);
		font-size: 22px;
		line-height: 1;
	}
	.closable {
		cursor: pointer;
	}

	/* Prizes and achievements: a card that pops up in the middle of the screen for eight seconds. */
	.pm-notification {
		position: fixed;
		top: 50%;
		left: 50%;
		z-index: 100000;
		display: flex;
		flex-direction: column;
		align-items: center;
		width: min(320px, calc(100vw - 48px));
		padding: 24px 20px 20px;
		border: 0;
		border-radius: 24px;
		background: var(--pm-paper);
		box-shadow: 0 30px 60px -20px oklch(0.25 0.04 265 / 0.55), 0 0 0 3px var(--pm-gold);
		color: var(--pm-ink);
		opacity: 0;
		animation: pop 8s forwards;
	}
	.pm-notification img {
		width: 70%;
		height: auto;
		animation: wiggle 8s forwards;
	}
	.pm-notification p {
		margin: 14px 0 0;
		font-family: var(--pm-display);
		font-size: 22px;
		line-height: 1.2;
		text-align: center;
		animation: none;
	}
	@keyframes pop {
		0% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
		8% { opacity: 1; transform: translate(-50%, -50%) scale(1.03); }
		14%, 85% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
		100% { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
	}
	@keyframes wiggle {
		0% { transform: scale(0.8) rotate(0deg); }
		12% { transform: scale(1.1) rotate(8deg); }
		20%, 100% { transform: scale(1) rotate(0deg); }
	}
	@media (prefers-reduced-motion: reduce) {
		.pm-toast {
			transition: opacity 150ms linear;
			transform: none;
		}
		.pm-notification img {
			animation: none;
		}
	}
</style>
