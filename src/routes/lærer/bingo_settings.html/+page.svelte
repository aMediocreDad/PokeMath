<script>
	// The bingo's setup moved onto the bingo screen (bingo_host.html), as the raid's is. Old links
	// and bookmarks land there.
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	onMount(() => goto('/lærer/bingo_host.html', { replaceState: true }));
</script>

<svelte:head>
	<title>Pokémath – Bingo</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>
