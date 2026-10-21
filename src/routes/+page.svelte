<script>
	// The front page: pick a stage. Ported from static/index.html and menu.js.
	import { onMount } from 'svelte';
	import { SPLASHES, EVENT_SPLASHES } from '#lib/data/splashes.js';

	const ALERT_ID = '2026-03-16';

	const STAGES = [
		{ id: 'stage-one', href: 'pokemath.html?stage=1', title: 'Nivå 1', lines: ['Pluss & Minus', '0 - 10'] },
		{ id: 'stage-two', href: 'pokemath.html?stage=2', title: 'Nivå 2', lines: ['Pluss & Minus', '0 - 25'] },
		{ id: 'stage-three', href: 'pokemath.html?stage=3', title: 'Nivå 3', lines: ['4 regnearter', 'Små tall'] },
		{ id: 'stage-four', href: 'pokemath.html?stage=4', title: 'Nivå 4', lines: ['4 Regnearter', 'Store tall'] },
		{ id: 'stage-five', href: 'pokemath.html?stage=5', title: 'Nivå 5', lines: ['4 regnearter', 'Veldig Store tall'] }
	];

	/** @type {number} 0–11, set in the browser */
	let month = $state(-1);
	let splash = $state(' ');
	/** The starter set (1–3) whose evolutions decorate the five stages. */
	let starterSet = $state(0);
	let showAlert = $state(true);

	/** @param {string[]} list */
	const pick = (list) => list[Math.floor(Math.random() * list.length)];

	onMount(() => {
		month = new Date().getMonth();
		// The same order of Math.random() calls as menu.js: the splash, then the starter set.
		if (month === 9) splash = pick(EVENT_SPLASHES.halloween);
		else if (month === 2 || month === 3) splash = pick(EVENT_SPLASHES.easter);
		else if (month === 11) splash = pick(EVENT_SPLASHES.christmas);
		else splash = pick(SPLASHES);
		starterSet = Math.floor(Math.random() * 3) + 1;
		showAlert = localStorage.getItem('alertDismissed') !== ALERT_ID;
	});

	const logoImage = $derived(
		month === 9 ? 'url(images/logo-halloween.png)' : month === 11 ? 'url(images/logo-christmas.png)' : month === 2 || month === 3 ? 'url(images/logo.png)' : null
	);

	function closeAlert() {
		localStorage.setItem('alertDismissed', ALERT_ID);
		showAlert = false;
	}
</script>

<svelte:head>
	<title>Pokémath</title>
	<meta name="title" content="Pokemath" />
	<meta
		name="description"
		content="En nettside hvor man kan øve på de fire regneartene og få informasjon om ulike pokemon når man løser nok oppgaver."
	/>
	<meta name="keywords" content="Matte, Pokemon, pokemth, poekmath, mate, pokematte" />
	<meta name="robots" content="index, nofollow" />
	<link rel="stylesheet" href="/menustyle.css?v=100" />
	<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css" />
</svelte:head>

{#snippet stageCard(/** @type {string} */ id, /** @type {string} */ href, /** @type {string} */ image, /** @type {string} */ title, /** @type {string[]} */ lines, /** @type {string} */ imageStyle = 'background-size: cover;')}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div class="bigcard" {id} onclick={() => (location.href = href)}>
		<div class="card-content">
			<div class="has-text-centered">
				{#if image}
					<div class="card-image" style="background-image: url('{image}'); height: 128px; width: 128px; {imageStyle}">&nbsp;</div>
				{/if}
			</div>
		</div>
		<div class="card-footer">
			<p class="card-footer-item"><strong style="text-transform: capitalize;">{title}</strong></p>
		</div>
		<div class="card-footer">
			<p class="card-footer-item">
				<!-- svelte-ignore a11y_missing_attribute -->
				<a style="text-transform: capitalize;">{lines[0]} <br /> {lines[1]}</a>
			</p>
		</div>
	</div>
{/snippet}

<div class="main">
	<noscript>
		<div style="border: 1px solid purple; padding: 10px">
			<span style="color:red"
				>JavaScript er ikke aktivert! PokeMath trenger å bruke JavaScript for å fungere. Du kan lese mer om hvordan man kan skru på JavaScript <a
					href="https://support.microsoft.com/nb-no/office/aktivere-javascript-7bb9ee74-6a9e-4dd1-babf-b0a1bb136361"
					>her. (microsoft.com)</a
				></span
			>
		</div>
	</noscript>
	<div class="snowflakecontainer">
		{#if month === 11}
			{#each { length: 10 }, i (i)}<div class="fallingsnowflake">❅</div>{/each}
		{/if}
	</div>
	<div id="logo" class="logo" style:background-image={logoImage}>
		<span id="logotext" class="tilt pop">{splash}</span>
	</div>

	<div class="columns is-multiline is-mobile" id="stageselect">
		{#if month === 11}
			{@render stageCard('xmas', 'christmas.html', 'images/events/christmas/calendar.png', 'Julekalender', ['Fra 1. til 24.', 'desember!'])}
		{/if}
		{#if month === 2 || month === 3}
			{@render stageCard('easter', 'easter.html', 'images/events/easter/Spr_4d_Egg.png', 'Påskeevent', ['Mars og april!', ''], 'background-color:#d4f7c5; background-size: contain; background-repeat: no-repeat; background-position: center;')}
		{/if}
		{#each STAGES as stage, i (stage.id)}
			{@render stageCard(stage.id, stage.href, starterSet ? `images/starter-${starterSet}-${i + 1}.png` : '', stage.title, stage.lines)}
		{/each}
		{@render stageCard('stage-custom', 'customizer.html', 'images/gear.png', 'Eget Nivå', ['alle muligheter', 'Velg selv'])}
	</div>
</div>

{#if showAlert}
	<div id="alertbox" class="alert simple-alert" data-alert-id={ALERT_ID}>
		<h2>De svarte linjene er borte!<span class="date"> 16.03.2026</span></h2>
		<p>
			Opplever du at de svarte linjene mangler?<br />
			Kan du ikke se penger eller navn?<br />
			Vi har en fiks! På PC kan du enkelt gjøre CTRL+F5 for å laste inn ordentlig.<br />
			På iPad: Gå til <a href="./faq.html">FAQ</a> og trykk "Jeg ønsker å få nyeste oppdatering", velg deretter "Tøm Cache".<br />
		</p>
		<!-- svelte-ignore a11y_missing_attribute, a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<a class="close" onclick={closeAlert}>&times;</a>
		<br />
		- Mvh. PokeMorten
		<br />
	</div>
{/if}
