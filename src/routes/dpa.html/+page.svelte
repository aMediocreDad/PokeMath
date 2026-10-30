<script>
	import DataProcessing from '#lib/DataProcessing.svelte';
</script>

<svelte:head>
	<title>Databehandling – PokéMath</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="main pm-page">
	<h1 class="pm-title">Databehandling</h1>
	<section class="panel pm-surface">
		<DataProcessing />
	</section>
</div>

<style>
	.panel {
		max-width: 760px;
		padding: 20px 22px;
		line-height: 1.55;
	}
</style>
