<script>
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import Header from '#lib/Header.svelte';
	import Botbar from '#lib/Botbar.svelte';
	import Toaster from '#lib/Toaster.svelte';
	import { player } from '#lib/player.svelte.js';
	import { loadAchievements } from '#lib/achievements.js';
	import { trackEvent } from '#lib/track.js';
	// Bundled with the site, so no pupil's browser has to ask a third party for it.
	import '@fontsource/lilita-one/400.css';

	/** @type {{children: import('svelte').Snippet}} */
	let { children } = $props();

	onMount(() => {
		player.load();
		loadAchievements();
	});

	// Once per page view, including navigation between Svelte pages.
	afterNavigate(({ to }) => {
		if (to) trackEvent('/track-page', { page: to.url.pathname });
	});
</script>

<svelte:head>
	<!-- Linked rather than imported: the stylesheet points at images/ and fonts/, which are not in the repo. -->
	<link rel="stylesheet" href="/globalstyle.css?v=100" />
</svelte:head>

<div id="header"><Header /></div>
<!-- Right below the header: globalstyle.css gives .toast-container "top: 50" without a unit,
     so toasts appear wherever the container sits in the page, as on the legacy pages. -->
<Toaster />

{@render children()}

<!-- A page can bring its own bottom bar (the Pokédex shows its counters there). -->
{#if !page.data.ownBotbar}
	<div id="botbar" class="pm-botbar"><Botbar /></div>
{/if}

<style>
	/*
	 * The look of the Svelte pages: a warm paper background, deep ink text and one accent, Pokédex
	 * red. Lilita One is the display face for numbers and headings; body text stays Source Sans.
	 */
	:global(:root) {
		--pm-red: oklch(0.59 0.2 27);
		--pm-red-deep: oklch(0.46 0.17 27);
		--pm-red-soft: oklch(0.93 0.04 27);
		--pm-ink: oklch(0.28 0.035 265);
		--pm-ink-soft: oklch(0.45 0.03 265);
		--pm-paper: oklch(0.995 0.004 85);
		--pm-cream: oklch(0.955 0.02 85);
		--pm-line: oklch(0.86 0.025 80);
		--pm-gold: oklch(0.83 0.15 85);
		--pm-green: oklch(0.7 0.17 145);
		--pm-green-deep: oklch(0.55 0.15 145);
		--pm-display: 'Lilita One', 'Source Sans Pro', system-ui, sans-serif;
		--pm-body: 'Source Sans Pro', system-ui, sans-serif;
		--pm-radius: 18px;
		--pm-shadow: 0 1px 0 oklch(0.86 0.025 80), 0 10px 24px -12px oklch(0.4 0.05 60 / 0.35);
		--pm-bar-height: 56px;
	}
	:global(body) {
		background: var(--pm-cream);
		color: var(--pm-ink);
		font-family: var(--pm-body);
		/* The header is fixed; keep content clear of it and of the bottom bar. */
		padding-top: var(--pm-bar-height);
		padding-bottom: 56px;
	}
	:global(.main) {
		margin-top: 0;
	}

	/* A chunky button that presses in, the one primary style. */
	:global(.pm-button) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-height: 48px;
		padding: 0 22px;
		border: none;
		border-radius: 14px;
		background: var(--pm-red);
		color: var(--pm-paper);
		font-family: var(--pm-display);
		font-size: 22px;
		letter-spacing: 0.01em;
		text-decoration: none;
		box-shadow: 0 4px 0 var(--pm-red-deep);
		cursor: pointer;
		transition: transform 80ms ease-out, box-shadow 80ms ease-out;
		touch-action: manipulation;
	}
	:global(.pm-button:active) {
		transform: translateY(3px);
		box-shadow: 0 1px 0 var(--pm-red-deep);
	}
	:global(.pm-button.secondary) {
		background: var(--pm-paper);
		color: var(--pm-ink);
		box-shadow: 0 0 0 2px var(--pm-line) inset, 0 4px 0 var(--pm-line);
	}
	:global(.pm-button.secondary:active) {
		box-shadow: 0 0 0 2px var(--pm-line) inset, 0 1px 0 var(--pm-line);
	}
	:global(.pm-button:focus-visible) {
		outline: 3px solid var(--pm-ink);
		outline-offset: 3px;
	}
	:global(.pm-button.small) {
		min-height: 40px;
		padding: 0 16px;
		border-radius: 12px;
		font-size: 18px;
	}
	:global(.pm-button.green) {
		background: var(--pm-green-deep);
		box-shadow: 0 4px 0 oklch(0.42 0.12 145);
	}
	/* Looks switched off but stays tappable, so a tap can say why (not enough coins, already owned). */
	:global(.pm-button.disabled) {
		background: var(--pm-line);
		color: var(--pm-ink-soft);
		box-shadow: 0 4px 0 oklch(0.76 0.03 80);
	}

	/* A coin and an amount, for prices. */
	:global(.pm-price) {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: var(--pm-display);
		font-size: 18px;
		white-space: nowrap;
	}
	:global(.pm-price::before) {
		content: '';
		width: 22px;
		height: 22px;
		background: url('/money.svg') center / contain no-repeat;
	}

	/* Page layout shared by the menu pages: a centred column with a big title. */
	:global(.pm-page) {
		max-width: 960px;
		margin: 0 auto;
		padding: 20px 16px 40px;
	}
	:global(.pm-title) {
		margin: 4px 0 18px;
		font-family: var(--pm-display);
		font-weight: 400;
		font-size: clamp(28px, 5vw, 38px);
		line-height: 1.1;
	}
	:global(.pm-section-title) {
		display: flex;
		align-items: baseline;
		gap: 10px;
		margin: 32px 0 12px;
		font-family: var(--pm-display);
		font-weight: 400;
		font-size: 24px;
	}
	:global(.pm-section-title small) {
		color: var(--pm-ink-soft);
		font-family: var(--pm-body);
		font-size: 15px;
	}
	:global(.pm-surface) {
		border-radius: var(--pm-radius);
		background: var(--pm-paper);
		box-shadow: var(--pm-shadow), 0 0 0 1px var(--pm-line);
	}

	/* The bottom bar: the connection light and, on the game page, the bingo code. */
	.pm-botbar {
		position: fixed;
		inset: auto 0 0 0;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 14px;
		background: var(--pm-paper);
		border-top: 1px solid var(--pm-line);
		z-index: 900;
	}

	/* Touch screens: the shared button styles are big enough for fingers (44px). */
	@media (pointer: coarse) {
		:global(button.button-1),
		:global(button.button-2),
		:global(label.button-1) {
			min-height: 44px;
		}
		/* No double-tap zoom when kids tap Kjøp or Oppgrader quickly. */
		:global(button),
		:global(.button-1),
		:global(.button-2) {
			touch-action: manipulation;
		}
		:global(a.button-1),
		:global(a.button-2) {
			padding-top: 13px;
			padding-bottom: 13px;
		}
	}
</style>
