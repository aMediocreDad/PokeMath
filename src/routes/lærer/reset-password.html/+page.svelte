<script>
	// Choose a new password from the emailed link, ported from static/lærer/reset-password.html.
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import TeacherPage from '#lib/TeacherPage.svelte';

	let token = $state('');
	let invalid = $state(false);
	let pw1 = $state('');
	let pw2 = $state('');
	let status = $state(/** @type {{ msg: string, kind?: string }} */ ({ msg: '' }));
	let saving = $state(false);
	let done = $state(false);

	onMount(() => {
		token = (new URLSearchParams(location.search).get('token') || '').trim();
		if (!token) invalid = true;
	});

	async function submit() {
		if (pw1.length < 8) return (status = { msg: 'Passordet må være minst 8 tegn.', kind: 'bad' });
		if (pw1 !== pw2) return (status = { msg: 'Passordene er ikke like.', kind: 'bad' });
		saving = true;
		status = { msg: '' };
		try {
			const r = await fetch('/teacher/reset-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token, password: pw1 })
			});
			const d = await r.json();
			if (!d.ok) {
				if (r.status === 400 && d.message?.includes('ugyldig')) return (invalid = true);
				status = { msg: d.message || 'Noe gikk galt.', kind: 'bad' };
				saving = false;
				return;
			}
			status = { msg: d.message, kind: 'good' };
			done = true;
			setTimeout(() => goto('/lærer/index.html'), 2500);
		} catch {
			status = { msg: 'Nettverksfeil. Prøv igjen.', kind: 'bad' };
			saving = false;
		}
	}

	/** @param {KeyboardEvent} e */
	const onKey = (e) => e.key === 'Enter' && submit();
</script>

<svelte:head>
	<title>PokeMath – Tilbakestill passord</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<TeacherPage subtitle="Tilbakestill passord" back={{ href: '/lærer/index.html', label: 'Til innlogging' }} narrow>
	{#if invalid}
		<section class="panel" id="invalidBox">
			<h2>Ugyldig eller utløpt link</h2>
			<p class="muted">Denne reset-linken er ikke lenger gyldig (utløper etter 1 time).</p>
			<div class="actions"><a class="pm-button small" href="/lærer/index.html">Gå til innlogging</a></div>
		</section>
	{:else}
		<section class="panel" id="resetBox">
			<h2>Velg nytt passord</h2>
			<p class="muted">Passordet må være minst 8 tegn.</p>
			<div class="form-grid">
				<label class="field">
					<span>Nytt passord</span>
					<input id="pw1" type="password" autocomplete="new-password" placeholder="Minst 8 tegn" bind:value={pw1} onkeydown={onKey} />
				</label>
				<label class="field">
					<span>Bekreft passord</span>
					<input id="pw2" type="password" autocomplete="new-password" placeholder="Gjenta passordet" bind:value={pw2} onkeydown={onKey} />
				</label>
			</div>
			{#if !done}
				<div class="actions">
					<button class="pm-button small" id="submitBtn" disabled={saving} onclick={submit}>{saving ? 'Lagrer…' : 'Lagre nytt passord'}</button>
				</div>
			{/if}
			<div class="status {status.kind ?? ''}" id="resetStatus" role="status">{status.msg}</div>
		</section>
	{/if}
</TeacherPage>
