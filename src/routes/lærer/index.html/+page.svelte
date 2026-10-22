<script>
	// The teacher start page, ported from static/lærer/index.html and teacher.js: start bingo, see
	// the shared secret codes and make new ones. The Access login is the teacher login, so there
	// is nothing to register or log in to here.
	import { onMount } from 'svelte';
	import TeacherPage from '#lib/TeacherPage.svelte';
	import { apiJson, authHeaders, ensureTeacher } from '#lib/teacher.js';

	/** @typedef {{ msg: string, kind?: 'good' | 'bad' | '' }} Status */
	/** @type {Status} */ const NONE = { msg: '' };

	let teacher = $state(/** @type {import('#lib/teacher.js').Teacher | null} */ (null));
	/** Until the stored session is checked, show neither the login nor the session. */
	let checked = $state(false);

	/** The lobby the host page is running, so the teacher can go back to it. */
	let savedBingoCode = $state('');

	onMount(async () => {
		teacher = await ensureTeacher();
		if (teacher) loadKids();
		checked = true;
		savedBingoCode = (localStorage.getItem('teacherBingoCode') || '').toUpperCase().trim();
	});

	const sessionHint = $derived(
		teacher?.exp ? `Sesjon utløper: ${new Date(teacher.exp).toLocaleString('no-NO', { hour12: false })}` : ''
	);

	// ── Children's login codes ──
	/** @typedef {{ id: string, name: string, created_at: number }} Kid */
	let kids = $state(/** @type {Kid[] | null} */ (null));
	let kidName = $state('');
	let kidStatus = $state(NONE);
	/** A code just made: shown once, since the server keeps only its hash. */
	let shownCode = $state(/** @type {{ name: string, code: string } | null} */ (null));

	async function loadKids() {
		try {
			kids = (await apiJson('/teacher/kids')).kids;
		} catch (e) {
			kidStatus = { msg: /** @type {Error} */ (e).message, kind: 'bad' };
		}
	}

	async function addKid() {
		const name = kidName.trim();
		if (!name) return;
		try {
			const data = await apiJson('/teacher/kids', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
			shownCode = { name, code: data.code };
			kidName = '';
			kidStatus = NONE;
			await loadKids();
		} catch (e) {
			kidStatus = { msg: /** @type {Error} */ (e).message, kind: 'bad' };
		}
	}

	/** @param {Kid} kid */
	async function newKidCode(kid) {
		if (!confirm(`Lage en ny kode for ${kid.name}? Den gamle slutter å virke, og ${kid.name} blir logget ut overalt.`)) return;
		try {
			shownCode = { name: kid.name, code: (await apiJson(`/teacher/kids/${kid.id}/code`, { method: 'POST' })).code };
		} catch (e) {
			kidStatus = { msg: /** @type {Error} */ (e).message, kind: 'bad' };
		}
	}

	/** @param {Kid} kid */
	async function removeKid(kid) {
		if (!confirm(`Fjerne ${kid.name}? Koden slutter å virke.`)) return;
		const dropSave = confirm(`Slette ${kid.name}s lagring i skyen også? Trykk Avbryt for å beholde den.`);
		try {
			await apiJson(`/teacher/kids/${kid.id}${dropSave ? '?save=delete' : ''}`, { method: 'DELETE' });
			if (shownCode?.name === kid.name) shownCode = null;
			await loadKids();
		} catch (e) {
			kidStatus = { msg: /** @type {Error} */ (e).message, kind: 'bad' };
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
			await apiJson('/teacher/codes', {
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

<TeacherPage subtitle="Bingo og koder">
	{#if teacher}
		<section class="panel" id="sessionBox">
			<h2>Hei, {teacher.name || 'lærer'}!</h2>
			<div class="muted" id="whoEmail">{teacher.email || ''}</div>
			<div class="actions">
				{#if savedBingoCode.length === 6}
					<a class="pm-button" id="continueBingoBtn" href="/lærer/bingo_host.html">Fortsett bingo {savedBingoCode}</a>
					<a class="pm-button secondary" id="startBingoBtn" href="/lærer/bingo_settings.html">Start ny bingo</a>
				{:else}
					<a class="pm-button" id="startBingoBtn" href="/lærer/bingo_settings.html">Start bingo</a>
				{/if}
			</div>
		</section>

		<section class="panel" id="kidsPanel">
			<h2>👧 Innlogging for barn</h2>
			<p class="muted">
				Gi hvert barn en egen kode. Med koden logger barnet inn og får sin egen lagring. Koden vises bare én gang, så skriv
				den ned.
			</p>
			{#if shownCode}
				<div class="shown-code" id="shownCode">
					<span>Koden til <strong>{shownCode.name}</strong>:</span>
					<span class="big-code">{shownCode.code}</span>
				</div>
			{/if}
			{#if kids?.length}
				<ul class="kid-list">
					{#each kids as kid (kid.id)}
						<li class="kid-row">
							<span class="kid-name">{kid.name}</span>
							<button class="pm-button small secondary" onclick={() => newKidCode(kid)}>Ny kode</button>
							<button class="pm-button small secondary danger" onclick={() => removeKid(kid)}>Fjern</button>
						</li>
					{/each}
				</ul>
			{:else if kids}
				<p class="muted small">Ingen barn ennå.</p>
			{/if}
			<form class="actions" onsubmit={(e) => (e.preventDefault(), addKid())}>
				<input id="kidName" type="text" maxlength="30" placeholder="Navn, f.eks. Kari" bind:value={kidName} />
				<button class="pm-button small" id="addKidBtn" type="submit">Legg til</button>
			</form>
			{@render status(kidStatus, 'kidStatus')}
		</section>

		<section class="panel" id="codesSection">
			<h2>🔑 Hemmelige koder</h2>
			<p class="muted">
				Koder gir mynter, Pokémon eller en melding. Barna skriver dem inn på siden for
				<a href="/redeem.html">hemmelige koder</a>.
			</p>
			<div class="actions">
				<button class="pm-button small secondary" id="showCodesBtn" aria-expanded={codesOpen} onclick={toggleCodes}>{codesOpen ? 'Skjul kodene' : 'Se kodene'}</button>
				<button class="pm-button small secondary" id="showCreateCodeBtn" aria-expanded={createOpen} onclick={() => (createOpen = !createOpen)}>{createOpen ? 'Avbryt' : '➕ Lag kode'}</button>
			</div>
			{#if createOpen}
				<div class="sub" id="createCodePanel">
					<h3>Lag en hemmelig kode</h3>
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
				</div>
			{/if}

			{#if codesOpen}
				<div class="sub" id="codesPanel">
					<h3>Aktive koder</h3>
					<p class="muted">Kodene er skjult, så de ikke vises på en storskjerm. Trykk på en kode for å se den.</p>
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
				</div>
			{/if}
		</section>

	{:else if checked}
		<section class="panel" id="notTeacher">
			<h2>Ikke lærer</h2>
			<p>Lærersidene er for dem som styrer bingo og lager koder. Du er logget inn som en som ikke står på lærerlisten.</p>
			<p>Vil du bli med i et bingo-spill? <a href="/bingo_join.html">Skriv inn koden her</a>.</p>
		</section>
	{/if}
</TeacherPage>

<style>
	.wide {
		grid-column: 1 / -1;
	}
	.sub {
		margin-top: 16px;
		padding-top: 14px;
		border-top: 1px solid var(--pm-line);
	}
	h3 {
		margin: 0 0 6px;
		font-size: 17px;
	}
	#codesSection p a {
		color: var(--pm-red-deep);
		font-weight: 600;
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
	.shown-code {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		margin: 0 0 12px;
		padding: 12px 14px;
		border-radius: 12px;
		background: var(--pm-cream);
	}
	.big-code {
		font: 800 26px/1 ui-monospace, Menlo, monospace;
		letter-spacing: 2px;
	}
	.kid-list {
		margin: 0 0 12px;
		padding: 0;
		list-style: none;
	}
	.kid-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 0;
		border-bottom: 1px solid var(--pm-line);
	}
	.kid-name {
		flex: 1;
		font-weight: 700;
	}
	#kidName {
		flex: 1;
		min-width: 0;
	}
	#notTeacher a {
		color: var(--pm-red-deep);
		font-weight: 600;
	}
</style>
