<script>
	// The October egg, ported from the Halloween section of static/math.js. Every win fills the
	// egg's bar; tapping a full bar gives a spooky Pokémon or a Halloween form. Progress is
	// stored under the he-* keys, and starts over each year.
	import { onMount } from 'svelte';
	import { getStorageInt, hasCookieConsent } from '#lib/storage.js';
	import { pickEventForm, pickForm } from '#lib/game/pokemon.js';

	/** @type {{ stage: string | number, onCatch: (form: string | null) => void }} */
	let { stage, onCatch } = $props();

	const SPOOKY = [19, 20, 52, 53, 88, 89, 92, 93, 94, 105, 187, 198, 200, 215, 222, 228, 228, 261, 262, 264, 275, 302, 353, 354, 355, 356, 359, 425, 426, 429, 430, 434, 435, 442, 452, 461, 477, 478, 479, 487, 491, 509, 510, 562, 563, 570, 571, 607, 608, 609, 629, 630, 633, 634, 635, 679, 680, 681, 708, 709, 710, 711, 717, 720, 769, 770, 778, 781, 792, 799, 800, 802, 827, 828, 854, 855, 859, 860, 861, 862, 864, 867, 877, 885, 886, 887, 893, 897, 898];

	let eggId = $state(0);
	let eggNeeded = $state(3);
	let eggStatus = $state(0);
	let eggSolved = 0;
	let image = $state('images/events/halloween/halloween-egg-01.png');

	const full = $derived(eggStatus >= eggNeeded);

	onMount(() => {
		if (getStorageInt('he-year') !== new Date().getFullYear()) return;
		eggId = getStorageInt('he-eggid');
		image = `images/events/halloween/halloween-egg-0${eggId}.png`;
		eggNeeded = getStorageInt('he-eggneeded');
		eggStatus = getStorageInt('he-eggstatus');
		eggSolved = getStorageInt('he-eggsolved');
	});

	function save() {
		if (!hasCookieConsent()) return;
		if (!isNaN(eggId)) localStorage.setItem('he-eggid', JSON.stringify(eggId));
		if (!isNaN(eggNeeded)) localStorage.setItem('he-eggneeded', JSON.stringify(eggNeeded));
		if (!isNaN(eggSolved)) localStorage.setItem('he-eggsolved', JSON.stringify(eggSolved));
		if (!isNaN(eggStatus)) localStorage.setItem('he-eggstatus', JSON.stringify(eggStatus));
		localStorage.setItem('he-year', JSON.stringify(new Date().getFullYear()));
	}

	/** Called by the game on every win (progressEvent()). */
	export function progress() {
		eggStatus++;
		save();
	}

	function capture() {
		if (!full) return;
		if (Math.random() > 0.7) {
			onCatch(pickEventForm('H'));
		} else {
			const id = SPOOKY[Math.floor(Math.random() * SPOOKY.length)];
			onCatch(pickForm(id, stage));
		}
		eggStatus = 0;
		eggNeeded++;
		if (eggNeeded > 25) eggNeeded = 5;
		eggId = Math.floor(Math.random() * 5) + 1;
		image = `images/events/halloween/halloween-egg-0${eggId}.png`;
		save();
	}
</script>

<!-- A card under the play card. It used to float over the page, where it covered the problem. -->
<section class="egg-card" class:full id="halloween-egg" aria-label="Halloween-egget">
	<img id="halloween-egg-image" src={image} width="88" height="88" alt="" class="egg" class:ready={full} />
	<div class="egg-body">
		<h2>Halloween-egget</h2>
		{#if full}
			<p class="egg-hint">Egget er klart til å klekkes!</p>
		{:else}
			<p class="egg-hint">{eggStatus} av {eggNeeded} seire før det klekkes</p>
		{/if}
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div class="egg-track" onclick={capture}>
			<div class="halloween-progress-inner" style:transform="scaleX({full ? 1 : eggStatus / eggNeeded})"></div>
		</div>
	</div>
	{#if full}
		<button class="pm-button open" onclick={capture}>Åpne!</button>
	{/if}
</section>

<style>
	.egg-card {
		display: flex;
		align-items: center;
		gap: 14px;
		max-width: 620px;
		margin: 16px auto 0;
		padding: 12px 18px 12px 12px;
		border-radius: 20px;
		background: oklch(0.93 0.07 55);
		box-shadow: var(--pm-shadow), 0 0 0 1px oklch(0.8 0.1 55);
		color: var(--pm-ink);
	}
	.egg-card.full {
		box-shadow: var(--pm-shadow), 0 0 0 3px oklch(0.7 0.16 50);
	}
	.egg-body {
		flex: 1;
		min-width: 0;
	}
	h2 {
		margin: 0;
		font-family: var(--pm-display);
		font-weight: 400;
		font-size: 20px;
	}
	.egg-hint {
		margin: 2px 0 8px;
		color: var(--pm-ink-soft);
		font-size: 15px;
	}
	.egg-track {
		position: relative;
		height: 12px;
		overflow: hidden;
		border-radius: 999px;
		background: oklch(0.85 0.06 55);
	}
	/* globalstyle.css already stretches this over the track and animates its scale. */
	.halloween-progress-inner {
		border-radius: 999px;
		background: oklch(0.68 0.17 50);
		opacity: 1;
	}
	.open {
		flex-shrink: 0;
	}

	/* The egg wobbles once when the page opens and keeps wobbling when it is ready to hatch. */
	.egg {
		flex-shrink: 0;
		width: 88px;
		height: 88px;
		animation: egg-wobble 1s ease-in-out 1;
		transform-origin: 50% 90%;
	}
	.egg.ready {
		animation-iteration-count: infinite;
	}
	@keyframes egg-wobble {
		15% { transform: rotate(-12deg); }
		30% { transform: rotate(9deg); }
		45% { transform: rotate(-6deg); }
		60% { transform: rotate(3deg); }
		75% { transform: rotate(-1deg); }
	}
	@media (prefers-reduced-motion: reduce) {
		.egg {
			animation: none;
		}
	}

	@media (max-width: 480px) {
		.egg-card {
			padding: 10px 14px 10px 8px;
		}
		.egg {
			width: 64px;
			height: 64px;
		}
		h2 {
			font-size: 18px;
		}
	}
</style>
