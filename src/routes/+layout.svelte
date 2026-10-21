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
	<div id="botbar" class="botbar"><Botbar /></div>
{/if}

<style>
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
