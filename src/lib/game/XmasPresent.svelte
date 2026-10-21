<script>
	// The December present, ported from the Christmas section of static/math.js. After three
	// wins a present is hidden somewhere on the page; tapping it gives a Christmas form.
	import { onMount } from 'svelte';
	import { pickEventForm } from '#lib/game/pokemon.js';

	/** @type {{ stage: string | number, onCatch: (form: string | null) => void }} */
	let { stage, onCatch } = $props();

	let counter = 3;
	let hidden = $state(false);
	let image = $state('');
	let top = $state('');
	let left = $state('');
	/** @type {ReturnType<typeof setTimeout> | undefined} */
	let showTimer;

	onMount(() => () => clearTimeout(showTimer));

	function move() {
		hidden = true;
		const id = Math.floor(Math.random() * 7 + 1);
		image = `url(./images/events/christmas/present-${id}.png)`;
		top = 92 * Math.random() + '%';
		left = 92 * Math.random() + '%';
	}

	/** Called by the game on every win (progressEvent()). */
	export function progress() {
		counter--;
		if (counter !== 0) return;
		const delay = 1000 * (120 * Math.random()) + 30000 + (15 / Number(stage)) * 10000;
		move();
		showTimer = setTimeout(() => (hidden = false), delay);
	}

	function open() {
		if (counter > 0 || hidden) return;
		counter = 2;
		move();
		onCatch(pickEventForm('C'));
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
	class="xmas-present floating"
	class:is-hidden={hidden}
	style:background-image={image}
	style:top
	style:left
	onclick={open}
></div>

<style>
	/* From static/pokemon.css, which the game page no longer loads. */
	.xmas-present {
		position: absolute;
		width: 100px;
		height: 100px;
		background-size: contain;
		z-index: 1001;
		cursor: pointer;
	}
	.xmas-present.is-hidden {
		display: none;
	}
	.floating {
		animation: floating 3s ease-in-out infinite;
		margin-left: 30px;
		margin-top: 5px;
	}
	@keyframes floating {
		50% {
			transform: translateY(15px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.floating {
			animation: none;
		}
	}
</style>
