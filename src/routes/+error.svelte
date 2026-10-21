<script>
	import { page } from '$app/state';
	import NotFound from '#lib/NotFound.svelte';
</script>

<svelte:head>
	<title>Pokémath - {page.status === 404 ? 'Page Not Found' : 'Feil'}</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if page.status === 404}
	<NotFound />
{:else}
	<div class="main pm-page">
		<h1 class="pm-title">Noe gikk galt</h1>
		<p>{page.error?.message}</p>
		<a class="pm-button" href="/">Tilbake til startsiden</a>
	</div>
{/if}
