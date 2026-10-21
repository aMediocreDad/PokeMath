<script>
	// The 404 page from static/notfound.html. The server sends notfound.html for unknown paths, and
	// once the app starts on such a path SvelteKit shows +error.svelte, which renders this too.
</script>

<div class="main pm-page notfound">
	<img src="/images/404.png" alt="Wobbuffet" width="240" />
	<h1 class="pm-title">Fant ikke siden</h1>
	<p>Vi klarte ikke å finne siden du leter etter, så du får se en Wobbuffet istedet.</p>
	<a class="pm-button" href="/">Tilbake til startsiden</a>
</div>

<style>
	.notfound {
		display: flex;
		flex-direction: column;
		align-items: center;
		max-width: 520px;
		text-align: center;
	}
	img {
		width: min(240px, 60vw);
		height: auto;
	}
	p {
		margin: -8px 0 20px;
		color: var(--pm-ink-soft);
		font-size: 18px;
	}
</style>
