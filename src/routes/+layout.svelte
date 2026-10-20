<script>
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
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

{@render children()}

<div id="botbar" class="botbar"><Botbar /></div>

<Toaster />
