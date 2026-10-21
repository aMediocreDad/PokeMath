<script>
	// Confirms a teacher's email from the link in the registration mail, ported from
	// static/verify-email.html.
	import { onMount } from 'svelte';
	import TeacherPage from '#lib/TeacherPage.svelte';

	/** @type {'loading' | 'success' | 'error'} */
	let phase = $state('loading');
	let name = $state('');
	let error = $state('');

	onMount(async () => {
		const token = (new URLSearchParams(location.search).get('token') || '').trim();
		if (!token) {
			error = 'Ingen bekreftelsestoken funnet i lenken.';
			phase = 'error';
			return;
		}
		try {
			const data = await fetch(`/teacher/verify-email?token=${encodeURIComponent(token)}`).then((r) => r.json());
			if (data.ok) {
				name = data.name || 'Lærer';
				phase = 'success';
			} else {
				error = data.message || 'Ugyldig eller allerede brukt lenke.';
				phase = 'error';
			}
		} catch (e) {
			error = 'Serverfeil: ' + /** @type {Error} */ (e).message;
			phase = 'error';
		}
	});
</script>

<svelte:head>
	<title>PokeMath – Bekreft e-post</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<TeacherPage subtitle="E-postbekreftelse" narrow>
	{#if phase === 'loading'}
		<section class="panel" id="loadingBox"><p>Bekrefter e-post…</p></section>
	{:else if phase === 'success'}
		<section class="panel" id="successBox">
			<h1>✅ E-post bekreftet!</h1>
			<p>Hei <strong id="teacherName">{name}</strong>,</p>
			<p>E-postadressen din er bekreftet. Kontoen din vil nå bli gjennomgått og godkjent av admin – du vil få en e-post når det er klart.</p>
			<div class="actions"><a class="pm-button small" href="/lærer/index.html">Gå til innlogging</a></div>
		</section>
	{:else}
		<section class="panel" id="errorBox">
			<h1>Noe gikk galt</h1>
			<p id="errorMsg" class="muted">{error}</p>
			<div class="actions"><a class="pm-button small secondary" href="/lærer/index.html">Tilbake til innlogging</a></div>
		</section>
	{/if}
</TeacherPage>
