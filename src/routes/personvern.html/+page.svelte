<script>
	import DataProcessing from '#lib/DataProcessing.svelte';
	import PrivacyNotice from '#lib/PrivacyNotice.svelte';
</script>

<svelte:head>
	<title>Personvern og databehandling – PokéMath</title>
	<meta name="description" content="Hvilke opplysninger PokéMath lagrer, hvor de ligger og hvem som behandler dem." />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="main pm-page">
	<h1 class="pm-title">Personvern og databehandling</h1>
	<p class="back"><a href="/">‹ Til PokéMath</a></p>

	<section id="dpa" class="panel pm-surface">
		<h2>Databehandling</h2>
		<DataProcessing privacyHref="#privacy" />
	</section>

	<section id="privacy" class="panel pm-surface">
		<h2>Personvernerklæring</h2>
		<PrivacyNotice dpaHref="#dpa" />
	</section>
</div>

<style>
	/* Bare pages have no header, so the body's room for it is given back. */
	:global(body) {
		padding-top: 16px;
	}
	.back {
		margin: -6px 0 16px;
	}
	.back a,
	.panel :global(a) {
		color: var(--pm-red-deep);
		font-weight: 600;
	}
	.panel {
		max-width: 760px;
		margin-bottom: 16px;
		padding: 20px 22px;
		line-height: 1.55;
	}
	h2 {
		margin: 0 0 10px;
		font-family: var(--pm-display);
		font-weight: 400;
		font-size: 26px;
	}
	.panel :global(h3) {
		margin: 18px 0 6px;
		font-size: 18px;
	}
	.panel :global(p) {
		margin: 0 0 10px;
	}
	.panel :global(ul) {
		margin: 0 0 10px;
		padding-left: 22px;
	}
</style>
