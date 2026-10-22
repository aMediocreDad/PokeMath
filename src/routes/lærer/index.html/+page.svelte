<script>
	// The teacher start page, ported from static/lærer/index.html and teacher.js: log in, register,
	// reset a forgotten password, and once logged in start bingo, see the shared secret codes and
	// make new ones.
	import { onMount } from 'svelte';
	import TeacherPage from '#lib/TeacherPage.svelte';
	import { apiJson, authHeaders, setTeacherSession, validateSession } from '#lib/teacher.js';

	/** @typedef {{ msg: string, kind?: 'good' | 'bad' | '' }} Status */
	/** @type {Status} */ const NONE = { msg: '' };

	let teacher = $state(/** @type {import('#lib/teacher.js').Teacher | null} */ (null));
	/** Until the stored session is checked, show neither the login nor the session. */
	let checked = $state(false);

	let loginEmail = $state('');
	let loginPassword = $state('');
	let loginStatus = $state(NONE);

	let reg = $state({ name: '', email: '', password: '', county: '', municipality: '', schoolName: '', howFound: '' });
	let registerStatus = $state(NONE);

	let forgotOpen = $state(false);
	let forgotEmail = $state('');
	let forgotStatus = $state(NONE);

	let deleteStatus = $state(NONE);
	let deleting = $state(false);
	/** The lobby the host page is running, so the teacher can go back to it. */
	let savedBingoCode = $state('');

	onMount(async () => {
		const t = await validateSession();
		// Drop an invalid token, so the page is not misleading.
		if (!t) setTeacherSession('');
		teacher = t;
		checked = true;
		savedBingoCode = (localStorage.getItem('teacherBingoCode') || '').toUpperCase().trim();
	});

	const sessionHint = $derived(
		teacher?.exp ? `Sesjon utløper: ${new Date(teacher.exp).toLocaleString('no-NO', { hour12: false })}` : ''
	);

	async function login() {
		loginStatus = { msg: 'Logger inn…' };
		try {
			const data = await apiJson('/teacher/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: loginEmail.trim().toLowerCase(), password: loginPassword })
			});
			if (!data.ok) throw new Error(data.message || 'Kunne ikke logge inn.');
			setTeacherSession(data.teacherSession);
			const t = await validateSession();
			if (!t) throw new Error('Sesjonen var ikke gyldig etter innlogging.');
			loginStatus = NONE;
			forgotOpen = false;
			teacher = t;
		} catch (e) {
			loginStatus = { msg: /** @type {Error} */ (e).message, kind: 'bad' };
		}
	}

	function logout() {
		setTeacherSession('');
		teacher = null;
		codesOpen = false;
		createOpen = false;
	}

	async function register() {
		registerStatus = { msg: 'Sender registrering…' };
		try {
			const payload = {
				name: reg.name.trim(),
				email: reg.email.trim().toLowerCase(),
				password: reg.password,
				county: reg.county.trim(),
				municipality: reg.municipality.trim(),
				schoolName: reg.schoolName.trim(),
				howFound: reg.howFound.trim()
			};
			const data = await apiJson('/teacher/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			registerStatus = { msg: data.message || 'Registrert!', kind: 'good' };
		} catch (e) {
			registerStatus = { msg: /** @type {Error} */ (e).message, kind: 'bad' };
		}
	}

	function openForgot() {
		forgotEmail = loginEmail.trim();
		forgotStatus = NONE;
		forgotOpen = true;
	}

	function closeForgot() {
		forgotOpen = false;
		forgotStatus = NONE;
	}

	async function sendForgot() {
		forgotStatus = { msg: 'Sender forespørsel…' };
		try {
			const data = await apiJson('/teacher/forgot-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: forgotEmail.trim().toLowerCase() })
			});
			forgotStatus = { msg: data.message || 'Forespørsel registrert. Du vil snart motta en e-post.', kind: 'good' };
		} catch (e) {
			forgotStatus = { msg: /** @type {Error} */ (e).message, kind: 'bad' };
		}
	}

	async function deleteAccount() {
		if (!confirm('Er du sikker på at du vil slette kontoen din permanent? Dette kan ikke angres.')) return;
		deleteStatus = { msg: 'Sletter konto…' };
		deleting = true;
		try {
			const data = await apiJson('/teacher/account', { method: 'DELETE', headers: authHeaders() });
			if (!data.ok) throw new Error(data.message || 'Noe gikk galt.');
			setTeacherSession('');
			deleteStatus = { msg: 'Konto slettet.', kind: 'good' };
			setTimeout(() => {
				teacher = null;
				deleteStatus = NONE;
				deleting = false;
			}, 2500);
		} catch (e) {
			deleteStatus = { msg: /** @type {Error} */ (e).message, kind: 'bad' };
			deleting = false;
		}
	}

	// ── The code overview ──
	const PRIZE_LABELS = /** @type {Record<string, string>} */ ({
		coins: 'Mynter',
		pokemon: 'Pokémon',
		random_legendary: 'Tilfeldig legendarisk',
		random_mythic: 'Tilfeldig mytisk',
		random_shiny: 'Tilfeldig shiny',
		random_shiny_mythic: 'Tilfeldig shiny mytisk',
		message: 'Melding',
		fireworks: 'Fyrverkeri'
	});

	/** @typedef {{ plaintext_code: string, label: string, prize_type: string, prize_value: string | number | null, prize_image: string | null, repeatable: boolean }} Code */
	let codesOpen = $state(false);
	/** @type {Code[] | null} null while loading */
	let codes = $state(null);
	let codesError = $state('');
	/** Codes are blurred until tapped, so a projected screen does not give them away. */
	let revealed = $state(/** @type {Record<number, boolean>} */ ({}));

	async function toggleCodes() {
		codesOpen = !codesOpen;
		if (!codesOpen) return;
		codes = null;
		codesError = '';
		revealed = {};
		try {
			const data = await apiJson('/teacher/codes', { headers: authHeaders() });
			codes = data.ok ? data.codes : [];
		} catch (e) {
			codesError = /** @type {Error} */ (e).message;
			codes = [];
		}
	}

	/** @param {Code} c */
	function codeExtra(c) {
		if (c.prize_type === 'coins') return ` (${Number(c.prize_value).toLocaleString('no-NO')} kr)`;
		if (c.prize_type === 'pokemon') return ` (${c.prize_value})`;
		return '';
	}

	// ── Making a code ──
	const IMAGES = [
		{ group: 'Mynter', items: [['images/events/christmas/14.png', 'Myntpose']] },
		{
			group: 'Ikoner',
			items: [
				['images/under_construction.png', 'Under konstruksjon'],
				['images/hisuian_ball.png', 'Hisui-ball'],
				['images/gigantamax.png', 'Gigantamax'],
				['images/mega.png', 'Mega'],
				['images/up-arrow.png', 'Pil opp'],
				['images/smartphone.png', 'Smarttelefon'],
				['images/shinycharm.png', 'Shiny Charm'],
				['images/player.png', 'Spiller (gutt)'],
				['images/player-fem.png', 'Spiller (jente)'],
				['images/lure_legend.svg', 'Agn (legendarie)'],
				['images/lure.svg', 'Agn'],
				['images/gear.png', 'Tannhjul'],
				['images/compass.png', 'Kompass'],
				['images/down-arrow.png', 'Pil ned'],
				['images/coinbag.svg', 'Myntpose 2'],
				['images/backpack.png', 'Ryggsekk']
			]
		},
		{ group: 'Annet', items: [['images/logo.png', 'PokeMath-logo']] }
	];
	const NEEDS_VALUE = ['coins', 'pokemon'];

	let createOpen = $state(false);
	let tc = $state({ code: '', label: '', type: 'coins', value: '', image: '', repeatable: false });
	let createStatus = $state(NONE);
	let saving = $state(false);

	// Only plain messages may be used more than once.
	$effect(() => {
		if (tc.type !== 'message') tc.repeatable = false;
	});

	/** @type {Record<string, any> | null} pokemon_info.json, loaded when a variant needs checking */
	let pkInfo = null;
	async function loadPkInfo() {
		if (pkInfo) return;
		try {
			pkInfo = await fetch('/pokemon_info.json').then((r) => r.json());
		} catch {
			pkInfo = {};
		}
	}

	/** @param {Status} status */
	const fail = (status) => ((createStatus = status), false);

	/** The checks from teacher.js, in the same order. */
	async function validCode() {
		const { code, label, type, value } = tc;
		if (!code.trim() || !label.trim() || !type) return fail({ msg: 'Fyll inn kode, label og premie-type.', kind: 'bad' });
		const v = value.trim();
		if (type === 'coins') {
			const amount = Number(v);
			if (!v || isNaN(amount) || amount <= 0) return fail({ msg: 'Skriv inn et gyldig beløp (1–50 000).', kind: 'bad' });
			if (amount > 50000) return fail({ msg: 'Maks 50 000 mynter per kode.', kind: 'bad' });
		}
		if (type === 'pokemon') {
			if (!v) return fail({ msg: 'Skriv inn en Pokémon-kode (f.eks. N25 eller S150).', kind: 'bad' });
			if (/U/i.test(v)) return fail({ msg: 'Unike Pokémon (U-varianter) kan ikke brukes som kode-premie.', kind: 'bad' });
			if (!/^[NSns]\d+(-[A-Z]?\d+)?$/i.test(v))
				return fail({
					msg: 'Ugyldig Pokémon-kode. Bruk N{id} for normal eller S{id} for shiny, f.eks. N25, S150, N25-U1.',
					kind: 'bad'
				});
			const parts = v.replace(/^[NSns]/, '').split('-');
			const baseId = Number(parts[0]);
			if (baseId < 1 || baseId > 1100) return fail({ msg: 'Pokémon-ID må være mellom 1 og 1100.', kind: 'bad' });
			if (parts.length > 1) {
				const variant = parts[1].toUpperCase();
				createStatus = { msg: 'Sjekker variant…' };
				await loadPkInfo();
				if (!pkInfo?.[String(baseId)]?.[variant])
					return fail({ msg: `Variant -${variant} finnes ikke for Pokémon #${baseId}. Sjekk koden og prøv igjen.`, kind: 'bad' });
			}
		}
		return true;
	}

	async function createCode() {
		if (!(await validCode())) return;
		createStatus = { msg: 'Lagrer…' };
		saving = true;
		try {
			const value = tc.value.trim();
			const data = await apiJson('/teacher/codes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', ...authHeaders() },
				body: JSON.stringify({
					plaintext_code: tc.code.trim(),
					label: tc.label.trim(),
					prize_type: tc.type,
					prize_value: value || null,
					prize_image: tc.image || null,
					repeatable: tc.type === 'message' ? tc.repeatable : false,
					teacher_visible: true
				})
			});
			createStatus = { msg: '✅ Kode lagret!', kind: 'good' };
			tc = { ...tc, code: '', label: '', value: '', image: '' };
			if (teacher) teacher = { ...teacher, code_tokens: data.code_tokens ?? undefined };
		} catch (e) {
			createStatus = { msg: /** @type {Error} */ (e).message, kind: 'bad' };
		} finally {
			saving = false;
		}
	}

	/** @param {KeyboardEvent} event @param {() => void} action */
	const onEnter = (event, action) => event.key === 'Enter' && action();
</script>

<svelte:head>
	<title>PokeMath – Lærer (Bingo)</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#snippet status(/** @type {Status} */ s, /** @type {string} */ id)}
	<div class="status {s.kind ?? ''}" {id} role="status">{s.msg}</div>
{/snippet}

<TeacherPage subtitle="Bingo (eksperiment)" back={{ href: '/index.html', label: 'Til PokeMath' }}>
	<section class="panel warn">
		<h1>Bingo er et eksperiment</h1>
		<p>
			Denne lærerfunksjonen er kun ment for voksne. Ikke del sensitiv informasjon. Data lagres hos Cloudflare i Europa.
		</p>
	</section>

	{#if teacher}
		<section class="panel" id="sessionBox">
			<h2>Du er logget inn</h2>
			<div class="session-row">
				<div>
					<div class="big" id="who">Du er logget inn som {teacher.name || 'Lærer'}.</div>
					<div class="muted" id="whoEmail">{teacher.email || ''}</div>
				</div>
				<button class="pm-button small danger" id="logoutBtn" onclick={logout}>Logg ut</button>
			</div>
			<div class="actions">
				<a class="pm-button" id="startBingoBtn" href="/lærer/bingo_settings.html">Ny Bingo</a>
				{#if savedBingoCode.length === 6}
					<a class="pm-button secondary" id="continueBingoBtn" href="/lærer/bingo_host.html">Fortsett Bingo {savedBingoCode}</a>
				{/if}
				<button class="pm-button small secondary" id="showCodesBtn" onclick={toggleCodes}>🔑 {codesOpen ? 'Skjul koder' : 'Kodeoversikt'}</button>
				<button class="pm-button small secondary" id="showCreateCodeBtn" onclick={() => (createOpen = !createOpen)}>➕ {createOpen ? 'Skjul' : 'Lag kode'}</button>
			</div>
			<div class="muted small" id="sessionHint">{sessionHint}</div>
		</section>

		{#if createOpen}
			<section class="panel" id="createCodePanel">
				<h2>➕ Lag en hemmelig kode</h2>
				<p class="muted">
					Du kan lage koder som alle elever kan bruke på redeem-siden. Du har <strong id="tokenCount">{teacher.code_tokens ?? '?'}</strong> token(s) igjen.
				</p>
				<div class="form-grid">
					<label class="field">
						<span>Kode (det elevene skriver)</span>
						<input id="tcCode" type="text" maxlength="100" placeholder="f.eks. Sommerfuglen2025" bind:value={tc.code} />
					</label>
					<label class="field">
						<span>Tekst som vises (label)</span>
						<input id="tcLabel" type="text" maxlength="200" placeholder="f.eks. 50 000 Mynter!" bind:value={tc.label} />
					</label>
					<label class="field">
						<span>Premie-type</span>
						<select id="tcType" bind:value={tc.type}>
							<option value="coins">Mynter (maks 50 000)</option>
							<option value="pokemon">Spesifikk Pokémon</option>
							<option value="random_legendary">Tilfeldig legendarisk</option>
							<option value="random_mythic">Tilfeldig mytisk</option>
							<option value="random_shiny">Tilfeldig shiny</option>
							<option value="random_shiny_mythic">Tilfeldig shiny mytisk</option>
							<option value="message">Kun melding / overlay</option>
							<option value="fireworks">Fyrverkeri</option>
						</select>
					</label>
					{#if NEEDS_VALUE.includes(tc.type)}
						<label class="field" id="tcValueField">
							<span id="tcValueLabel">{tc.type === 'coins' ? 'Beløp (maks 50 000)' : 'Pokémon-kode'}</span>
							<input id="tcValue" type="text" placeholder={tc.type === 'coins' ? 'f.eks. 10000' : 'f.eks. N25 eller S150'} bind:value={tc.value} />
							{#if tc.type === 'pokemon'}
								<small id="tcValueHint">
									Pokémon-kode: <strong>N{'{id}'}</strong> for normal, <strong>S{'{id}'}</strong> for shiny. Eksempel: <code>N25</code> = Pikachu,
									<code>S150</code> = Shiny Mewtwo, <code>N6-1</code> = Mega Charizard X. Unike Pokémon (U-varianter) er ikke tillatt.
								</small>
							{/if}
						</label>
					{/if}
					<label class="field wide">
						<span>Bilde i overlay</span>
						<span class="image-row">
							<select id="tcImage" bind:value={tc.image}>
								<option value="">{tc.type === 'pokemon' ? 'Bruk pokemonens bilde' : 'Ingen bilde'}</option>
								{#each IMAGES as group (group.group)}
									<optgroup label={group.group}>
										{#each group.items as [src, name] (src)}<option value={src}>{name}</option>{/each}
									</optgroup>
								{/each}
							</select>
							{#if tc.image}<img id="tcImagePreview" src="/{tc.image}" alt="" />{/if}
						</span>
					</label>
					{#if tc.type === 'message'}
						<label class="check" id="tcRepeatableRow">
							<input type="checkbox" id="tcRepeatable" bind:checked={tc.repeatable} /> Kan brukes flere ganger
						</label>
					{/if}
				</div>
				<div class="actions">
					<button class="pm-button small" id="createTeacherCodeBtn" disabled={saving} onclick={createCode}>Lagre kode</button>
				</div>
				{@render status(createStatus, 'createCodeStatus')}
			</section>
		{/if}

		{#if codesOpen}
			<section class="panel" id="codesPanel">
				<h2>🔑 Kodeoversikt</h2>
				<p class="muted">Aktive hemmelige koder som PokeMorten har gjort synlige for lærere. Trykk på en kode for å se den.</p>
				<div id="codesList">
					{#if codes === null}
						Laster…
					{:else if codesError}
						<p class="muted bad">Feil: {codesError}</p>
					{:else if codes.length === 0}
						<p class="muted">Ingen synlige koder for øyeblikket.</p>
					{:else}
						{#each codes as c, i (i)}
							<div class="code-row">
								{#if c.prize_image}<img src="/{c.prize_image.replace(/^\//, '')}" alt="" />{/if}
								<div>
									<button class="code-blur" class:shown={revealed[i]} aria-pressed={!!revealed[i]} onclick={() => (revealed[i] = !revealed[i])}>
										{c.plaintext_code}
									</button>
									<div class="code-meta">
										{c.label} · {PRIZE_LABELS[c.prize_type] || c.prize_type}{codeExtra(c)} · {c.repeatable ? 'Kan brukes flere ganger' : 'Engangs'}
									</div>
								</div>
							</div>
						{/each}
					{/if}
				</div>
			</section>
		{/if}

		<section class="panel">
			<details>
				<summary>Kontoinnstillinger</summary>
				<p class="muted small">Sletting er permanent. Kontoen og all tilhørende data fjernes fra databasen.</p>
				<div class="actions">
					<button class="pm-button small danger" id="deleteAccountBtn" disabled={deleting} onclick={deleteAccount}>Slett kontoen min</button>
				</div>
				{@render status(deleteStatus, 'deleteStatus')}
			</details>
		</section>
	{:else if checked}
		<section class="panel" id="loginBox">
			<h2>Logg inn</h2>
			<div class="form-grid">
				<label class="field">
					<span>E-post</span>
					<input id="loginEmail" type="email" autocomplete="email" placeholder="navn@skole.no" bind:value={loginEmail} onkeydown={(e) => onEnter(e, login)} />
				</label>
				<label class="field">
					<span>Passord</span>
					<input id="loginPassword" type="password" autocomplete="current-password" placeholder="••••••••" bind:value={loginPassword} onkeydown={(e) => onEnter(e, login)} />
				</label>
			</div>
			<div class="actions">
				<button class="pm-button small" id="loginBtn" onclick={login}>Logg inn</button>
				<button class="pm-button small secondary" id="forgotBtn" onclick={openForgot}>Glemt passord</button>
			</div>
			{@render status(loginStatus, 'loginStatus')}
		</section>

		<section class="panel" id="registerBox">
			<h2>Registrer lærer</h2>
			<p class="muted">Velg et unikt passord du husker. Sikkerheten er enkel (ingen automatisk reset), men passord blir hashet på server.</p>
			<div class="form-grid">
				<label class="field"><span>Fornavn</span><input id="regName" type="text" maxlength="40" placeholder="F.eks. Morten" bind:value={reg.name} /></label>
				<label class="field"><span>E-post</span><input id="regEmail" type="email" autocomplete="email" placeholder="navn@skole.no" bind:value={reg.email} /></label>
				<label class="field">
					<span>Passord (min. 8 tegn)</span>
					<input id="regPassword" type="password" autocomplete="new-password" placeholder="Lag noe unikt" bind:value={reg.password} />
					<small>Bruk et passord du ikke bruker andre steder.</small>
				</label>
				<label class="field"><span>Fylke</span><input id="regCounty" type="text" maxlength="60" placeholder="F.eks. Kanto" bind:value={reg.county} /></label>
				<label class="field"><span>Kommune</span><input id="regMunicipality" type="text" maxlength="60" placeholder="F.eks. Pallet Town" bind:value={reg.municipality} /></label>
				<label class="field"><span>Skolenavn</span><input id="regSchool" type="text" maxlength="80" placeholder="F.eks. Pallet Town School of Rock" bind:value={reg.schoolName} /></label>
				<label class="field wide">
					<span>Hvordan fant du ut om lærerpålogging?</span>
					<input id="regHow" type="text" maxlength="120" placeholder="F.eks. kollega / facebook / møtte PokeMorten på by'n" bind:value={reg.howFound} />
				</label>
			</div>
			<div class="actions">
				<button class="pm-button small" id="registerBtn" onclick={register}>Send registrering</button>
			</div>
			{@render status(registerStatus, 'registerStatus')}
		</section>
	{/if}
</TeacherPage>

{#if forgotOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div id="forgotBox" class="modal-overlay" onclick={(e) => e.target === e.currentTarget && closeForgot()}>
		<div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="forgot-title">
			<h2 id="forgot-title">Glemt passord</h2>
			<p class="muted">Denne kopien av PokeMath sender ikke e-post. Skriv inn e-posten din, og be den som drifter siden om lenken. Den er gyldig i 1 time.</p>
			<label class="field">
				<span>E-post</span>
				<input id="forgotEmail" type="email" autocomplete="email" placeholder="navn@skole.no" bind:value={forgotEmail} onkeydown={(e) => onEnter(e, sendForgot)} />
			</label>
			<div class="actions">
				<button class="pm-button small" id="forgotSendBtn" onclick={sendForgot}>Send forespørsel</button>
				<button class="pm-button small secondary" id="forgotCloseBtn" onclick={closeForgot}>Lukk</button>
			</div>
			{@render status(forgotStatus, 'forgotStatus')}
		</div>
	</div>
{/if}

<style>
	.session-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.session-row .pm-button {
		flex-shrink: 0;
		white-space: nowrap;
	}
	.big {
		font-size: 18px;
		font-weight: 700;
	}
	.wide {
		grid-column: 1 / -1;
	}
	.image-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.image-row select {
		flex: 1;
	}
	.image-row img {
		width: 44px;
		height: 44px;
		object-fit: contain;
		border-radius: 8px;
		background: var(--pm-cream);
	}
	.check {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 44px;
		font-weight: 700;
		cursor: pointer;
	}
	.check input {
		width: 20px;
		height: 20px;
	}
	.code-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 0;
		border-bottom: 1px solid var(--pm-line);
	}
	.code-row img {
		width: 40px;
		height: 40px;
		object-fit: contain;
	}
	/* Blurred until tapped: hover alone never reveals it on a touch screen. */
	.code-blur {
		min-height: 32px;
		padding: 0;
		border: none;
		background: none;
		color: var(--pm-ink);
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 16px;
		font-weight: 700;
		filter: blur(5px);
		cursor: pointer;
		transition: filter 0.2s ease;
	}
	.code-blur.shown {
		filter: none;
		user-select: text;
	}
	.code-meta {
		color: var(--pm-ink-soft);
		font-size: 14px;
	}
	.bad {
		color: var(--pm-red-deep);
	}
	summary {
		min-height: 32px;
		color: var(--pm-ink-soft);
		font-weight: 700;
		cursor: pointer;
	}

	.modal-overlay {
		position: fixed;
		inset: 0;
		z-index: 1500;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
		background: oklch(0.2 0.03 265 / 0.5);
	}
	.modal-box {
		width: min(440px, 100%);
		padding: 22px;
		border-radius: var(--pm-radius);
		background: var(--pm-paper);
		box-shadow: 0 30px 60px -20px oklch(0.2 0.03 265 / 0.6);
	}
	.modal-box h2 {
		margin: 0 0 8px;
		font-family: var(--pm-display);
		font-weight: 400;
		font-size: 24px;
	}
	.modal-box .field {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-top: 12px;
		font-weight: 700;
	}
	.modal-box input {
		min-height: 44px;
		padding: 0 12px;
		border: 2px solid var(--pm-line);
		border-radius: 10px;
		font: inherit;
		font-size: 16px;
	}
	.modal-box .actions {
		display: flex;
		gap: 8px;
		margin-top: 14px;
	}
	.modal-box .status {
		min-height: 1.4em;
		margin-top: 10px;
		font-weight: 700;
	}
	.modal-box .status.good {
		color: var(--pm-green-deep);
	}
	.modal-box .status.bad {
		color: var(--pm-red-deep);
	}
</style>
