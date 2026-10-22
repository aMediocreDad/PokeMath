<script>
	// Custom exercises, ported from static/customizer.html and customizer.js: pick operations and
	// ranges, then play them, share a link or a QR code, or keep up to five presets.
	import { onMount } from 'svelte';
	import { toast } from '#lib/toast.svelte.js';
	import { getStorageString } from '#lib/storage.js';
	import { qrDataUrl } from '#lib/qr.js';

	/** @typedef {{ key: string, label: string, value: string, min?: number, max?: number }} Field */

	const DEFAULTS = {
		add: { amin: '0', amax: '100', aminb: '0', amaxb: '100', adec: '0' },
		sub: { smin: '0', smax: '100', sminb: '0', smaxb: '100', sdec: '0' },
		mul: { mumina: '0', mumaxa: '10', muminb: '0', mumaxb: '10', mudec: '0' },
		div: { dmin: '1', dmax: '10', dmmin: '0', dmmax: '10', ddec: '0' }
	};

	const SECTIONS = /** @type {const} */ ([
		{ key: 'add', check: 'additioncheck', title: 'Addisjon', section: 'addSection', fields: [
			['amin', 'addMinSel', 'Laveste ledd A:'], ['amax', 'addMaxSel', 'Høyeste ledd A:'],
			['aminb', 'addMinSelB', 'Laveste ledd B:'], ['amaxb', 'addMaxSelB', 'Høyeste ledd B:'],
			['adec', 'addDecSel', 'Desimaler (0-5):']] },
		{ key: 'sub', check: 'subtractioncheck', title: 'Subtraksjon', section: 'subSection', fields: [
			['smin', 'subMinSel', 'Laveste ledd A:'], ['smax', 'subMaxSel', 'Høyeste ledd A:'],
			['sminb', 'subMinSelB', 'Laveste ledd B:'], ['smaxb', 'subMaxSelB', 'Høyeste ledd B:'],
			['sdec', 'subDecSel', 'Desimaler (0-5):']] },
		{ key: 'mul', check: 'multiplicationcheck', title: 'Multiplikasjon', section: 'mulSection', fields: [
			['mumina', 'mulMinSelA', 'Faktor A laveste verdi:'], ['mumaxa', 'mulMaxSelA', 'Faktor A høyeste verdi:'],
			['muminb', 'mulMinSelB', 'Faktor B laveste verdi:'], ['mumaxb', 'mulMaxSelB', 'Faktor B høyeste verdi:'],
			['mudec', 'mulDecSel', 'Desimaler (0-5):']] },
		{ key: 'div', check: 'divisioncheck', title: 'Divisjon', section: 'divSection', fields: [
			['dmin', 'divMinDivSel', 'Laveste divisor:'], ['dmax', 'divMaxDivSel', 'Høyeste divisor:'],
			['dmmin', 'divMinKvoSel', 'Laveste kvotient:'], ['dmmax', 'divMaxKvoSel', 'Høyeste kvotient:'],
			['ddec', 'divDecSel', 'Desimaler (0-5):']] }
	]);

	/** How each section shows its fields: two from–to rows, then the decimals. */
	const LAYOUT = {
		add: { symbol: '+', rows: [['Tall A', 'addMinSel', 'addMaxSel'], ['Tall B', 'addMinSelB', 'addMaxSelB']], dec: 'addDecSel' },
		sub: { symbol: '−', rows: [['Tall A', 'subMinSel', 'subMaxSel'], ['Tall B', 'subMinSelB', 'subMaxSelB']], dec: 'subDecSel' },
		mul: { symbol: '×', rows: [['Faktor A', 'mulMinSelA', 'mulMaxSelA'], ['Faktor B', 'mulMinSelB', 'mulMaxSelB']], dec: 'mulDecSel' },
		div: { symbol: '÷', rows: [['Divisor', 'divMinDivSel', 'divMaxDivSel'], ['Svar', 'divMinKvoSel', 'divMaxKvoSel']], dec: 'divDecSel' }
	};

	/** @type {Record<string, boolean>} */
	let enabled = $state({ add: false, sub: false, mul: false, div: false });
	/** @type {Record<string, string>} */
	let values = $state({ ...DEFAULTS.add, ...DEFAULTS.sub, ...DEFAULTS.mul, ...DEFAULTS.div });
	let allowNegative = $state(false);
	let qrSrc = $state('');

	/** @type {{ name: string | null }[]} Five preset slots; name is null when the slot is empty. */
	let presets = $state(Array.from({ length: 5 }, () => ({ name: null })));

	onMount(() => {
		for (let i = 1; i <= 5; i++) {
			const stored = localStorage.getItem('customPreset' + i);
			// Stored as JSON, so the name still starts with a quote character.
			if (stored != null) presets[i - 1].name = stored.split('|')[0].substring(1);
		}
	});

	/** fetchURL(): the game link for the current choices. */
	function gameUrl() {
		let url = '/pokemath.html?custom=true';
		const v = values;
		if (enabled.add) url += `&add=t&amin=${v.amin}&amax=${v.amax}&aminb=${v.aminb}&amaxb=${v.amaxb}&adec=${v.adec}`;
		if (enabled.sub) {
			url += `&sub=t&smin=${v.smin}&smax=${v.smax}&sminb=${v.sminb}&smaxb=${v.smaxb}&sdec=${v.sdec}`;
			if (!allowNegative) url += '&san=f';
		}
		if (enabled.mul) url += `&mul=t&mumina=${v.mumina}&mumaxa=${v.mumaxa}&mudec=${v.mudec}&muminb=${v.muminb}&mumaxb=${v.mumaxb}`;
		if (enabled.div) url += `&div=t&dmin=${v.dmin}&dmax=${v.dmax}&dmmin=${v.dmmin}&dmmax=${v.dmmax}&ddec=${v.ddec}`;
		return url;
	}

	function play() {
		location.href = '.' + gameUrl();
	}

	function copyLink() {
		navigator.clipboard.writeText(location.origin + gameUrl());
		toast('Lenken ble kopiert!');
	}

	async function makeQr() {
		qrSrc = await qrDataUrl(location.origin + gameUrl(), 250);
	}

	/**
	 * loadValues(): fill the form from a saved link.
	 * @param {string} url
	 */
	function loadValues(url) {
		const params = new URLSearchParams(url);
		allowNegative = params.get('san') != 'f';
		for (const section of SECTIONS) {
			enabled[section.key] = params.get(section.key) == 't';
			if (!enabled[section.key]) continue;
			for (const [key] of section.fields) {
				values[key] = params.get(key) ?? DEFAULTS[section.key][/** @type {never} */ (key)];
			}
		}
	}

	/** @param {number} id */
	function savePreset(id) {
		const slot = presets[id - 1];
		if (slot.name !== null) return;
		let name = prompt('Gi forhåndsinstillingen et navn', 'Lagret #' + id);
		if (name === null) return;
		if (name.length > 20) name = name.substring(0, 20);
		name = name.replaceAll('|', '-').replaceAll(/^\s+|\s+$/g, '');
		slot.name = name;
		localStorage.setItem('customPreset' + id, JSON.stringify(name + '|' + gameUrl()));
	}

	/** @param {number} id */
	function loadPreset(id) {
		if (presets[id - 1].name === null) return;
		const [name, url] = getStorageString('customPreset' + id).split('|');
		if (url == null) toast(`Det skjedde en feil når vi prøvde å laste inn #${id}. Dataen eksisterer ikke.`, { bad: true });
		else loadValues(url);
		toast(`Den lagrede instillingen har blitt lastet inn. (#${id} - ${name})`);
	}

	/** @param {number} id */
	function deletePreset(id) {
		if (presets[id - 1].name === null) return;
		presets[id - 1].name = null;
		localStorage.removeItem('customPreset' + id);
		toast('Den lagrede instillingen ble slettet.', { bad: true });
	}
</script>

<svelte:head>
	<title>Pokémath - Egendefinert</title>
	<meta name="title" content="Pokémath - Egendefinert" />
	<meta name="description" content="Lag ditt eget nivå." />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#snippet numberInput(/** @type {string} */ key, /** @type {string} */ id, /** @type {boolean} */ dec)}
	<input
		type="number"
		{id}
		inputmode={dec ? 'numeric' : null}
		min={dec ? 0 : null}
		max={dec ? 5 : null}
		required
		autocomplete="off"
		bind:value={() => values[key], (v) => (values[key] = v == null ? '' : String(v))}
	/>
{/snippet}

<div class="main pm-page customizer">
	<h1 class="pm-title">Eget nivå</h1>
	<p class="lead">Slå på regneartene du vil øve på, og velg hvilke tall oppgavene skal ha.</p>

	<form class="customizerform">
		<div class="ops">
			{#each SECTIONS as section (section.key)}
				{@const layout = LAYOUT[section.key]}
				{@const keyOf = (/** @type {string} */ id) => section.fields.find((f) => f[1] === id)?.[0] ?? ''}
				<section class="op pm-surface" class:on={enabled[section.key]}>
					<label class="op-head" for={section.check}>
						<span class="symbol" aria-hidden="true">{layout.symbol}</span>
						<span class="categoryname">{section.title}</span>
						<input type="checkbox" class="switch" id={section.check} name={section.key} bind:checked={enabled[section.key]} />
					</label>
					<div class="op-body" id={section.section} style:display={enabled[section.key] ? '' : 'none'}>
						{#each layout.rows as [rowLabel, minId, maxId] (minId)}
							<div class="range">
								<span class="range-label">{rowLabel}</span>
								<label for={minId}>fra</label>
								{@render numberInput(keyOf(minId), minId, false)}
								<label for={maxId}>til</label>
								{@render numberInput(keyOf(maxId), maxId, false)}
							</div>
						{/each}
						<div class="range">
							<label class="range-label" for={layout.dec}>Desimaler</label>
							{@render numberInput(keyOf(layout.dec), layout.dec, true)}
							<span class="note">0 til 5</span>
						</div>
						{#if section.key === 'sub'}
							<label class="range negative" for="subtractionallownegative">
								<span class="range-label">Svar under null</span>
								<input type="checkbox" class="switch" id="subtractionallownegative" name="san" bind:checked={allowNegative} />
							</label>
						{/if}
					</div>
				</section>
			{/each}
		</div>

		<div class="actions">
			<button class="pm-button" id="useform" onclick={play} type="button">Spill!</button>
			<button class="pm-button secondary" id="copyform" onclick={copyLink} type="button">Kopier lenke</button>
			<button class="pm-button secondary" id="qrcreate" onclick={makeQr} type="button">Lag QR-kode</button>
		</div>
		<img
			class="barcode"
			id="barcode"
			src={qrSrc || undefined}
			alt="QR-kode til nivået"
			title="QR Kode"
			width="250"
			height="250"
			style:display={qrSrc ? '' : 'none'}
		/>
	</form>

	<h2 class="pm-section-title">Lagrede oppsett <small>Opptil fem</small></h2>
	<div class="presets">
		{#each presets as preset, i (i)}
			<div id="presetCard-{i + 1}" class="preset pm-surface" class:empty={preset.name === null}>
				<span class="slot">{i + 1}</span>
				<h3 class="card-title">{preset.name ?? `Lagring #${i + 1}`}</h3>
				<div class="preset-buttons">
					<button class="pm-button small green save-btn" class:disabled={preset.name !== null} onclick={() => savePreset(i + 1)} type="button">Lagre</button>
					<button class="pm-button small secondary load-btn" class:disabled={preset.name === null} onclick={() => loadPreset(i + 1)} type="button">Last inn</button>
					<button class="pm-button small secondary del-btn" class:disabled={preset.name === null} onclick={() => deletePreset(i + 1)} type="button">Slett</button>
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.lead {
		margin: -6px 0 20px;
		color: var(--pm-ink-soft);
		font-size: 18px;
	}
	.ops {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 14px;
		align-items: start;
	}
	.op {
		padding: 6px 16px;
	}
	.op.on {
		box-shadow: var(--pm-shadow), 0 0 0 3px var(--pm-green);
	}
	.op-head {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 60px;
		cursor: pointer;
	}
	.symbol {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: 12px;
		background: var(--pm-cream);
		font-family: var(--pm-display);
		font-size: 30px;
		line-height: 1;
	}
	.on .symbol {
		background: var(--pm-green-deep);
		color: var(--pm-paper);
	}
	.categoryname {
		flex: 1;
		font-family: var(--pm-display);
		font-size: 24px;
	}

	/* An on/off switch drawn on the checkbox itself, so the id, label and checked state stay as they were. */
	.switch {
		appearance: none;
		-webkit-appearance: none;
		position: relative;
		flex-shrink: 0;
		width: 56px;
		height: 32px;
		margin: 0;
		border-radius: 999px;
		background: var(--pm-line);
		cursor: pointer;
		transition: background 150ms ease-out;
	}
	.switch::after {
		content: '';
		position: absolute;
		top: 3px;
		left: 3px;
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: var(--pm-paper);
		box-shadow: 0 1px 3px oklch(0.3 0.03 265 / 0.3);
		transition: transform 150ms ease-out;
	}
	.switch:checked {
		background: var(--pm-green-deep);
	}
	.switch:checked::after {
		transform: translateX(24px);
	}
	.switch:focus-visible {
		outline: 3px solid var(--pm-ink);
		outline-offset: 2px;
	}

	.op-body {
		padding: 4px 0 14px;
		border-top: 1px solid var(--pm-line);
	}
	.range {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 10px;
	}
	.range-label {
		width: 84px;
		font-weight: 700;
	}
	.range label:not(.range-label) {
		color: var(--pm-ink-soft);
	}
	.range input[type='number'] {
		width: 0;
		flex: 1;
		min-width: 64px;
		height: 44px;
		padding: 0 10px;
		border: 2px solid var(--pm-line);
		border-radius: 10px;
		background: var(--pm-cream);
		color: var(--pm-ink);
		font-family: var(--pm-display);
		font-size: 20px;
		text-align: center;
	}
	.range input[type='number']:focus {
		border-color: var(--pm-ink);
		outline: none;
	}
	.range input[id$='DecSel'] {
		flex: 0 0 72px;
	}
	.note {
		color: var(--pm-ink-soft);
		font-size: 14px;
	}
	.negative {
		justify-content: space-between;
		cursor: pointer;
	}
	.negative .range-label {
		width: auto;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-top: 20px;
	}
	.barcode {
		display: block;
		margin-top: 16px;
		border-radius: 12px;
		background: var(--pm-paper);
		box-shadow: var(--pm-shadow), 0 0 0 1px var(--pm-line);
	}

	.presets {
		display: grid;
		gap: 10px;
	}
	.preset {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
	}
	.slot {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--pm-cream);
		font-family: var(--pm-display);
	}
	.card-title {
		flex: 1;
		min-width: 0;
		margin: 0;
		overflow: hidden;
		font-size: 17px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.preset.empty .card-title {
		color: var(--pm-ink-soft);
		font-weight: 400;
	}
	.preset-buttons {
		display: flex;
		gap: 6px;
	}

	@media (max-width: 560px) {
		.ops {
			grid-template-columns: 1fr;
		}
		.actions .pm-button {
			flex: 1 1 auto;
		}
		.preset {
			flex-wrap: wrap;
		}
		.preset-buttons {
			width: 100%;
		}
		.preset-buttons .pm-button {
			flex: 1;
		}
		.range-label {
			width: 70px;
		}
	}
	@media (pointer: coarse) {
		.pm-button.small {
			min-height: 44px;
		}
	}
</style>
