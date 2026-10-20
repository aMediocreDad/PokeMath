<script>
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import Header from '#lib/Header.svelte';
	import Botbar from '#lib/Botbar.svelte';
	import { trackEvent } from '#lib/track.js';

	/** @type {{children: import('svelte').Snippet}} */
	let { children } = $props();

	onMount(() => trackEvent('/track-page', { page: page.url.pathname }));
</script>

<svelte:head>
	<!-- Linked rather than imported: the stylesheet points at images/ and fonts/, which are not in the repo. -->
	<link rel="stylesheet" href="/globalstyle.css?v=100" />
</svelte:head>

<div id="header"><Header /></div>

{@render children()}

<div id="botbar" class="botbar"><Botbar /></div>
