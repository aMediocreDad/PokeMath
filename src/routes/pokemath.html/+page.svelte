<script>
	// The math game, ported from static/pokemath.html, math.js and pokestuff.js.
	import { onMount, tick } from 'svelte';
	import { player } from '#lib/player.svelte.js';
	import { layout } from '#lib/layoutState.svelte.js';
	import { toast } from '#lib/toast.svelte.js';
	import { trackEvent } from '#lib/track.js';
	import { logSolved, workOverview } from '#lib/workLog.js';
	import {
		BADGE_IDS,
		incrementProgress,
		progressPokemonTrainerBadge,
		progressTypeAchievement
	} from '#lib/achievements.js';
	import { setupGame, generateProblem, isCorrect, coinsForStage } from '#lib/game/problems.js';
	import { loadPokemonInfo, rollPokemonId, pickForm, rollShiny, describe, catchTitle, catchFacts, baseName } from '#lib/game/pokemon.js';
	import { startBingo, storedBingoCode } from '#lib/bingo.js';
	import { giveSpecificPokemon } from '#lib/game/prizes.js';
	import BingoLootbox from '#lib/game/BingoLootbox.svelte';
	import PokemonCard from '#lib/PokemonCard.svelte';
	import HalloweenEgg from '#lib/game/HalloweenEgg.svelte';
	import XmasPresent from '#lib/game/XmasPresent.svelte';

	const LIVES = 3;
	const GOOD_MESSAGES = ['Flott jobbet!', 'Nice!', 'Ny pokémon!', 'Trykk på ballen!', 'Enda en til samlingen!', 'Fortsett sånn!', 'Stå på!', 'Du er super!', 'Oh, hva får du nå?', 'Eyy! Bra jobbet!'];

	/** @type {import('#lib/game/problems.js').MathValues | null} */
	let values = $state(null);
	let winScore = $state(5);
	/** @type {import('#lib/game/problems.js').Problem | null} */
	let problem = $state(null);
	let answer = $state('');
	/** @type {HTMLInputElement | undefined} */
	let field = $state();

	let score = $state(0);
	let wrongAnswers = $state(0);
	let streak = 0;
	const pointsNeeded = $derived(winScore - score);

	let correctAnimation = $state(false);
	let wrongAnimation = $state(false);

	let overlayOpen = $state(false);
	let endMessage = $state('');
	let showBall = $state(false);
	let showContinue = $state(false);
	let catchImage = $state('');
	let lastSubmitTime = 0;

	/** @type {string[]} Cards shown under the game, newest first. */
	let recent = $state([]);

	// The last five different catches, newest first (what loadAmountFromList(5, true) meant to show;
	// the legacy page ran it before the save had loaded, so the list always started empty).
	// Waits for pokemon_info.json too, since a card cannot be described without it.
	let pokemonInfoReady = $state(false);
	let recentFilled = false;
	$effect(() => {
		if (!player.loaded || !pokemonInfoReady || recentFilled) return;
		recentFilled = true;
		recent = [...new Set([...player.pkmnList].reverse())].slice(0, 5);
	});

	/** 0–11, set in the browser: October has the Halloween egg, December the Christmas present. */
	let month = $state(-1);
	/** @type {{ progress: () => void } | undefined} */
	let halloweenEgg = $state();
	/** @type {{ progress: () => void } | undefined} */
	let xmasPresent = $state();
	let unusedPresentDelay = $state(0);

	/** @type {ReturnType<typeof startBingo> | undefined} */
	let bingo;
	/** @type {import('#lib/bingo.js').Prize[]} Prizes waiting to be revealed. */
	let prizeQueue = $state([]);
	/** @type {{ message: string, position: string } | null} */
	let adminPopup = $state(null);

	const progress = $derived(score / winScore);

	/** @param {string} entry */
	const countOf = (entry) => player.pkmnList.filter((e) => e === entry).length;

	function newProblem() {
		if (!values) return;
		problem = generateProblem(values);
		answer = '';
		field?.focus();
	}

	/** @param {'correct' | 'wrong'} kind */
	function flash(kind) {
		if (kind === 'correct') {
			correctAnimation = true;
			setTimeout(() => (correctAnimation = false), 1001);
		} else {
			wrongAnimation = true;
			setTimeout(() => (wrongAnimation = false), 1001);
		}
	}

	/** @param {SubmitEvent | KeyboardEvent} event */
	function handleSubmit(event) {
		event.preventDefault();
		if (!values || !problem) return;
		if (answer === '') return field?.focus();
		if (score === winScore) return;

		if (isCorrect(values, problem, Number(answer))) {
			score++;
			streak++;
			if (values.stage == 0) {
				// Custom setups that are too easy: you can play, but you earn nothing.
				flash('correct');
				newProblem();
				return checkLogic();
			}

			const coins = coinsForStage(values.stage);
			player.addMoney(coins);
			incrementProgress(BADGE_IDS.bigEarner, coins);
			logSolved(values.stage);
			layout.workOverview = workOverview();
			flash('correct');
			newProblem();

			const tier = ['1', '2', '3', '4', '5'].indexOf(String(values.stage));
			if (tier >= 0) {
				player.tiersSolved[tier]++;
				player.save('tiersSolved');
				incrementProgress(BADGE_IDS.stageMaster(tier + 1));
			} else {
				player.customSolved++;
				player.save('customSolved');
			}
		} else {
			wrongAnswers++;
			streak = 0;
			answer = '';
			field?.focus();
			flash('wrong');
		}
		checkLogic();
	}

	function checkLogic() {
		if (score === winScore) {
			if (values?.stage == 0) {
				resetGame();
				toast('En eller fler av dine egendefinerte valg er for lette, du kan derfor ikke fange pokemon på dette nivået.', { bad: true });
				return;
			}
			// progressEvent(): the seasonal events count wins.
			if (month === 9) halloweenEgg?.progress();
			else if (month === 11) xmasPresent?.progress();
			endMessage = GOOD_MESSAGES[Math.floor(Math.random() * GOOD_MESSAGES.length)];
			overlayOpen = true;
			showBall = true;
		}
		if (wrongAnswers === LIVES) resetGame();
	}

	function resetGame() {
		overlayOpen = false;
		score = 0;
		wrongAnswers = 0;
		catchImage = '';
		showContinue = false;
	}

	function catchContext() {
		return {
			stage: values?.stage ?? 3,
			streak,
			upgrades: { shinyLevel: player.shinyLevel, legendLevel: player.legendLevel, mythicLevel: player.mythicLevel }
		};
	}

	/** The ball was tapped: createRandomPokemon() → createSpecificPokemon(). */
	function throwBall() {
		const ctx = catchContext();
		const id = rollPokemonId(ctx);
		streak = ctx.streak;
		catchForm(pickForm(id, ctx.stage));
	}

	/**
	 * addToPokedex(): roll for shiny, store the catch and show it.
	 * @param {string} form  "25", or "25-1" / "25-H1" for an alternate or event form.
	 */
	function catchForm(form) {
		showBall = false;
		showContinue = true;
		const ctx = catchContext();
		const baitActive = player.shinyBaitCount > 0;
		if (baitActive) {
			player.shinyBaitCount--;
			player.save('shinyBait');
		}
		const entry = (rollShiny(ctx, baitActive) ? 'S' : 'N') + form;
		streak = ctx.streak;

		player.addPokemon(entry);
		trackEvent('/track-catch', {});
		showCatch(entry);
		reportToBingo(entry);
	}

	/** @param {string} entry */
	function reportToBingo(entry) {
		if (!bingo) return;
		const params = new URLSearchParams(location.search);
		const stageParam = params.get('stage');
		const difficulty = stageParam ? `stage${stageParam}` : params.get('custom') ? 'custom' : null;
		bingo.reportCatch({ pokemonCode: entry, difficulty: difficulty || 'stage3', ...catchFacts(entry) });
	}

	/**
	 * applyBingoPrize() from pokestuff.js: give the prizes, then reveal them one by one.
	 * @param {import('#lib/bingo.js').Prize[]} prizes
	 */
	function applyBingoPrizes(prizes) {
		const shown = [];
		for (const prize of prizes) {
			if (prize.type === 'coins') {
				const amount = Number(prize.amount) || 0;
				if (!amount) continue;
				player.money += amount;
				player.save('money');
			} else if (prize.type === 'pokemon') {
				if (!prize.entry) continue;
				giveSpecificPokemon(String(prize.entry));
			} else if (prize.type === 'stardust') {
				player.shinyBaitCount += Number(prize.amount) || 1;
				player.save('shinyBait');
			} else {
				continue;
			}
			shown.push(prize);
		}
		prizeQueue = [...prizeQueue, ...shown];
	}

	/**
	 * A seasonal event hands out a Pokémon: open the win screen and catch it straight away.
	 * @param {string | null} form  null when the event has nothing to give (createEventPokemon()).
	 */
	function eventCatch(form) {
		overlayOpen = true;
		showBall = false;
		showContinue = true;
		if (form) catchForm(form);
	}

	/**
	 * The capture branch of loadFromList(): announce it, count badges, pay for duplicates.
	 * @param {string} entry
	 */
	function showCatch(entry) {
		const card = describe(entry);
		if (card.rarity === 'legendary') incrementProgress(BADGE_IDS.legendary);
		if (card.rarity === 'mythic') incrementProgress(BADGE_IDS.mythic);
		if (card.shiny) incrementProgress(BADGE_IDS.shiny);

		const title = catchTitle(card);
		toast(`Du fanget en ${title}`);
		endMessage = `Du fanget en ${title}!`;
		catchImage = card.image;
		progressPokemonTrainerBadge();
		card.types.forEach(progressTypeAchievement);

		if (countOf(card.entry) > 1) {
			const coins = (100 + player.coinLevel * 20) * card.repeatMultiplier;
			endMessage = `Du fanget en ${title}!\r\nSiden du allerede har denne pokémonen, fikk du ${coins} mynter istedet.`;
			player.addMoney(coins);
			incrementProgress(BADGE_IDS.bigEarner, coins);
		}
		if (!recent.includes(card.entry)) recent = [card.entry, ...recent];
	}

	function swapNegative() {
		answer = String(-Number(answer));
		field?.focus();
	}

	/** @param {KeyboardEvent} event */
	function onFieldKeydown(event) {
		if (event.key !== 'Enter' || overlayOpen) return;
		lastSubmitTime = Date.now();
		handleSubmit(event);
	}

	/**
	 * Enter on the win screen throws the ball, then continues.
	 * @param {KeyboardEvent} event
	 */
	function onDocumentKeydown(event) {
		if (event.key !== 'Enter' || !overlayOpen) return;
		if (Date.now() - lastSubmitTime < 400) return;
		event.preventDefault();
		if (showBall) throwBall();
		else if (showContinue) resetGame();
	}

	$effect(() => {
		document.body.classList.toggle('overlay-is-open', overlayOpen);
		return () => document.body.classList.remove('overlay-is-open');
	});

	onMount(() => {
		loadPokemonInfo().then(() => (pokemonInfoReady = true));
		month = new Date().getMonth();
		// math.js draws a present delay here in December that it never uses. Drawing it keeps the
		// random sequence, and so the game, identical to the original. It is stored because the
		// minifier removes a bare Math.random() call.
		if (month === 11) unusedPresentDelay = 1000 * 180 * Math.random() + 30000;
		// The work overview fills in after the first solved problem, as on the legacy page.

		const params = new URLSearchParams(location.search);
		const setup = setupGame(params);
		values = setup.values;
		winScore = setup.winScore;
		for (const message of setup.messages) toast(message.text, { bad: message.bad, canClose: !setup.cheated });

		/** @type {ReturnType<typeof setTimeout> | undefined} */
		let cheatTimer;
		if (setup.cheated) {
			layout.cheater = true;
			cheatTimer = setTimeout(() => {
				toast('Eller kansje ikke... :P', { canClose: false });
				layout.cheater = false;
			}, 10000);
		}
		tick().then(newProblem);

		const sendMathPing = () => {
			const uuid = localStorage.getItem('UUID');
			if (!uuid) return;
			fetch('/math-ping', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ uuid }),
				keepalive: true
			}).catch(() => {});
		};
		sendMathPing();
		const pingTimer = setInterval(sendMathPing, 300_000);
		trackEvent('/track-stage', { stage: params.get('stage') || (params.get('custom') ? 'custom' : 'unknown') });

		layout.bingoCode = storedBingoCode();
		/** @type {ReturnType<typeof setTimeout> | undefined} */
		let popupTimer;
		bingo = startBingo({
			onPrizes: applyBingoPrizes,
			onCodeChange: (code) => (layout.bingoCode = code),
			onAdminPopup: (message, duration, position) => {
				adminPopup = { message, position };
				clearTimeout(popupTimer);
				popupTimer = setTimeout(() => (adminPopup = null), duration * 1000);
			}
		});

		return () => {
			bingo?.stop();
			bingo = undefined;
			clearTimeout(popupTimer);
			layout.bingoCode = '';
			clearInterval(pingTimer);
			clearTimeout(cheatTimer);
			layout.cheater = false;
			layout.workOverview = null;
		};
	});
</script>

<svelte:head>
	<title>Pokémath</title>
	<meta name="title" content="Pokémath" />
	<meta name="description" content="Mattesiden!" />
	<meta name="robots" content="noindex, nofollow" />
	<link rel="stylesheet" href="/pokemon.css?v=100" />
	<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css" />
</svelte:head>

<svelte:document onkeydown={onDocumentKeydown} />

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

	{#if month === 9 && values}
		<HalloweenEgg bind:this={halloweenEgg} stage={values.stage} onCatch={eventCatch} />
	{/if}

	<div class="main-ui" class:ui-animate-correct={correctAnimation} class:ui-animate-wrong={wrongAnimation}>
		<p class="problem" class:animate-wrong={wrongAnimation}>
			{#if problem}{problem.numberOne} {problem.operator} {problem.numberTwo}{/if}
		</p>
		<div class="input">
			<button class="flip-btn" onclick={swapNegative}>+/-</button>
			<form class="our-form" onsubmit={handleSubmit}>
				<input
					type="number"
					pattern="^\d*(\.\d{'{'}0,5{'}'})?$"
					step="any"
					inputmode="numeric"
					class="our-field"
					autocomplete="off"
					bind:this={field}
					value={answer}
					oninput={(e) => (answer = e.currentTarget.value)}
					onkeydown={onFieldKeydown}
				/>
				<button style="height: 50px">Svar</button>
			</form>
		</div>

		<p class="status">
			Du trenger <span class="points-needed">{pointsNeeded}</span> flere poeng, og kan gjøre
			<span class="mistakes-allowed">{LIVES - 1 - wrongAnswers}</span> feil.
		</p>

		<div class="progress">
			<div class="boxes">
				{#each { length: winScore }, i (i)}<div class="box"></div>{/each}
			</div>
			<div class="progress-inner" style:transform="scaleX({progress})"></div>
		</div>
		<br />
	</div>

	<div class="columns is-multiline is-mobile" id="pokedex">
		{#each recent as entry (entry)}
			<PokemonCard card={describe(entry)} count={countOf(entry)} />
		{/each}
	</div>
	<div class="center" style="margin: auto; align-items: center; text-align: center">
		<a class="button-1 center" style="left: 50%; right: 50%; margin: auto;" href="./dex.html"
			>Klikk her for å se alle dine pokemon.</a
		>
	</div>

	{#if month === 11}
		<XmasPresent bind:this={xmasPresent} stage={values?.stage ?? 3} onCatch={eventCatch} />
	{:else}
		<div class="xmas-present floating"></div>
	{/if}

	<div class="overlay">
		<div class="overlay-inner">
			<p class="end-message">{endMessage}</p>
			<br />
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions, a11y_missing_attribute -->
			<a
				id="pokeball"
				class="pokeball animate__animated animate__wobble animate__repeat-3 mt-2 mb-6"
				class:is-hidden={!showBall}
				aria-label="Kast pokéballen"
				onclick={throwBall}
			></a>
			<a id="new-catch-info" style="white-space:pre;">
				{#if catchImage}
					<div class="has-text-centered">
						<div
							class="pkmn-pop"
							style="background-image: url('{catchImage}'); height: 128px; width: 128px; background-size: cover; display: block;margin-left:auto; margin-right:auto;"
						>
							&nbsp;
						</div>
					</div>
				{/if}
			</a>
			<br />
			<button class="reset-button" class:is-hidden={!showContinue} onclick={resetGame}>Fortsett</button>
		</div>
	</div>
</div>

{#if prizeQueue.length}
	<BingoLootbox prizes={prizeQueue} nameOf={baseName} onDone={() => (prizeQueue = [])} />
{/if}

{#if adminPopup}
	<div id="bingo-admin-popup" class="pos-{adminPopup.position || 'top-center'}">{adminPopup.message}</div>
{/if}

<style>
	/* The message a PokeMorten admin can push to every player in a bingo game. */
	#bingo-admin-popup {
		position: fixed;
		z-index: 99999;
		background: #1f2a44;
		color: #fff;
		padding: 20px 32px;
		border-radius: 16px;
		font-size: 1.6em;
		font-weight: 700;
		box-shadow: 0 8px 36px rgba(0, 0, 0, 0.55);
		max-width: 600px;
		text-align: center;
		pointer-events: none;
		top: 16px;
		left: 50%;
		transform: translateX(-50%);
	}
	.pos-top-left { left: 16px; transform: none; }
	.pos-top-right { left: auto; right: 16px; transform: none; }
	.pos-center { top: 50%; transform: translate(-50%, -50%); }
	.pos-bottom-left { top: auto; bottom: 16px; left: 16px; transform: none; }
	.pos-bottom-center { top: auto; bottom: 16px; }
	.pos-bottom-right { top: auto; bottom: 16px; left: auto; right: 16px; transform: none; }
</style>
