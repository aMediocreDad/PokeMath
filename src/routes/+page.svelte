<script>
	// The front page: pick a stage. Ported from static/index.html and menu.js.
	import { onMount } from 'svelte';
	import { SPLASHES, EVENT_SPLASHES, APRIL_SPLASHES, HINTS } from '#lib/data/splashes.js';
	import { me } from '#lib/me.svelte.js';

	const ALERT_ID = '2026-03-22';

	const STAGES = [
		{ id: 'stage-one', href: 'pokemath.html?stage=1', title: 'Nivå 1', lines: ['Pluss og minus', '0–10'] },
		{ id: 'stage-two', href: 'pokemath.html?stage=2', title: 'Nivå 2', lines: ['Pluss og minus', '0–25'] },
		{ id: 'stage-three', href: 'pokemath.html?stage=3', title: 'Nivå 3', lines: ['Alle fire regnearter', 'Små tall'] },
		{ id: 'stage-four', href: 'pokemath.html?stage=4', title: 'Nivå 4', lines: ['Alle fire regnearter', 'Store tall'] },
		{ id: 'stage-five', href: 'pokemath.html?stage=5', title: 'Nivå 5', lines: ['Alle fire regnearter', 'Veldig store tall'] }
	];

	/** @type {number} 0–11, set in the browser */
	let month = $state(-1);
	let splash = $state(' ');
	/** The starter set (1–3) whose evolutions decorate the five stages. */
	let starterSet = $state(0);
	let showAlert = $state(false);
	let aprilFools = $state(false);
	let hintIndex = $state(0);

	/** @param {string[]} list */
	const pick = (list) => list[Math.floor(Math.random() * list.length)];

	onMount(() => {
		month = new Date().getMonth();
		// The same order of Math.random() calls as the live page: the tip (an inline script in
		// index.html runs first), then the splash and the starter set (menu.js).
		hintIndex = Math.floor(Math.random() * HINTS.length);
		const tips = setInterval(() => (hintIndex = (hintIndex + 1) % HINTS.length), 15000);
		aprilFools = month === 3 && new Date().getDate() === 1;
		if (month === 9) splash = pick(EVENT_SPLASHES.halloween);
		else if (aprilFools) splash = pick(APRIL_SPLASHES);
		else if (month === 2 || month === 3) splash = pick(EVENT_SPLASHES.easter);
		else if (month === 11) splash = pick(EVENT_SPLASHES.christmas);
		else splash = pick(SPLASHES);
		starterSet = Math.floor(Math.random() * 3) + 1;
		// The spring event's announcement belongs to the event's months, like its tile.
		showAlert = (month === 2 || month === 3) && localStorage.getItem('alertDismissed') !== ALERT_ID;
		return () => clearInterval(tips);
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
</svelte:head>

{#snippet tile(/** @type {string} */ id, /** @type {string} */ href, /** @type {string} */ image, /** @type {string} */ title, /** @type {string[]} */ lines, /** @type {number} */ level, /** @type {string} */ variant = '')}
	<a class="tile {variant}" {id} {href}>
		<span class="art" style:background-image={image ? `url('${image}')` : null}></span>
		<span class="title">{title}</span>
		<span class="lines">{lines[0]}{#if lines[1]}<br />{lines[1]}{/if}</span>
		{#if level}
			<span class="meter" aria-label="Vanskelighet {level} av 5">
				{#each { length: 5 }, i (i)}<span class="pip" class:on={i < level}></span>{/each}
			</span>
		{/if}
	</a>
{/snippet}

<div class="main home">
	<noscript>
		<p class="noscript">
			JavaScript er ikke aktivert! PokeMath trenger å bruke JavaScript for å fungere. Du kan lese mer om hvordan man kan
			skru på JavaScript <a href="https://support.microsoft.com/nb-no/office/aktivere-javascript-7bb9ee74-6a9e-4dd1-babf-b0a1bb136361"
				>her (microsoft.com)</a
			>.
		</p>
	</noscript>
	{#if month === 11}
		<div class="snow" aria-hidden="true">
			{#each { length: 10 }, i (i)}<span class="fallingsnowflake" style:left="{i * 10 + 4}%" style:animation-delay="{i * 0.7}s">❅</span>{/each}
		</div>
	{/if}

	<div id="logo" class="logo" style:background-image={logoImage ?? 'url(images/logo.png)'} role="img" aria-label="PokéMath">
		<span id="logotext" class="splash" class:upside-down={aprilFools}>{splash}</span>
	</div>

	<h1 class="pick">Velg nivå</h1>
	<nav class="tiles" id="stageselect" aria-label="Velg nivå">
		{#if month === 11}
			{@render tile('xmas', 'christmas.html', 'images/events/christmas/calendar.png', 'Julekalender', ['Fra 1. til 24.', 'desember!'], 0, 'event')}
		{/if}
		{#if month === 2 || month === 3}
			{@render tile('easter', 'easter.html', 'images/events/easter/Spr_4d_Egg.png', 'Våren er her!', ['Delta her!', ''], 0, 'event')}
		{/if}
		{#each STAGES as stage, i (stage.id)}
			{@render tile(stage.id, stage.href, starterSet ? `images/starter-${starterSet}-${i + 1}.png` : '', stage.title, stage.lines, i + 1)}
		{/each}
		{@render tile('stage-adaptive', 'pokemath.html?adaptive=true', 'images/rotomdex.png', 'Tilpasset nivå', ['Alle regnearter', 'Tilpasser seg deg! (Beta)'], 0, 'custom')}
		{@render tile('stage-custom', 'customizer.html', 'images/gear.png', 'Eget nivå', ['Velg regnearter', 'og tall selv'], 0, 'custom')}
	</nav>

	<section class="bingo-row" aria-label="Bingo">
		<a class="pm-button secondary" id="homeJoinBingo" href="/bingo_join.html">🎲 Bli med i bingo</a>
		{#if me.teacher}<a class="pm-button" id="homeStartBingo" href="/lærer/index.html">🧑‍🏫 Styr bingo</a>{/if}
	</section>

	<p class="hint" id="stage-hint-box" aria-live="polite">
		<span class="hint-label">Tips</span>
		<!-- The tips are this file's own text, not user input. -->
		<span id="stage-hint-text">{@html HINTS[hintIndex]}</span>
	</p>
</div>

{#if showAlert}
	<aside id="alertbox" class="news" data-alert-id={ALERT_ID} aria-labelledby="news-title">
		<button class="close" onclick={closeAlert} aria-label="Lukk">×</button>
		<h2 id="news-title">Våren er her! <span class="date">22.03.2026</span></h2>
		<p>
			Her kommer vårt vår-event! Denne gangen prøver vi å se hvor mange pokemon dere kan samle totalt som et lag. Alle
			pokemon fanget i perioden 22.03 - 30.04 teller, og det spiller ingen rolle hvilket nivå du spiller på!
		</p>
		<p>
			Det kan kanskje virke som om vi har satt høye mål, men vi tror på dere! Vi målte faktisk hvor mange pokemon dere
			fanget på en vilkårlig uke, og det var mer enn 300 000 pokemon på bare 7 dager!
		</p>
		<p class="signature">– Mvh. PokeMorten</p>
	</aside>
{/if}

<style>
	.bingo-row {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 12px;
		margin: 18px 0 6px;
	}
	.home {
		max-width: 900px;
		margin: 0 auto;
		padding: 8px 16px 32px;
	}
	.noscript {
		padding: 12px;
		border-radius: 12px;
		background: var(--pm-red-soft);
	}

	.logo {
		position: relative;
		height: clamp(110px, 22vw, 190px);
		margin: 12px auto 0;
		max-width: 560px;
		background-size: contain;
		background-position: center;
		background-repeat: no-repeat;
	}
	/* The splash line, a gold sticker on the logo's corner. */
	.splash {
		position: absolute;
		right: 0;
		bottom: 2px;
		max-width: 60%;
		padding: 4px 12px;
		border-radius: 10px;
		background: var(--pm-gold);
		box-shadow: 0 3px 0 oklch(0.65 0.13 80);
		color: var(--pm-ink);
		font-family: var(--pm-display);
		font-size: clamp(14px, 2.6vw, 20px);
		line-height: 1.15;
		text-align: center;
		transform: rotate(-4deg);
		animation: pulse 1.6s ease-in-out infinite;
	}
	@keyframes pulse {
		50% { transform: rotate(-4deg) scale(1.05); }
	}

	.pick {
		margin: 22px 0 14px;
		font-family: var(--pm-display);
		font-weight: 400;
		font-size: 26px;
		text-align: center;
	}
	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 14px;
	}
	.tile {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 12px 10px 14px;
		border-radius: 20px;
		background: var(--pm-paper);
		box-shadow: var(--pm-shadow), 0 0 0 1px var(--pm-line);
		color: var(--pm-ink);
		text-align: center;
		text-decoration: none;
		transition: transform 120ms ease-out;
	}
	.tile:active {
		transform: scale(0.97);
	}
	.tile.event {
		box-shadow: var(--pm-shadow), 0 0 0 3px var(--pm-gold);
	}
	.art {
		width: 104px;
		height: 104px;
		border-radius: 50%;
		background-color: var(--pm-cream);
		background-size: 84%;
		background-position: center;
		background-repeat: no-repeat;
	}
	.custom .art {
		background-size: 60%;
	}
	.title {
		margin-top: 6px;
		font-family: var(--pm-display);
		font-size: 24px;
	}
	.lines {
		color: var(--pm-ink-soft);
		font-size: 15px;
		line-height: 1.3;
	}
	.meter {
		display: flex;
		gap: 4px;
		margin-top: 6px;
	}
	.pip {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--pm-line);
	}
	.pip.on {
		background: var(--pm-red);
	}

	.news {
		position: fixed;
		left: 12px;
		right: 12px;
		bottom: 56px;
		z-index: 800;
		max-width: 520px;
		margin: 0 auto;
		padding: 16px 52px 12px 18px;
		border-radius: var(--pm-radius);
		background: var(--pm-paper);
		box-shadow: var(--pm-shadow), 0 0 0 1px var(--pm-line);
	}
	.news h2 {
		margin: 0 0 6px;
		font-family: var(--pm-display);
		font-weight: 400;
		font-size: 20px;
	}
	.date {
		color: var(--pm-ink-soft);
		font-family: var(--pm-body);
		font-size: 14px;
	}
	.news p {
		margin: 0 0 6px;
		line-height: 1.4;
	}
	.signature {
		color: var(--pm-ink-soft);
	}
	.close {
		position: absolute;
		top: 6px;
		right: 6px;
		width: 44px;
		height: 44px;
		border: none;
		border-radius: 50%;
		background: none;
		color: var(--pm-ink-soft);
		font-size: 28px;
		cursor: pointer;
	}

	.snow {
		position: fixed;
		inset: 0;
		pointer-events: none;
		overflow: hidden;
		z-index: 1;
	}
	.fallingsnowflake {
		position: absolute;
		top: -40px;
		color: oklch(0.8 0.03 240);
		font-size: 28px;
		animation: fall 9s linear infinite;
	}
	@keyframes fall {
		to { transform: translateY(110vh); }
	}

	@media (max-width: 480px) {
		.tiles {
			grid-template-columns: repeat(2, 1fr);
			gap: 10px;
		}
		.art {
			width: 84px;
			height: 84px;
		}
		.title {
			font-size: 21px;
		}
		/* On phones the sticker sits under the logo instead of over the word. */
		.splash {
			bottom: -18px;
			max-width: 80%;
			font-size: 13px;
		}
		.pick {
			margin-top: 30px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.splash,
		.fallingsnowflake {
			animation: none;
		}
	}

	.splash.upside-down {
		transform: rotate(180deg);
		animation: none;
	}
	.hint {
		display: flex;
		align-items: baseline;
		gap: 10px;
		max-width: 640px;
		margin: 20px auto 0;
		padding: 12px 16px;
		border-radius: var(--pm-radius);
		background: var(--pm-paper);
		box-shadow: 0 0 0 1px var(--pm-line);
		line-height: 1.4;
	}
	.hint-label {
		flex-shrink: 0;
		padding: 1px 9px;
		border-radius: 999px;
		background: var(--pm-gold);
		font-family: var(--pm-display);
		font-size: 14px;
	}
</style>
