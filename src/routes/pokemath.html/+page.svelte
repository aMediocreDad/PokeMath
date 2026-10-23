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
	import { createAdaptive, ADAPTIVE_LIVES } from '#lib/game/adaptive.js';
	import { loadPokemonInfo, rollPokemonId, pickForm, rollShiny, describe, catchTitle, catchFacts } from '#lib/game/pokemon.js';
	import { startBingo, storedBingoCode } from '#lib/bingo.js';
	import { giveSpecificPokemon, countEventCatch } from '#lib/game/prizes.js';
	import BingoLootbox from '#lib/game/BingoLootbox.svelte';
	import ClassGameBanner from '#lib/game/ClassGameBanner.svelte';
	import PokemonCard from '#lib/PokemonCard.svelte';
	import HalloweenEgg from '#lib/game/HalloweenEgg.svelte';
	import XmasPresent from '#lib/game/XmasPresent.svelte';

	/** Wrong answers that start the round over: three, or five on the adaptive level. */
	let LIVES = $state(3);
	/** @type {ReturnType<typeof createAdaptive> | null} The adaptive level, when ?adaptive=true. */
	let adaptive = null;
	// The signs Norwegian schools use: a raised dot for times and a colon for division.
	/** @type {Record<string, string>} */
	const SIGN = { x: '·', '/': ':' };
	const GOOD_MESSAGES = ['Flott jobbet!', 'Nice!', 'Ny pokémon!', 'Trykk på ballen!', 'Enda en til samlingen!', 'Fortsett sånn!', 'Stå på!', 'Du er super!', 'Oh, hva får du nå?', 'Eyy! Bra jobbet!'];

	/** @type {import('#lib/game/problems.js').MathValues | null} */
	let values = $state(null);
	let winScore = $state(5);
	/** @type {(import('#lib/game/problems.js').Problem & { startedAt?: number }) | null} */
	let problem = $state(null);
	/** The class game this page reports to (bingo or raid), or '' outside one. */
	let bingoCode = $state('');
	/** @type {Parameters<NonNullable<Parameters<typeof startBingo>[0]['onGame']>>[0] | null} The game behind the code, once the lobby answered. */
	let classGame = $state(null);
	/** Setups that only pretend to be a level (see setupGame) do not hit the raid boss. */
	let cheated = false;
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
	/** @type {import('#lib/game/pokemon.js').PokemonCard | null} The Pokémon on the catch screen. */
	let caughtCard = $state(null);
	let stageLabel = $state('');
	/** Hearts left this round: losing the last one starts the round over. */
	const hearts = $derived(LIVES - wrongAnswers);
	let lastSubmitTime = 0;

	/** @type {string[]} Cards shown under the game, newest first. */
	let recent = $state([]);

	// The last five different catches, newest first (what loadAmountFromList(5, true) meant to show;
	// the legacy page ran it before the save had loaded, so the list always started empty).
	// Waits for pokemon_info.json too, since a card cannot be described without it.
	let pokemonInfoReady = $state(false);
	const raidBoss = $derived.by(() => (classGame?.kind === 'raid' && pokemonInfoReady ? describe(`N${classGame.state.bossId}`).name : 'Bossen'));
	let recentFilled = false;
	$effect(() => {
		if (!player.loaded || !pokemonInfoReady || recentFilled) return;
		recentFilled = true;
		recent = [...new Set([...player.pkmnList].reverse())].slice(0, 5);
	});

	/** 0–11, set in the browser: October has the Halloween egg, December the Christmas present. */
	let month = $state(-1);
	/** 1 April: the problems are shown upside down, after a note once per session (live math.js). */
	let aprilFools = $state(false);
	let aprilNoteOpen = $state(false);
	/** @type {{ progress: () => void } | undefined} */
	let halloweenEgg = $state();
	/** @type {{ progress: () => void } | undefined} */
	let xmasPresent = $state();
	let unusedPresentDelay = $state(0);

	/** @type {ReturnType<typeof startBingo> | undefined} */
	let bingo;
	/** @type {import('#lib/bingo.js').Prize[]} Prizes waiting to be revealed. */
	let prizeQueue = $state([]);
	/**
	 * The prize reveal waits for the win screen to close: the winning hit in a raid often finishes
	 * a round too. Once open it stays until the last prize, so a new win cannot restart it.
	 */
	let lootboxOpen = $state(false);
	$effect(() => {
		if (prizeQueue.length && !overlayOpen && !lootboxOpen) {
			lootboxOpen = true;
			// The reveal covers the page; typing behind it would answer problems unseen.
			field?.blur();
		}
	});
	/** @type {{ message: string, position: string } | null} */
	let adminPopup = $state(null);

	const progress = $derived(score / winScore);

	// The round in progress (score, mistakes, the problem on screen, a ball not thrown yet) is kept
	// on this device, so a reload, a closed tab or a crash does not cost it. There is one round per
	// level (the page's query string), each dropped after a day. It is not part of the cloud save.
	const ROUND_KEY = 'pm-round';
	const ROUND_MAX_AGE = 24 * 60 * 60 * 1000;
	let roundRestored = $state(false);
	/** @typedef {{ score?: number, wrongAnswers?: number, problem?: typeof problem, ball?: boolean, at?: number }} SavedRound */

	/** Every level's saved round, without the ones older than a day. @returns {Record<string, SavedRound>} */
	function readRounds() {
		try {
			const all = JSON.parse(localStorage.getItem(ROUND_KEY) || '{}');
			// The first version kept a single round with its level in `search`.
			const rounds = typeof all?.search === 'string' ? { [all.search]: all } : all && typeof all === 'object' ? all : {};
			return Object.fromEntries(Object.entries(rounds).filter(([, r]) => Date.now() - (r?.at ?? 0) < ROUND_MAX_AGE));
		} catch {
			// A broken value starts every level afresh.
			return {};
		}
	}

	$effect(() => {
		const round = { score, wrongAnswers, problem, ball: showBall, at: Date.now() };
		if (!roundRestored) return;
		try {
			localStorage.setItem(ROUND_KEY, JSON.stringify({ ...readRounds(), [location.search]: round }));
		} catch {
			// Storage full or blocked: the round just is not kept.
		}
	});

	/** Pick up a round left on this level, or start a new one. */
	function restoreRound() {
		/** @type {SavedRound | undefined} */
		const saved = readRounds()[location.search];
		roundRestored = true;
		const usable =
			saved &&
			Number.isInteger(saved.score) &&
			Number.isInteger(saved.wrongAnswers) &&
			/** @type {number} */ (saved.wrongAnswers) < LIVES &&
			typeof saved.problem?.operator === 'string' &&
			Number.isFinite(saved.problem?.numberOne) &&
			Number.isFinite(saved.problem?.numberTwo);
		if (!saved || !usable) return newProblem();
		const s = /** @type {number} */ (saved.score);
		if (saved.ball && s === winScore) {
			// Won, but the ball was not thrown: show it again.
			score = s;
			wrongAnswers = /** @type {number} */ (saved.wrongAnswers);
			endMessage = GOOD_MESSAGES[Math.floor(Math.random() * GOOD_MESSAGES.length)];
			openOverlay();
			showBall = true;
			return;
		}
		if (s >= winScore) return newProblem();
		score = s;
		wrongAnswers = /** @type {number} */ (saved.wrongAnswers);
		problem = { .../** @type {NonNullable<typeof problem>} */ (saved.problem), startedAt: Date.now() };
		answer = '';
		field?.focus();
	}

	/** @param {string} entry */
	const countOf = (entry) => player.pkmnList.filter((e) => e === entry).length;

	function newProblem() {
		if (!values) return;
		problem = adaptive ? adaptive.generate() : generateProblem(values);
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
		if (!values || !problem || lootboxOpen) return;
		if (isBlank(answer)) return field?.focus();
		if (score === winScore) return;

		if (isCorrect(values, problem, toNumber(answer))) {
			score++;
			streak++;
			if (values.stage == 0) {
				// Custom setups that are too easy: you can play, but you earn nothing.
				flash('correct');
				newProblem();
				return checkLogic();
			}

			if (!cheated) bingo?.reportHit();
			const coins = coinsForStage(values.stage);
			player.addMoney(coins);
			incrementProgress(BADGE_IDS.bigEarner, coins);
			logSolved(values.stage);
			layout.workOverview = workOverview();
			const solved = /** @type {NonNullable<typeof problem>} */ (problem);
			flash('correct');
			newProblem();

			const tier = ['1', '2', '3', '4', '5'].indexOf(String(values.stage));
			if (adaptive) {
				player.adaptiveSolved++;
				player.save('adaptiveSolved');
				// As on the live site this measures from the new problem's start, set just above, so
				// a correct answer always counts as fast.
				const elapsed = Date.now() - (problem?.startedAt ?? Date.now());
				const limit = adaptive.timeLimit(solved);
				values.stage = adaptive.record(solved.operator, elapsed <= limit * 0.5 ? 'fast' : elapsed <= limit ? 'golden' : 'slow');
			} else if (tier >= 0) {
				player.tiersSolved[tier]++;
				player.save('tiersSolved');
				incrementProgress(BADGE_IDS.stageMaster(tier + 1));
			} else {
				player.customSolved++;
				player.save('customSolved');
			}
		} else {
			// Adaptive: a wrong answer always costs points, and a new problem comes after a moment.
			if (adaptive) values.stage = adaptive.record(problem.operator, 'slow');
			wrongAnswers++;
			streak = 0;
			answer = '';
			field?.focus();
			flash('wrong');
			if (adaptive && wrongAnswers < LIVES) setTimeout(newProblem, 600);
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
			openOverlay();
			showBall = true;
		}
		if (wrongAnswers === LIVES) resetGame();
	}

	/**
	 * Show the win screen. The answer field keeps focus during a round, so drop it here: an open
	 * keyboard would cover the ball and "Fortsett" on a tablet.
	 */
	function openOverlay() {
		overlayOpen = true;
		field?.blur();
	}

	/** The win screen shows a seasonal event's Pokémon, not a won round: closing it keeps the round. */
	let eventOpen = false;

	/** "Fortsett": a new round after a win, or back to the same round after an event's Pokémon. */
	function closeCatch() {
		if (!eventOpen) return resetGame();
		eventOpen = false;
		overlayOpen = false;
		catchImage = '';
		caughtCard = null;
		showContinue = false;
		field?.focus();
	}

	function resetGame() {
		eventOpen = false;
		overlayOpen = false;
		score = 0;
		wrongAnswers = 0;
		adaptive?.resetRound();
		catchImage = '';
		caughtCard = null;
		showContinue = false;
		// Back to answering; inside the "Fortsett" tap, so iOS brings the keyboard back.
		field?.focus();
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
		if (month === 2 || month === 3) countEventCatch();
		trackEvent('/track-catch', {});
		showCatch(entry);
		reportToBingo(entry);
	}

	/** @param {string} entry */
	function reportToBingo(entry) {
		if (!bingo) return;
		const params = new URLSearchParams(location.search);
		const stageParam = params.get('stage');
		const difficulty =
			params.get('adaptive') === 'true' ? 'tilpasset' : stageParam ? `stage${stageParam}` : params.get('custom') ? 'custom' : null;
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
		eventOpen = true;
		openOverlay();
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
		caughtCard = card;
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
		answer = answer.startsWith('-') ? answer.slice(1) : '-' + answer;
		field?.focus();
	}

	// The answer is typed as text so phones show a keypad with a decimal key. Norwegian keypads
	// type a comma for it, so "2,5" means 2.5.
	/** @param {string} text */
	const toNumber = (text) => Number(text.replace(',', '.'));
	/** Nothing to check yet: the old number field reported "-" or "." as empty too. @param {string} text */
	const isBlank = (text) => text === '' || text === '-' || /^-?[.,]$/.test(text);

	/**
	 * Keep only what a number can contain: a leading minus, digits and one decimal separator.
	 * @param {Event & { currentTarget: HTMLInputElement }} event
	 */
	function onAnswerInput(event) {
		let text = event.currentTarget.value.replace(/[^\d.,-]/g, '');
		const negative = text.startsWith('-');
		text = text.replace(/-/g, '');
		const separator = text.search(/[.,]/);
		if (separator >= 0) text = text.slice(0, separator + 1) + text.slice(separator + 1).replace(/[.,]/g, '');
		answer = (negative ? '-' : '') + text;
		event.currentTarget.value = answer;
	}

	/**
	 * Tapping a button would take focus from the field and close the keyboard after every answer.
	 * @param {MouseEvent} event
	 */
	const keepFocus = (event) => event.preventDefault();

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
		else if (showContinue) closeCatch();
	}

	$effect(() => {
		document.body.classList.toggle('overlay-is-open', overlayOpen);
		return () => document.body.classList.remove('overlay-is-open');
	});

	onMount(() => {
		loadPokemonInfo().then(() => (pokemonInfoReady = true));
		month = new Date().getMonth();
		aprilFools = month === 3 && new Date().getDate() === 1;
		if (aprilFools && !sessionStorage.getItem('af_seen')) aprilNoteOpen = true;
		// math.js draws a present delay here in December that it never uses. Drawing it keeps the
		// random sequence, and so the game, identical to the original. It is stored because the
		// minifier removes a bare Math.random() call.
		if (month === 11) unusedPresentDelay = 1000 * 180 * Math.random() + 30000;
		// The work overview fills in after the first solved problem, as on the legacy page.

		const params = new URLSearchParams(location.search);
		const setup = setupGame(params);
		values = setup.values;
		winScore = setup.winScore;
		stageLabel = setup.custom ? 'Eget nivå' : `Nivå ${setup.values.stage}`;
		if (setup.adaptive) {
			adaptive = createAdaptive();
			values.stage = adaptive.stage();
			LIVES = ADAPTIVE_LIVES;
			stageLabel = 'Tilpasset nivå';
		}
		for (const message of setup.messages) toast(message.text, { bad: message.bad, canClose: !setup.cheated });
		cheated = setup.cheated;

		/** @type {ReturnType<typeof setTimeout> | undefined} */
		let cheatTimer;
		if (setup.cheated) {
			layout.cheater = true;
			cheatTimer = setTimeout(() => {
				toast('Eller kansje ikke... :P', { canClose: false });
				layout.cheater = false;
			}, 10000);
		}
		tick().then(restoreRound);

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

		bingoCode = storedBingoCode();
		/** @type {ReturnType<typeof setTimeout> | undefined} */
		let popupTimer;
		bingo = startBingo({
			onPrizes: applyBingoPrizes,
			onCodeChange: (code) => {
				bingoCode = code;
				if (!code) classGame = null;
			},
			onGame: (game) => {
				const was = classGame?.state.phase;
				if (game.kind === 'raid' && was !== 'won' && game.state.phase === 'won') toast(`Dere klarte det! ${raidBoss} er beseiret!`);
				if (was === 'lobby' && game.state.phase !== 'lobby') toast(game.kind === 'raid' ? 'Raidet har startet!' : 'Bingoen har startet!');
				classGame = game;
			},
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
</svelte:head>

<svelte:document onkeydown={onDocumentKeydown} />

<div class="main game">
	<noscript>
		<p class="noscript">
			JavaScript er ikke aktivert! Pokémath trenger å bruke JavaScript for å fungere. Du kan lese mer om hvordan man kan
			skru på JavaScript <a href="https://support.microsoft.com/nb-no/office/aktivere-javascript-7bb9ee74-6a9e-4dd1-babf-b0a1bb136361"
				>her (microsoft.com)</a
			>.
		</p>
	</noscript>

	{#if bingoCode}
		<ClassGameBanner code={bingoCode} game={classGame} bossName={raidBoss} />
	{/if}

	<section class="play main-ui" class:correct={correctAnimation} class:wrong={wrongAnimation} aria-label="Oppgave">
		<div class="play-top">
			<span class="stage">{stageLabel}</span>
			<span class="hearts" aria-label="{hearts} forsøk igjen">
				{#each { length: LIVES }, i (i)}<span class="heart" class:lost={i >= hearts} aria-hidden="true">♥</span>{/each}
			</span>
		</div>

		<p class="problem" class:shake={wrongAnimation} class:upside-down={aprilFools}>
			{#if problem}{problem.numberOne} {SIGN[problem.operator] ?? problem.operator} {problem.numberTwo}{/if}
		</p>

		<div class="input">
			<button class="flip-btn" onmousedown={keepFocus} onclick={swapNegative} aria-label="Bytt fortegn">+/−</button>
			<form class="our-form" onsubmit={handleSubmit}>
				<input
					type="text"
					inputmode="decimal"
					enterkeyhint="done"
					class="our-field"
					autocomplete="off"
					autocapitalize="off"
					spellcheck="false"
					aria-label="Svar"
					bind:this={field}
					value={answer}
					oninput={onAnswerInput}
					onkeydown={onFieldKeydown}
				/>
				<button class="answer-button pm-button" onmousedown={keepFocus}>Svar</button>
			</form>
		</div>

		<div class="progress" aria-hidden="true">
			<div class="boxes">
				{#each { length: winScore }, i (i)}<div class="box" class:filled={i < score}></div>{/each}
			</div>
		</div>
		<p class="status">
			Du trenger <span class="points-needed">{pointsNeeded}</span> flere poeng, og kan gjøre
			<span class="mistakes-allowed">{LIVES - 1 - wrongAnswers}</span> feil.
		</p>
	</section>

	{#if month === 9 && values}
		<HalloweenEgg bind:this={halloweenEgg} stage={values.stage} onCatch={eventCatch} />
	{/if}

	<section class="recent" aria-label="Siste fangster">
		{#if recent.length}
			<h2>Siste fangster</h2>
		{/if}
		<div class="cards" id="pokedex">
			{#each recent as entry (entry)}
				<PokemonCard card={describe(entry)} count={countOf(entry)} />
			{/each}
		</div>
		<a class="pm-button secondary all-link" href="./dex.html">Se alle dine Pokémon</a>
	</section>

	{#if month === 11}
		<XmasPresent bind:this={xmasPresent} stage={values?.stage ?? 3} onCatch={eventCatch} />
	{/if}

	<div class="catch" class:open={overlayOpen} role="dialog" aria-modal="true" aria-label="Fangst">
		<div class="catch-stage">
			{#if caughtCard}
				<div class="burst {caughtCard.rarity}" aria-hidden="true"></div>
			{/if}
			<p class="end-message" class:headline={!caughtCard}>{endMessage}</p>
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions, a11y_missing_attribute -->
			<a id="pokeball" class="ball" class:is-hidden={!showBall} role="button" tabindex="0" aria-label="Kast pokéballen" onclick={throwBall}>
				<span class="ball-button"></span>
			</a>
			{#if showBall}<p class="hint">Trykk på ballen!</p>{/if}
			<div id="new-catch-info">
				{#if catchImage}
					<div class="pkmn-pop sprite" style="background-image: url('{catchImage}');" role="img" aria-label={caughtCard?.name}></div>
					{#if caughtCard?.shiny}
						<div class="sparkles" aria-hidden="true">{#each [0, 1, 2, 3, 4] as i (i)}<span></span>{/each}</div>
					{/if}
				{/if}
			</div>
			{#if caughtCard}
				<div class="caught-types">
					{#if caughtCard.shiny}<span class="caught-tag">✨ Shiny</span>{/if}
					{#if caughtCard.rarity === 'legendary'}<span class="caught-tag">Legendarisk</span>{/if}
					{#if caughtCard.rarity === 'mythic'}<span class="caught-tag">Mytisk</span>{/if}
					{#each caughtCard.types as type, i (i)}<span class="caught-type">{type}</span>{/each}
				</div>
			{/if}
			<button class="reset-button pm-button" class:is-hidden={!showContinue} onclick={closeCatch}>Fortsett</button>
		</div>
	</div>
</div>

{#if aprilNoteOpen}
	<div class="april" role="dialog" aria-modal="true" aria-labelledby="april-title">
		<div class="april-box pm-surface">
			<p class="april-kicker">Viktig melding fra Pokémath</p>
			<h2 id="april-title">Banebrytende forskning endrer måten vi løser matte på</h2>
			<p>
				Forskere ved University of Wollongong i Australia har nylig dokumentert at å løse matteoppgaver <strong>opp-ned</strong> øker
				aktiviteten i prefrontal cortex med <strong>340%</strong>, og resulterer i signifikant forbedret Pokémon-fangstrate.
			</p>
			<p>Pokémath tar forskning på alvor og har implementert dette funnet med umiddelbar virkning. Vi beklager eventuelle ulemper.</p>
			<p class="april-source">Kilde: Journal of Inverted Mathematics, vol. 4, s. 1 (2025)</p>
			<button
				id="af-close"
				class="pm-button"
				onclick={() => {
					aprilNoteOpen = false;
					sessionStorage.setItem('af_seen', '1');
					field?.focus();
				}}>Forstått. La oss begynne.</button
			>
		</div>
	</div>
{/if}

{#if lootboxOpen}
	<BingoLootbox
		prizes={prizeQueue}
		onDone={() => {
			prizeQueue = [];
			lootboxOpen = false;
			// Inside the closing tap, so iOS brings the keyboard back.
			field?.focus();
		}}
	/>
{/if}

{#if adminPopup}
	<div id="bingo-admin-popup" class="pos-{adminPopup.position || 'top-center'}">{adminPopup.message}</div>
{/if}

<style>
	.game {
		max-width: 760px;
		margin: 0 auto;
		padding: 16px 14px 32px;
	}
	.noscript {
		padding: 12px;
		border-radius: 12px;
		background: var(--pm-red-soft);
	}

	/* ── The play card: kept near the top, since the keyboard covers the lower half of a tablet ── */
	.play {
		max-width: 620px;
		margin: 0 auto;
		padding: 16px 20px 18px;
		border-radius: 24px;
		background: var(--pm-paper);
		box-shadow: var(--pm-shadow), 0 0 0 1px var(--pm-line);
		transition: box-shadow 300ms ease-out;
	}
	.play.correct {
		box-shadow: var(--pm-shadow), 0 0 0 4px var(--pm-green);
	}
	.play.wrong {
		box-shadow: var(--pm-shadow), 0 0 0 4px var(--pm-red);
	}
	.play-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.stage {
		padding: 4px 12px;
		border-radius: 999px;
		background: var(--pm-cream);
		font-family: var(--pm-display);
		font-size: 17px;
	}
	.hearts {
		display: flex;
		gap: 4px;
		font-size: 24px;
		line-height: 1;
		color: var(--pm-red);
	}
	.heart.lost {
		color: var(--pm-line);
	}

	.problem {
		margin: 6px 0 14px;
		font-family: var(--pm-display);
		font-size: clamp(56px, 13vw, 96px);
		line-height: 1.05;
		text-align: center;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.02em;
		overflow-wrap: anywhere;
	}
	.problem.shake {
		animation: shake 420ms ease-out;
	}
	@keyframes shake {
		20% { transform: translateX(-10px); }
		40% { transform: translateX(8px); }
		60% { transform: translateX(-6px); }
		80% { transform: translateX(3px); }
	}

	/* The answer row: a field and buttons big enough for fingers. */
	.input {
		display: flex;
		gap: 10px;
		align-items: stretch;
		max-width: 460px;
		margin: 0 auto;
	}
	.our-form {
		display: flex;
		flex: 1;
		gap: 10px;
		min-width: 0;
	}
	.our-field {
		flex: 1;
		min-width: 0;
		height: 60px;
		box-sizing: border-box;
		padding: 0 12px;
		border: 3px solid var(--pm-line);
		border-radius: 16px;
		background: var(--pm-cream);
		color: var(--pm-ink);
		/* At least 16px, or iOS zooms the page when the field is focused. */
		font-family: var(--pm-display);
		font-size: 30px;
		text-align: center;
		outline: none;
		transition: border-color 120ms ease-out;
	}
	.our-field:focus {
		border-color: var(--pm-ink);
		background: var(--pm-paper);
	}
	.flip-btn {
		min-width: 60px;
		height: 60px;
		border: none;
		border-radius: 16px;
		background: var(--pm-cream);
		box-shadow: 0 0 0 2px var(--pm-line) inset, 0 4px 0 var(--pm-line);
		color: var(--pm-ink);
		font-family: var(--pm-display);
		font-size: 22px;
		cursor: pointer;
		touch-action: manipulation;
	}
	.flip-btn:active {
		transform: translateY(3px);
		box-shadow: 0 0 0 2px var(--pm-line) inset, 0 1px 0 var(--pm-line);
	}
	.answer-button {
		height: 60px;
		padding: 0 24px;
	}

	.progress {
		margin: 18px 0 8px;
	}
	.boxes {
		display: flex;
		gap: 8px;
	}
	.box {
		flex: 1;
		height: 18px;
		border-radius: 999px;
		background: var(--pm-cream);
		box-shadow: 0 0 0 2px var(--pm-line) inset;
		transition: background-color 250ms ease-out;
	}
	.box.filled {
		background: var(--pm-green);
		box-shadow: 0 -3px 0 var(--pm-green-deep) inset;
	}
	.status {
		margin: 0;
		color: var(--pm-ink-soft);
		font-size: 16px;
		text-align: center;
	}

	/* ── Recent catches ────────────────────────────────────────────────────────── */
	.recent {
		margin-top: 28px;
		text-align: center;
	}
	.recent h2 {
		margin: 0 0 12px;
		font-family: var(--pm-display);
		font-weight: 400;
		font-size: 22px;
	}
	.cards {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 12px;
	}
	.all-link {
		margin-top: 20px;
	}

	/* ── The win and catch screen ──────────────────────────────────────────────── */
	.catch {
		display: none;
		position: fixed;
		inset: 0;
		z-index: 1300;
		place-items: center;
		padding: 24px;
		background: oklch(0.24 0.04 265 / 0.94);
		color: var(--pm-paper);
		text-align: center;
	}
	.catch.open {
		display: grid;
	}
	.catch-stage {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
		width: min(520px, 100%);
	}
	.end-message {
		position: relative;
		margin: 0;
		font-family: var(--pm-display);
		font-size: clamp(26px, 6vw, 36px);
		line-height: 1.15;
		white-space: pre-line;
	}
	.end-message.headline {
		font-size: clamp(34px, 9vw, 52px);
		animation: rise 400ms ease-out both;
	}
	.hint {
		margin: -4px 0 0;
		opacity: 0.8;
	}

	/* A Pokéball drawn in CSS, so the page needs no animation library. */
	.ball {
		position: relative;
		display: block;
		width: 150px;
		height: 150px;
		border-radius: 50%;
		background: linear-gradient(to bottom, var(--pm-red) 0 46%, var(--pm-ink) 46% 54%, var(--pm-paper) 54% 100%);
		box-shadow: 0 0 0 6px var(--pm-ink), 0 18px 30px -10px oklch(0 0 0 / 0.6);
		cursor: pointer;
		animation: wobble 1.4s ease-in-out infinite;
	}
	.ball.is-hidden {
		display: none;
	}
	.ball-button {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 44px;
		height: 44px;
		margin: -22px 0 0 -22px;
		border-radius: 50%;
		background: var(--pm-paper);
		box-shadow: 0 0 0 6px var(--pm-ink), 0 0 0 10px var(--pm-paper) inset;
	}
	.ball:active {
		animation: none;
		transform: scale(0.94);
	}
	@keyframes wobble {
		0%, 60%, 100% { transform: rotate(0); }
		70% { transform: rotate(-14deg); }
		80% { transform: rotate(10deg); }
		90% { transform: rotate(-5deg); }
	}

	.burst {
		position: absolute;
		left: 50%;
		top: 46%;
		width: 520px;
		height: 520px;
		margin: -260px 0 0 -260px;
		border-radius: 50%;
		background: repeating-conic-gradient(oklch(0.83 0.15 85 / 0.22) 0 10deg, transparent 10deg 24deg);
		mask-image: radial-gradient(circle, black 30%, transparent 70%);
		-webkit-mask-image: radial-gradient(circle, black 30%, transparent 70%);
		animation: spin 18s linear infinite;
		pointer-events: none;
	}
	/* A legendary's burst is denser, brighter gold with a glow in the middle; a mythic's is a violet
	   swirl. Same rays and glow as Aura on the cards. */
	.burst.legendary {
		background:
			radial-gradient(circle, oklch(0.9 0.15 90 / 0.7), transparent 45%),
			repeating-conic-gradient(oklch(0.83 0.16 80 / 0.55) 0 9deg, transparent 9deg 22.5deg);
		animation-duration: 12s;
	}
	.burst.mythic {
		background:
			radial-gradient(circle, oklch(0.9 0.08 320 / 0.7), transparent 45%),
			conic-gradient(
				oklch(0.72 0.17 330 / 0.6),
				oklch(0.7 0.15 290 / 0.1),
				oklch(0.75 0.12 220 / 0.55),
				oklch(0.7 0.15 290 / 0.1),
				oklch(0.72 0.17 330 / 0.6)
			);
		animation-duration: 10s;
	}
	@keyframes spin {
		to { transform: rotate(1turn); }
	}
	#new-catch-info {
		position: relative;
	}
	.sprite {
		width: min(240px, 60vw);
		aspect-ratio: 1;
		background-size: contain;
		background-position: center;
		background-repeat: no-repeat;
		filter: drop-shadow(0 16px 18px oklch(0 0 0 / 0.45));
		animation: pop 500ms cubic-bezier(0.22, 1, 0.36, 1) both;
	}
	/* A shiny's twinkle on the catch screen, like the sparkle the games play on a shiny. */
	.sparkles {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	.sparkles span {
		position: absolute;
		width: 26px;
		aspect-ratio: 1;
		background: oklch(0.97 0.08 95);
		clip-path: polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%);
		filter: drop-shadow(0 0 6px oklch(0.85 0.15 85));
		opacity: 0;
		animation: twinkle 1.6s ease-in-out infinite;
	}
	.sparkles span:nth-child(1) { top: 8%; left: 14%; animation-delay: 0.5s; }
	.sparkles span:nth-child(2) { top: 18%; right: 8%; width: 34px; animation-delay: 0.8s; }
	.sparkles span:nth-child(3) { bottom: 22%; left: 4%; width: 18px; animation-delay: 1.1s; }
	.sparkles span:nth-child(4) { bottom: 10%; right: 18%; animation-delay: 1.4s; }
	.sparkles span:nth-child(5) { top: 44%; right: 0; width: 16px; animation-delay: 1.7s; }
	@keyframes twinkle {
		0%, 100% { opacity: 0; transform: scale(0.3) rotate(0deg); }
		50% { opacity: 1; transform: scale(1) rotate(45deg); }
	}
	@keyframes pop {
		from { opacity: 0; transform: scale(0.4) translateY(30px); }
		to { opacity: 1; transform: scale(1) translateY(0); }
	}
	@keyframes rise {
		from { opacity: 0; transform: translateY(12px); }
		to { opacity: 1; transform: translateY(0); }
	}
	.caught-types {
		position: relative;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 6px;
	}
	.caught-type,
	.caught-tag {
		padding: 4px 12px;
		border-radius: 999px;
		background: oklch(1 0 0 / 0.14);
		font-weight: 700;
		text-transform: capitalize;
	}
	.caught-tag {
		background: var(--pm-gold);
		color: var(--pm-ink);
	}
	.reset-button {
		position: relative;
		min-width: 200px;
		min-height: 56px;
		font-size: 26px;
	}
	.reset-button.is-hidden {
		display: none;
	}

	@media (max-width: 480px) {
		.play {
			padding: 12px 14px 14px;
		}
		.flip-btn {
			min-width: 52px;
		}
		.answer-button {
			padding: 0 16px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.ball,
		.burst,
		.sprite,
		.sparkles span,
		.end-message.headline,
		.problem.shake {
			animation: none;
		}
		.sparkles span {
			opacity: 1;
		}
	}

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

	.problem.upside-down {
		transform: rotate(180deg);
	}
	.april {
		position: fixed;
		inset: 0;
		z-index: 1400;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
		background: oklch(0.2 0.03 265 / 0.65);
	}
	.april-box {
		max-width: 400px;
		padding: 26px 24px;
	}
	.april-kicker {
		margin: 0 0 6px;
		color: var(--pm-ink-soft);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.april-box h2 {
		margin: 0 0 12px;
		font-family: var(--pm-display);
		font-weight: 400;
		font-size: 22px;
		line-height: 1.25;
	}
	.april-box p {
		line-height: 1.55;
	}
	.april-source {
		color: var(--pm-ink-soft);
		font-size: 13px;
		font-style: italic;
	}
	.april-box .pm-button {
		width: 100%;
	}
</style>
