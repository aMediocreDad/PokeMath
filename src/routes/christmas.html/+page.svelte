<script>
	// The Christmas calendar, ported from static/christmas.html and christmas.js. A door opens on its
	// day of December and gives a Pokémon and coins, or a background. Opening all 24 gives four
	// shinies that only the calendar hands out.
	import { onMount } from 'svelte';
	import { player } from '#lib/player.svelte.js';
	import { toast, notify } from '#lib/toast.svelte.js';
	import { giveSpecificPokemon } from '#lib/game/prizes.js';
	import { eventClock } from '#lib/game/eventClock.js';
	import {
		GRID,
		BONUS_ENTRIES,
		BONUS_IMAGE,
		BONUS_MESSAGE,
		doorImage,
		doorReward,
		readOpened,
		recordOpened,
		startYear
	} from '#lib/game/xmasCalendar.js';
	import Fireworks from '#lib/Fireworks.svelte';

	/** Null until the page has mounted: the prerendered page does not know the date. */
	let today = $state(/** @type {{ year: number, month: number, day: number } | null} */ (null));
	let dateText = $state('');
	/** The doors opened this year, as the save has them. */
	let opened = $state(/** @type {number[]} */ ([]));

	const december = $derived(today?.month === 11);
	/** Doors of a day yet to come stay in the save, but do not show: a clock set back changes nothing. */
	const shown = $derived(opened.filter((day) => today && day <= today.day));
	const allOpened = $derived(shown.length > 23);

	/** @type {ReturnType<typeof setTimeout> | undefined} */
	let bonusTimer;

	onMount(() => {
		const date = new Date(eventClock().now());
		dateText = date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
		const now = { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() };
		if (now.month === 11) {
			startYear(localStorage, now.year);
			opened = readOpened(localStorage);
		}
		today = now;
		return () => clearTimeout(bonusTimer);
	});

	/** @param {number} day */
	function stateOf(day) {
		if (shown.includes(day)) return 'opened';
		return today && day <= today.day ? 'ready' : 'locked';
	}

	/** @param {number} day */
	function openDoor(day) {
		if (!today || day > today.day || shown.includes(day)) return;
		// The door is written down before it pays, so that a second tap cannot pay again.
		if (!recordOpened(localStorage, day)) return;
		opened = [...opened, day];
		if (!player.loaded) player.load();

		const reward = doorReward(day, player.boughtBackgrounds);
		if (reward.entry) giveSpecificPokemon(reward.entry);
		if (reward.coins) player.addMoney(reward.coins);
		if (reward.background) {
			player.boughtBackgrounds.push(reward.background);
			player.save('background');
		}
		notify(reward.image, reward.message);
		toast(reward.message);

		if (opened.length > 23) {
			bonusTimer = setTimeout(() => notify(BONUS_IMAGE, BONUS_MESSAGE), 5000);
			toast(BONUS_MESSAGE);
			for (const entry of BONUS_ENTRIES) giveSpecificPokemon(entry);
		}
	}

	/** @param {number} day */
	function label(day) {
		const state = stateOf(day);
		if (state === 'opened') return `Luke ${day}, åpnet`;
		return state === 'ready' ? `Åpne luke ${day}` : `Luke ${day}, låst til ${day}. desember`;
	}
</script>

<svelte:head>
	<title>Pokémath - Julekalender</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="xmas-page">
	<h1 class="above">God Jul!{#if dateText}&nbsp; Dagens dato: {dateText}{/if}</h1>
	{#each { length: 10 }, i (i)}
		<div class="snowflake" style:--i={i} aria-hidden="true">❅</div>
	{/each}

	{#if today && !december}
		<p class="not-yet">Kom tilbake i desember!</p>
	{:else if today}
		<div class="calendar" role="group" aria-label="Julekalender">
			{#each GRID as day (day)}
				<button
					type="button"
					class="door {stateOf(day)}"
					style:background-image={stateOf(day) === 'opened' ? `url(${doorImage(day)})` : null}
					aria-label={label(day)}
					aria-disabled={stateOf(day) !== 'ready'}
					onclick={() => openDoor(day)}
				>
					<span class="num">{day}</span>
				</button>
			{/each}
		</div>
		{#if allOpened}<Fireworks />{/if}
	{/if}
</div>

<style>
	/* The night sky behind the calendar fills the page, not just this column. */
	:global(body:has(.xmas-page)) {
		background: linear-gradient(oklch(0.27 0.045 250), oklch(0.17 0.01 250));
		background-attachment: fixed;
	}
	.xmas-page {
		min-height: calc(100vh - var(--pm-bar-height));
		padding: 0 12px 24px;
		color: #fff;
	}
	.above {
		margin: 0;
		padding: 14px 0 12px;
		font-family: var(--pm-body);
		font-size: 20px;
		font-weight: 400;
		text-align: center;
	}
	.not-yet {
		margin: 40px auto;
		max-width: 520px;
		font-family: var(--pm-display);
		font-size: clamp(32px, 7vw, 56px);
		text-align: center;
	}

	/* The calendar is the picture, 16:9, with the doors on a 4 by 6 grid. */
	.calendar {
		box-sizing: border-box;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		grid-template-rows: repeat(6, 1fr);
		width: min(100%, 1100px);
		aspect-ratio: 16 / 9;
		margin: 0 auto;
		border: 5px solid oklch(0.85 0.13 85);
		border-radius: 6px;
		background: url('/images/backgrounds/bg-019.png') center / cover no-repeat;
		box-shadow: 0 0 20px oklch(0.85 0.12 85 / 0.6);
	}
	/* On a phone the doors would be 30px high: the picture goes upright and is cropped to fit. */
	@media (max-width: 700px) {
		.calendar {
			aspect-ratio: 2 / 3;
		}
	}

	.door {
		position: relative;
		display: grid;
		place-items: center;
		min-width: 0;
		min-height: 44px;
		margin: 0;
		padding: 0;
		border: 2px dashed oklch(0 0 0 / 0.2);
		border-radius: 0.6rem;
		background: transparent center / contain no-repeat;
		color: #fff;
		font-family: var(--pm-display);
		font-size: clamp(24px, 4.2vw, 56px);
		/* White with a dark edge reads on the dark sky and on the snow alike. */
		text-shadow: 0 1px 3px oklch(0.1 0 0 / 0.9), 0 0 10px oklch(0.1 0 0 / 0.55);
		cursor: pointer;
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
	}
	.door:focus-visible {
		outline: 3px solid #fff;
		outline-offset: -3px;
	}
	/* Its day has come: it lights up, so the doors to tap stand out from the ones still shut. */
	.door.ready {
		border-style: solid;
		border-color: oklch(0.88 0.14 85);
		animation: glow 2.4s ease-in-out infinite;
	}
	.door.locked {
		cursor: default;
		color: oklch(1 0 0 / 0.72);
	}
	.door.opened {
		border-color: oklch(0 0 0 / 0.2);
		background-color: #ffffff73;
		cursor: default;
	}
	.door.opened .num {
		position: absolute;
		top: 2px;
		left: 6px;
		color: #fff;
		font-size: 15px;
		text-shadow: 1px 1px 0 oklch(0 0 0 / 0.7);
	}
	@media (max-width: 700px) {
		.above {
			font-size: 16px;
		}
	}
	@keyframes glow {
		50% {
			box-shadow: inset 0 0 14px oklch(0.88 0.14 85 / 0.9);
		}
	}

	.snowflake {
		position: fixed;
		top: -10%;
		left: calc(var(--i) * 10% + 1%);
		z-index: 9999;
		color: #fff;
		font-family: Arial, sans-serif;
		text-shadow: 0 0 1px #000;
		pointer-events: none;
		user-select: none;
		animation: fall 10s linear infinite, sway 3s ease-in-out infinite;
		animation-delay: calc(var(--i) * 0.9s), calc(var(--i) * 0.3s);
	}
	@keyframes fall {
		to {
			top: 100%;
		}
	}
	@keyframes sway {
		50% {
			transform: translateX(60px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.snowflake {
			display: none;
		}
		.door.ready {
			animation: none;
			box-shadow: inset 0 0 8px oklch(0.88 0.14 85 / 0.9);
		}
	}
</style>
