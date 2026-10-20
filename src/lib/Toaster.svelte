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
	<div class="toast-container" data-position="top-right">
		{#each toasts as t (t.id)}
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
			<div
				class="toast progress"
				class:badToast={t.bad}
				class:goodToast={!t.bad}
				class:can-close={t.canClose}
				onclick={() => t.canClose && dismissToast(t.id)}
				use:autoClose={t.id}
			>
				{t.text}
			</div>
		{/each}
	</div>
{/if}

<div id="notification-container">
	{#each notifications as n (n.id)}
		<div class="notification">
			<img src={n.image} alt={n.text} width="250" />
			<p>{n.text}</p>
		</div>
	{/each}
</div>
