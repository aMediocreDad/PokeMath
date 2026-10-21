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
	let hidden = $state(false);
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

<div class="halloween-egg" class:hide-egg={hidden} id="halloween-egg">
	<img
		id="halloween-egg-image"
		src={image}
		width="150"
		height="150"
		alt=""
		class="halloween-egg-image mt-2 mb-6 egg animate__animated animate__wobble"
		class:animate__infinite={full}
	/>
	<!-- svelte-ignore a11y_consider_explicit_label -->
	<button class="halloween-egg-closer" onclick={() => (hidden = !hidden)}></button>
	<div class="halloween-egg-progress">
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div
			class="halloween-progress-inner"
			class:hallowenOpenEgg={full}
			style:transform="scaleX({full ? 1 : eggStatus / eggNeeded})"
			onclick={capture}
		></div>
	</div>
</div>

<style>
	/* Phones: a smaller egg in the bottom corner. At full size in the top corner it covered the
	   answer field and the +/- button. */
	@media (max-width: 720px) {
		.halloween-egg {
			top: auto;
			bottom: 58px;
			width: 120px;
			height: 120px;
		}
		.halloween-egg.hide-egg {
			transform: translateX(-100px);
		}
		.halloween-egg-image {
			width: 96px;
			height: 96px;
		}
		/* The bar is what you tap to open a full egg, so it stays a usable size. */
		.halloween-egg-progress {
			width: 92px;
			height: 24px;
			max-height: 24px;
		}
		.halloween-egg-closer {
			width: 24px;
			max-width: 24px;
		}
	}
</style>
