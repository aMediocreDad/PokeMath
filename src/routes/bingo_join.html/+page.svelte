<script>
	// Joining the teacher's class game (bingo or raid), ported from static/bingo_join.html. The code
	// is stored under bingoJoinedCode (and the older bingoCode); the game page connects from there.
	// Both games share the code, so this page does not need to know which one it is.
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { code6, isUuidLike } from '#lib/bingo.js';
	import { generateUUID } from '#lib/uuid.js';

	let code = $state('');
	let student = $state('Ash');
	let uuid = $state('—');
	let status = $state(/** @type {{ msg: string, kind: string }} */ ({ msg: '', kind: 'info' }));
	let joining = $state(false);
	/** Why this tab cannot see the player's save (live bingo_join.html, 2026-10). */
	let warning = $state(/** @type {{ title: string, body: string, canOpen: boolean } | null} */ (null));
	let copied = $state(false);
	/** The lobby this device is already in, when the page opened without a new code. */
	let joined = $state('');

	/**
	 * A QR code scanned with the camera can open the page in private mode, on another address, or
	 * in an isolated iOS tab. None of them can see the save, so the player would join as "Ash".
	 */
	function browserWarning() {
		try {
			localStorage.setItem('__pm_bw__', '1');
			localStorage.removeItem('__pm_bw__');
		} catch {
			return { title: 'Privat surfing er på', body: 'Nettleseren din blokkerer lagring i privat modus. Åpne et vanlig nettleservindu og gå til Pokémath der.', canOpen: false };
		}
		const hasPlayerData =
			['uuid', 'user_uuid', 'pokemath_uuid'].some((key) => isUuidLike(localStorage.getItem(key))) || !!(localStorage.getItem('username') || '').trim();
		if (hasPlayerData) return null;
		const urlCode = new URLSearchParams(location.search).get('code');
		if (urlCode === null && !/\/[A-Z0-9]{6}$/i.test(location.pathname)) return null;

		const h = location.hostname;
		if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h === 'localhost' || h.endsWith('.local') || location.protocol === 'http:') {
			const codeHint = urlCode ? ` Koden du skal skrive inn er: ${urlCode.toUpperCase()}.` : '';
			return {
				title: 'Feil adresse – data ikke tilgjengelig',
				body: `QR-koden peker til en lokal nettverksadresse (${location.host}), men Pokémath-dataen din er lagret på den vanlige adressen til siden. Bytt til Pokémath-fanen din og skriv inn koden manuelt der.${codeHint}`,
				canOpen: false
			};
		}
		const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
		if (!isIOS) return null;
		return {
			title: 'Data ikke tilgjengelig i denne fanen',
			body: 'Siden ble åpnet i en isolert nettleserkontekst (skjer ofte når QR-koder skannes med kameraet). Pokémath-dataen din ligger i en annen fane. Trykk «Åpne i nettleser» for å åpne siden på nytt med tilgang til profilen din, eller kopier lenken og lim den inn i adressefeltet.',
			canOpen: true
		};
	}

	function copyLink() {
		navigator.clipboard
			.writeText(location.href)
			.then(() => {
				copied = true;
				setTimeout(() => (copied = false), 2000);
			})
			.catch(() => prompt('Kopier lenken:', location.href));
	}

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
		const lastPart = parts[parts.length - 1] || '';
		// The page's own name is not a code: "bingo_join.html" would otherwise become "BINGOJ".
		if (lastPart.endsWith('.html')) return '';
		const last = code6(lastPart);
		return last.length === 6 ? last : '';
	}

	onMount(() => {
		// Before joinUUID(), which stores an id and would hide a missing save.
		warning = browserWarning();
		if (warning && !warning.canOpen && warning.title.startsWith('Privat')) {
			// localStorage throws here, so only the code from the address can be shown.
			code = codeFromUrl();
			return;
		}
		uuid = joinUUID();
		student = (localStorage.getItem('username') || localStorage.getItem('playerName') || localStorage.getItem('name') || '').trim() || 'Ash';
		const stored = code6(localStorage.getItem('bingoJoinedCode') || localStorage.getItem('bingoCode') || '');
		const fromUrl = codeFromUrl();
		code = fromUrl || stored;
		if (stored.length === 6 && (!fromUrl || fromUrl === stored)) joined = stored;
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
		joined = '';
		localStorage.removeItem('bingoJoinedCode');
		localStorage.removeItem('bingoCode');
		status = { msg: 'Du er ikke lenger med i spillet.', kind: 'info' };
	}
</script>

<svelte:head>
	<title>PokéMath – Bli med i klassespill</title>
</svelte:head>

<div class="main pm-page join">
	<section class="join-card pm-surface">
		<p class="kicker">🎲 Klassespill</p>
		{#if joined}
			<h1 class="pm-title">Du er med!</h1>
			<p class="lead">Du er med i spillet <b id="joinedCode">{joined}</b>. Spill som vanlig: det du gjør, teller for klassen.</p>
			<div class="joined-actions">
				<a class="pm-button" id="playBtn" href="/">Fortsett å spille</a>
				<button id="clearBtn" class="pm-button secondary" type="button" onclick={clear}>Forlat spillet</button>
			</div>
			<p class="hint">Fått en ny kode? Forlat spillet først, og skriv inn den nye.</p>
		{:else}
			<h1 class="pm-title">Bli med i klassespill</h1>
			<p class="lead">Skriv inn koden du får av den voksne som styrer spillet.</p>
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
				<button id="joinBtn" class="pm-button" type="submit" disabled={joining}>Bli med</button>
			</form>
			<p class="hint">6 tegn, bokstaver og tall.</p>
		{/if}
		<p id="status" class="status {status.kind}" role="status">{status.msg}</p>
		<div class="meta">
			<p>Du spiller som <b id="studentOut">{student}</b>.</p>
			{#if student === 'Ash'}<p class="small">Navnet hentes fra Pokémath. Sett et brukernavn på <a href="/player_profile.html">profilen din</a>.</p>{/if}
		</div>
	</section>
	<section class="how pm-surface">
		<h2>Hva skjer når jeg kobler til?</h2>
		<ul>
			<li>Du blir med i spillet læreren styrer, og spiller PokéMath som vanlig.</li>
			<li><b>Bingo:</b> Pokémon du fanger, sendes til bingobrettet. Passer fangsten en rute, krysses den av.</li>
			<li><b>Raid:</b> hvert riktige svar er et treff på bossen. Når den er beseiret, fanger alle som var med den.</li>
		</ul>
		<details class="small uuid">
			<summary>Teknisk informasjon</summary>
			Spiller-ID: <span id="uuidOut">{uuid}</span>
		</details>
	</section>
</div>

{#if warning}
	<div id="browser-warning" class="backdrop">
		<div class="warning pm-surface" role="dialog" aria-labelledby="bw-title">
			<div class="lock" aria-hidden="true">🔒</div>
			<h2 id="bw-title">{warning.title}</h2>
			<p id="bw-body">{warning.body}</p>
			{#if warning.canOpen}
				<a id="bw-open" class="pm-button" href={location.href} target="_blank" rel="noopener">Åpne i nettleser</a>
			{/if}
			<label class="copy-label" for="bw-url">Eller kopier og lim inn denne lenken i nettleseren:</label>
			<div class="copy-row">
				<input id="bw-url" readonly type="text" value={location.href} onfocus={(e) => e.currentTarget.select()} />
				<button id="bw-copy" class="pm-button small secondary" type="button" onclick={copyLink}>{copied ? 'Kopiert!' : 'Kopier'}</button>
			</div>
			<button id="bw-dismiss" class="dismiss" type="button" onclick={() => (warning = null)}>Fortsett uansett</button>
		</div>
	</div>
{/if}

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
	.uuid summary {
		cursor: pointer;
	}
	.joined-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 10px;
	}
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 1200;
		display: grid;
		place-items: center;
		padding: 16px;
		background: oklch(0.28 0.035 265 / 0.55);
	}
	.warning {
		box-sizing: border-box;
		width: min(400px, 100%);
		padding: 24px 22px 16px;
		text-align: center;
	}
	.lock {
		font-size: 40px;
	}
	.warning h2 {
		margin: 4px 0 10px;
		font-family: var(--pm-display);
		font-weight: 400;
		font-size: 22px;
	}
	.warning p {
		margin: 0 0 18px;
		line-height: 1.5;
	}
	#bw-open {
		display: block;
		margin-bottom: 14px;
	}
	.copy-label {
		display: block;
		margin-bottom: 6px;
		color: var(--pm-ink-soft);
		font-size: 14px;
		text-align: left;
	}
	.copy-row {
		display: flex;
		gap: 8px;
	}
	#bw-url {
		flex: 1;
		min-width: 0;
		padding: 8px 10px;
		border: 2px solid var(--pm-line);
		border-radius: 10px;
		background: var(--pm-paper);
		color: var(--pm-ink);
		font-family: monospace;
		/* 16px or larger, or iOS zooms the page when the field is focused. */
		font-size: 16px;
	}
	.dismiss {
		min-height: 44px;
		margin-top: 8px;
		border: 0;
		background: none;
		color: var(--pm-ink-soft);
		font: inherit;
		font-size: 15px;
		text-decoration: underline;
		cursor: pointer;
	}
	@media (pointer: coarse) {
		.pm-button.small {
			min-height: 44px;
		}
	}
</style>
