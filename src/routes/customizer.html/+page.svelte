<script>
	// Custom exercises, ported from static/customizer.html and customizer.js: pick operations and
	// ranges, then play them, share a link or a QR code, or keep up to five presets.
	import { onMount } from 'svelte';
	import { toast } from '#lib/toast.svelte.js';
	import { getStorageString } from '#lib/storage.js';

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
		navigator.clipboard.writeText('https://www.pokemath.online' + gameUrl());
		toast('Lenken ble kopiert!');
	}

	function makeQr() {
		const link = 'https://www.pokemath.online' + encodeURIComponent(gameUrl());
		qrSrc = 'https://api.qrserver.com/v1/create-qr-code/?data=' + link + '&amp;size=250x250';
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
	<!-- The legacy page also linked cookies.css, which does not exist on the live site either. -->
	<link rel="stylesheet" href="/menustyle.css?v=100" />
	<link rel="stylesheet" href="/customizer.css?v=100" />
</svelte:head>

<div class="main">
	<div class="columns is-mobile is-multiline">
		<form class="customizerform">
			{#each SECTIONS as section (section.key)}
				<div class="toggle-pill-color">
					<!-- svelte-ignore a11y_missing_attribute -->
					<a class="categoryname"> {section.title}</a>
					<input type="checkbox" id={section.check} name={section.key} bind:checked={enabled[section.key]} />
					<label for={section.check}> </label>
				</div>
				<div class="form-group col-md-6" id={section.section} style:display={enabled[section.key] ? '' : 'none'}>
					{#each section.fields as [key, id, label] (key)}
						<label for={id}> {label} </label>
						<input
							type="number"
							{id}
							class={section.key === 'add' || key.endsWith('dec') ? null : 'form-control'}
							min={key.endsWith('dec') ? 0 : null}
							max={key.endsWith('dec') ? 5 : null}
							required
							autocomplete="off"
							bind:value={() => values[key], (v) => (values[key] = v == null ? '' : String(v))}
						/>
					{/each}
					{#if section.key === 'sub'}
						<!-- svelte-ignore a11y_missing_attribute -->
						<a>Tillat negative differenser:</a>
						<div class="toggle-pill-color">
							<input type="checkbox" id="subtractionallownegative" name="san" bind:checked={allowNegative} />
							<label for="subtractionallownegative"> </label>
						</div>
					{/if}
				</div>
			{/each}
			<button class="button-1" id="useform" onclick={play} type="button"> Bruk </button>
			<button class="button-1" id="copyform" onclick={copyLink} type="button"> Kopier </button>
			<button class="button-1" id="qrcreate" onclick={makeQr} type="button"> Lag QR-Kode </button>
			<div>
				<img
					class="barcode"
					id="barcode"
					src={qrSrc || 'https://api.qrserver.com/v1/create-qr-code/?data=Pokemath.online&size=250x250'}
					alt=""
					title="QR Kode"
					width="250"
					height="250"
					style:display={qrSrc ? '' : 'none'}
				/>
			</div>
		</form>
	</div>
	<div class="columns is-multiline is-mobile">
		{#each presets as preset, i (i)}
			<div id="presetCard-{i + 1}" class="card" style="padding: 5px">
				<h2 class="card-title">{preset.name ?? `Lagring #${i + 1}`}</h2>
				<button class="button-1 save-btn" class:disabled={preset.name !== null} onclick={() => savePreset(i + 1)} type="button">
					Lagre
				</button>
				<button class="button-1 load-btn" class:disabled={preset.name === null} onclick={() => loadPreset(i + 1)} type="button">
					Last inn
				</button>
				<button class="button-2 del-btn" class:disabled={preset.name === null} onclick={() => deletePreset(i + 1)} type="button">
					Slett
				</button>
				<h5>Preset #{i + 1}</h5>
			</div>
		{/each}
	</div>
</div>
