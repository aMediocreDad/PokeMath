<script>
	// Joining the teacher's bingo board, ported from static/bingo_join.html. The code is stored under
	// bingoJoinedCode (and the older bingoCode); the game page connects to the lobby from there.
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { code6, isUuidLike } from '#lib/bingo.js';
	import { generateUUID } from '#lib/uuid.js';

	let code = $state('');
	let student = $state('Ash');
	let uuid = $state('—');
	let status = $state(/** @type {{ msg: string, kind: string }} */ ({ msg: '', kind: 'info' }));
	let joining = $state(false);

	/** The id the bingo lobby knows the player by, kept under 'uuid' (getOrCreateUUID() on the legacy page). */
	function joinUUID() {
		for (const key of ['uuid', 'user_uuid', 'pokemath_uuid']) {
			const existing = localStorage.getItem(key);
			if (isUuidLike(existing)) {
				localStorage.setItem('uuid', /** @type {string} */ (existing));
				return /** @type {string} */ (existing);
			}
		}
		// crypto.randomUUID() needs iOS 15.4; school iPads can be older.
		const fresh = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : generateUUID();
		localStorage.setItem('uuid', fresh);
		return fresh;
	}

	/** From ?code=ABC123, or a path ending in the code. */
	function codeFromUrl() {
		const query = code6(new URLSearchParams(location.search).get('code'));
		if (query.length === 6) return query;
		const parts = location.pathname.split('/').filter(Boolean);
		const last = code6(parts[parts.length - 1] || '');
		return last.length === 6 ? last : '';
	}

	onMount(() => {
		uuid = joinUUID();
		student = (localStorage.getItem('username') || localStorage.getItem('playerName') || localStorage.getItem('name') || '').trim() || 'Ash';
		code = codeFromUrl() || code6(localStorage.getItem('bingoJoinedCode') || localStorage.getItem('bingoCode') || '');
	});

	function join() {
		const value = code6(code);
		if (value.length !== 6) {
			status = { msg: 'Skriv inn en gyldig kode (6 tegn).', kind: 'bad' };
			return;
		}
		localStorage.setItem('bingoJoinedCode', value);
		localStorage.setItem('bingoCode', value);
		status = { msg: 'Klar! Velg et trinn for å begynne å fange Pokémon.', kind: 'good' };
		joining = true;
		setTimeout(() => goto('/'), 800);
	}

	function clear() {
		code = '';
		localStorage.removeItem('bingoJoinedCode');
		localStorage.removeItem('bingoCode');
		status = { msg: '', kind: 'info' };
	}
</script>

<svelte:head>
	<title>PokeMath Bingo – Bli med</title>
</svelte:head>

<div class="main pm-page join">
	<section class="join-card pm-surface">
		<p class="kicker">🎲 PokeMath Bingo</p>
		<h1 class="pm-title">Bli med i bingo</h1>
		<p class="lead">Skriv inn koden du får av læreren. Du kan bytte kode når som helst.</p>

		<form
			class="code-row"
			onsubmit={(e) => {
				e.preventDefault();
				join();
			}}
		>
			<input
				id="code"
				type="text"
				maxlength="6"
				autocapitalize="characters"
				autocomplete="off"
				spellcheck="false"
				placeholder="ABC123"
				aria-label="Kode"
				value={code}
				oninput={(e) => (code = e.currentTarget.value = code6(e.currentTarget.value))}
			/>
			<button id="joinBtn" class="pm-button" type="submit" disabled={joining}>Koble til</button>
		</form>
		<p class="hint">6 tegn, bokstaver og tall.</p>

		<p id="status" class="status {status.kind}" role="status">{status.msg}</p>

		<div class="meta">
			<p>Du spiller som <b id="studentOut">{student}</b>.</p>
			{#if student === 'Ash'}<p class="small">Navnet hentes fra PokeMath. Sett et brukernavn på <a href="/player_profile.html">profilen din</a>.</p>{/if}
			<button id="clearBtn" class="pm-button small secondary" type="button" onclick={clear}>Tøm koden</button>
		</div>
	</section>

	<section class="how pm-surface">
		<h2>Hva skjer når jeg kobler til?</h2>
		<ul>
			<li>Du blir med i lærerens bingo-lobby.</li>
			<li>Når du fanger Pokémon i PokeMath, sendes fangsten automatisk til bingobrettet.</li>
			<li>Hvis fangsten passer en rute, krysses den av og ruten teller treff.</li>
		</ul>
		<p class="small uuid">Spiller-ID: <span id="uuidOut">{uuid}</span></p>
	</section>
</div>

<style>
	.join {
		max-width: 600px;
	}
	.join-card {
		padding: 24px;
		text-align: center;
	}
	.kicker {
		margin: 0;
		color: var(--pm-ink-soft);
		font-weight: 700;
	}
	.lead {
		margin: -8px 0 18px;
		color: var(--pm-ink-soft);
	}
	.code-row {
		display: flex;
		gap: 10px;
	}
	#code {
		flex: 1;
		min-width: 0;
		height: 56px;
		padding: 0 12px;
		border: 3px solid var(--pm-ink);
		border-radius: 14px;
		background: var(--pm-paper);
		color: var(--pm-ink);
		font-family: var(--pm-display);
		/* 16px or larger, or iOS zooms the page when the field is focused. */
		font-size: 30px;
		letter-spacing: 0.15em;
		text-align: center;
		outline: none;
	}
	#code::placeholder {
		color: var(--pm-line);
	}
	.hint {
		margin: 8px 0 0;
		color: var(--pm-ink-soft);
		font-size: 14px;
	}
	.status {
		min-height: 1.4em;
		margin: 12px 0 0;
		font-weight: 700;
	}
	.status.good {
		color: var(--pm-green-deep);
	}
	.status.bad {
		color: var(--pm-red-deep);
	}
	.meta {
		margin-top: 16px;
		padding-top: 14px;
		border-top: 1px solid var(--pm-line);
	}
	.meta p {
		margin: 0 0 8px;
	}
	.meta a {
		color: var(--pm-red-deep);
		font-weight: 700;
	}
	.small {
		color: var(--pm-ink-soft);
		font-size: 14px;
	}
	.how {
		margin-top: 14px;
		padding: 18px 22px;
	}
	.how h2 {
		margin: 0 0 8px;
		font-family: var(--pm-display);
		font-weight: 400;
		font-size: 20px;
	}
	.how ul {
		margin: 0 0 10px;
		padding-left: 20px;
		line-height: 1.5;
	}
	.uuid {
		margin: 0;
		overflow-wrap: anywhere;
	}
	@media (pointer: coarse) {
		.pm-button.small {
			min-height: 44px;
		}
	}
</style>
