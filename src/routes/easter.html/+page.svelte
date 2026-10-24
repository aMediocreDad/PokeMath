<script>
	// The spring event, ported from static/easter.html and easter.js. Every Pokémon caught in March
	// and April fills two bars: this device's (500, a prize for every 50) and everyone's together
	// (1 500 000, a prize for every 150 000, and three bonus prizes beyond). A reached prize is an egg
	// to tap; the Pokémon and coins are paid when it opens.
	import { onMount } from 'svelte';
	import { player } from '#lib/player.svelte.js';
	import { giveSpecificPokemon } from '#lib/game/prizes.js';
	import { eventClock } from '#lib/game/eventClock.js';
	import BingoLootbox from '#lib/game/BingoLootbox.svelte';
	import {
		EASTER_END,
		EXTRA_PRIZES,
		GLOBAL_CAP,
		GLOBAL_PRIZES,
		GLOBAL_STEP,
		LOCAL_CAP,
		LOCAL_PRIZES,
		LOCAL_STEP,
		SEG_COUNT,
		markClaimed,
		readCaught,
		readClaimed,
		readTimestamps,
		startYear
	} from '#lib/game/springEvent.js';

	/** @typedef {import('#lib/game/springEvent.js').Prize} Prize */
	/** @typedef {'easterClaimed' | 'easterGlobalClaimed' | 'easterExtraClaimed'} ClaimKey */

	const EGG = '/images/events/easter/Spr_4d_Egg.png';
	const SECOND = 1000;
	const MINUTE = 60 * SECOND;

	/** @param {number} n */
	const format = (n) => n.toLocaleString('nb-NO');
	/** @param {number} ms */
	function formatTime(ms) {
		if (!ms) return '';
		const date = new Date(ms);
		return (
			date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }) +
			' ' +
			date.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
		);
	}
	/** @param {number} threshold */
	const globalLabel = (threshold) =>
		threshold >= 1_000_000 ? format(threshold / 1_000_000) + 'M' : format(threshold / 1000) + 'k';

	let clock = /** @type {ReturnType<typeof eventClock> | null} */ (null);
	/** The time, for the countdown. 0 until the page has mounted. */
	let now = $state(0);
	let local = $state({
		caught: 0,
		claimed: /** @type {number[]} */ ([]),
		timestamps: /** @type {Record<string, number>} */ ({}),
		globalClaimed: /** @type {number[]} */ ([]),
		extraClaimed: /** @type {number[]} */ ([])
	});
	let globalTotal = $state(0);
	let milestones = $state(/** @type {{ segment: number, reached_at: string | number }[]} */ ([]));
	/** The counts as shown: they count up to the real ones. Null for the global one until it is known. */
	let localShown = $state(0);
	let globalShown = $state(/** @type {number | null} */ (null));
	/** The prize being opened. */
	let lootbox = $state(/** @type {import('#lib/bingo.js').Prize | null} */ (null));

	const left = $derived(EASTER_END.getTime() - now);

	/** @type {Record<string, number>} */
	const frames = {};
	/**
	 * Count a number up (or down) to `to` over 600 ms, with the easing of the legacy page.
	 * @param {'local' | 'global'} which
	 * @param {number | null} from
	 * @param {number} to
	 */
	function countTo(which, from, to) {
		const set = (/** @type {number} */ n) => (which === 'local' ? (localShown = n) : (globalShown = n));
		cancelAnimationFrame(frames[which]);
		if (from === null || from === to || matchMedia('(prefers-reduced-motion: reduce)').matches) return set(to);
		const start = performance.now();
		const step = (/** @type {number} */ time) => {
			const t = Math.min((time - start) / 600, 1);
			const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
			set(t < 1 ? Math.round(from + (to - from) * ease) : to);
			if (t < 1) frames[which] = requestAnimationFrame(step);
		};
		frames[which] = requestAnimationFrame(step);
	}

	/** Read this device's part of the save again. */
	function refresh() {
		startYear(localStorage, new Date((clock ?? eventClock()).now()).getFullYear());
		const caught = readCaught(localStorage);
		countTo('local', localShown, caught);
		local = {
			caught,
			claimed: readClaimed(localStorage, 'easterClaimed'),
			timestamps: readTimestamps(localStorage),
			globalClaimed: readClaimed(localStorage, 'easterGlobalClaimed'),
			extraClaimed: readClaimed(localStorage, 'easterExtraClaimed')
		};
	}

	/** Ask for everyone's count. One more try after 15 seconds if it fails. @param {boolean} [retry] */
	async function fetchGlobal(retry = true) {
		try {
			const response = await fetch('/api/easter/global');
			if (!response.ok) throw new Error(String(response.status));
			const data = await response.json();
			const total = Number(data.total) || 0;
			countTo('global', globalShown, total);
			globalTotal = total;
			milestones = data.milestones || [];
		} catch {
			if (retry) retryTimer = setTimeout(() => fetchGlobal(false), 15 * SECOND);
		}
	}

	/** @type {ReturnType<typeof setTimeout> | undefined} */
	let retryTimer;

	onMount(() => {
		clock = eventClock();
		now = clock.now();
		refresh();
		fetchGlobal();

		const tick = setInterval(() => (now = /** @type {NonNullable<typeof clock>} */ (clock).now()), SECOND);
		// Everyone's count is asked for once a minute, and not while the tab is hidden.
		/** @type {ReturnType<typeof setInterval> | undefined} */
		let poll = setInterval(fetchGlobal, MINUTE);
		const onVisibility = () => {
			clearInterval(poll);
			poll = undefined;
			if (document.hidden) return;
			refresh();
			fetchGlobal();
			poll = setInterval(fetchGlobal, MINUTE);
		};
		// Another tab, or the game, changed the save.
		const onStorage = (/** @type {StorageEvent} */ e) => e.key?.startsWith('easter') && refresh();
		document.addEventListener('visibilitychange', onVisibility);
		window.addEventListener('storage', onStorage);
		return () => {
			clearInterval(tick);
			clearInterval(poll);
			clearTimeout(retryTimer);
			cancelAnimationFrame(frames.local);
			cancelAnimationFrame(frames.global);
			document.removeEventListener('visibilitychange', onVisibility);
			window.removeEventListener('storage', onStorage);
		};
	});

	/**
	 * @param {number} index
	 * @param {number} total
	 * @param {number} step
	 * @param {number[]} claimed
	 */
	function stateOf(index, total, step, claimed) {
		if (claimed.includes(index)) return 'claimed';
		return total >= (index + 1) * step ? 'reached' : 'locked';
	}

	/** When the global block was reached, from the Worker. @param {number} index */
	function globalTime(index) {
		const reached = milestones.find((m) => m.segment === index + 1)?.reached_at;
		return reached ? formatTime(new Date(reached).getTime()) : '';
	}

	/**
	 * Open an egg: write the prize down as taken, pay it, and show it.
	 * @param {Prize} prize
	 * @param {ClaimKey} key
	 * @param {number} index
	 * @param {number} threshold  What the bar must have reached.
	 * @param {number} total  What it has reached.
	 */
	function claim(prize, key, index, threshold, total) {
		if (total < threshold || !markClaimed(localStorage, key, index)) return;
		if (!player.loaded) player.load();
		giveSpecificPokemon(prize.entry);
		player.addMoney(prize.coins);
		lootbox = {
			type: 'pokemon',
			entry: prize.entry,
			pokedexId: prize.imageid,
			shiny: prize.entry.startsWith('S'),
			legendary: false,
			source: 'easter',
			easterCoins: prize.coins,
			easterName: prize.name
		};
		refresh();
	}
</script>

<svelte:head>
	<title>Pokémath - Våren er her!</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<!-- A bar with ten milestones, and under it the ten prizes. -->
{#snippet milestoneRow(/** @type {number} */ total, /** @type {number} */ step, /** @type {Prize[]} */ prizes, /** @type {number[]} */ claimed, /** @type {boolean} */ isGlobal, /** @type {ClaimKey} */ key, /** @type {string} */ name)}
	{@const cap = step * SEG_COUNT}
	<div class="track" role="progressbar" aria-label={name} aria-valuemin="0" aria-valuemax={cap} aria-valuenow={Math.min(total, cap)}>
		<div class="fill" style:width="{Math.min((total / cap) * 100, 100)}%"></div>
		{#each prizes as _, i (i)}
			{@const state = stateOf(i, total, step, claimed)}
			<div class="dot {state}" style:left="{((i + 1) / SEG_COUNT) * 100}%">{state === 'claimed' ? '✓' : i + 1}</div>
		{/each}
	</div>
	<ul class="grid">
		{#each prizes as prize, i (i)}
			{@const state = stateOf(i, total, step, claimed)}
			{@const threshold = (i + 1) * step}
			{@const time = isGlobal ? globalTime(i) : formatTime(local.timestamps[i + 1])}
			<li class="item {state}">
				<div class="threshold">{isGlobal ? globalLabel(threshold) : threshold}</div>
				{#if state === 'claimed'}
					<img class="art" src="/images/pokemon/normal/{prize.imageid}.webp" alt={prize.name} title={prize.name} loading="lazy" />
				{:else if state === 'reached'}
					<button type="button" class="egg" title="Klikk for å åpne!" aria-label="Åpne egget for {isGlobal ? globalLabel(threshold) : threshold}" onclick={() => claim(prize, key, i, threshold, total)}>
						<img src={EGG} alt="" />
					</button>
				{:else}
					<div class="unknown" aria-label="Ikke nådd ennå">?</div>
				{/if}
				<div class="coins">{format(prize.coins)} mynter</div>
				{#if time}<div class="time">{time}</div>{/if}
				<div class="action">
					{#if state === 'claimed'}<span class="check" title="Hentet"></span>{:else if state === 'locked'}<span class="lock" title="Ikke nådd ennå"></span>{/if}
				</div>
			</li>
		{/each}
	</ul>
{/snippet}

<div class="easter-page">
	<h1>Våren er her!</h1>
	<p class="lead">Fang Pokémon ved å løse matteoppgaver og lås opp vårpremier!</p>

	<div class="countdown" id="easterCountdown" aria-live="off">
		{#if !now}
			Laster…
		{:else if left <= 0}
			Eventet er avsluttet.
		{:else}
			Avsluttes om:
			<span class="pill">{Math.floor(left / 86400000)}d</span>
			<span class="pill">{Math.floor((left % 86400000) / 3600000)}t</span>
			<span class="pill">{String(Math.floor((left % 3600000) / 60000)).padStart(2, '0')}m</span>
			<span class="pill">{String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}s</span>
		{/if}
	</div>

	<section class="bars">
		<div class="bar-title">Din progresjon <span class="count">{format(localShown)} / {format(LOCAL_CAP)}</span></div>
		{@render milestoneRow(local.caught, LOCAL_STEP, LOCAL_PRIZES, local.claimed, false, 'easterClaimed', 'Din progresjon')}
	</section>

	<section class="bars">
		<div class="bar-title">Global progresjon <span class="count">{globalShown === null ? '–' : format(globalShown)} / {format(GLOBAL_CAP)}</span></div>
		{@render milestoneRow(globalTotal, GLOBAL_STEP, GLOBAL_PRIZES, local.globalClaimed, true, 'easterGlobalClaimed', 'Global progresjon')}
	</section>

	{#if globalTotal >= GLOBAL_CAP}
		<section class="extras">
			<div class="extras-header">
				<span class="badge">⭐ EKSTRA</span>
				<span class="extras-title">Globale bonusmål</span>
				<span class="extras-sub">Dere knuste målet! Her er ekstra belønninger!</span>
			</div>
			<div class="cards">
				{#each EXTRA_PRIZES as prize, i (i)}
					{@const reached = globalTotal >= prize.threshold}
					{@const claimed = local.extraClaimed.includes(i)}
					<div class="card {claimed ? 'claimed' : reached ? 'reached' : 'locked'}">
						<div class="card-label">⭐ Ekstra mål</div>
						<div class="card-threshold">{format(prize.threshold / 1_000_000)}M Pokémon fanget globalt</div>
						<div class="card-art">
							{#if claimed}
								<img class="art" src="/images/pokemon/normal/{prize.imageid}.webp" alt={prize.name} title={prize.name} loading="lazy" />
							{:else if reached}
								<button type="button" class="egg" title="Klikk for å åpne!" aria-label="Åpne egget for {format(prize.threshold / 1_000_000)}M" onclick={() => claim(prize, 'easterExtraClaimed', i, prize.threshold, globalTotal)}>
									<img src={EGG} alt="" />
								</button>
							{:else}
								<div class="unknown" aria-label="Ikke nådd ennå">?</div>
							{/if}
						</div>
						<div class="card-name">{claimed || reached ? prize.name : '???'}</div>
						<div class="card-coins">{format(prize.coins)} mynter</div>
						<div class="card-bar">
							<div class="card-track"><div class="card-fill" style:width="{Math.min((globalTotal / prize.threshold) * 100, 100)}%"></div></div>
							<div class="card-count">{format(globalTotal)} / {format(prize.threshold)}</div>
						</div>
						{#if claimed}<div class="card-status">✓ Hentet</div>{/if}
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<p class="info">Fang Pokémon ved å løse matteoppgaver for å fylle opp baren din!<br />Global fremgang oppdateres automatisk hvert 60. sekund.</p>
</div>

{#if lootbox}
	<BingoLootbox prizes={[lootbox]} onDone={() => (lootbox = null)} />
{/if}

<style>
	/* The spring colours belong to this page only, so they are kept here and not in the layout. */
	.easter-page {
		--eg: #eab308;
		--eg-light: #fef9c3;
		--eg-dark: #713f12;
		--eg-glow: rgba(234, 179, 8, 0.35);
		--sp-orange: #fb923c;
		--sp-purple: #a78bfa;
		--sp-purple-l: #ede9fe;
		--card-border: 1.5px solid rgba(167, 139, 250, 0.35);
		box-sizing: border-box;
		min-height: calc(100vh - var(--pm-bar-height));
		max-width: 980px;
		margin: 0 auto;
		padding: 24px 16px 48px;
	}
	/* The soft spring sky fills the page, not just this column. */
	:global(body:has(.easter-page)) {
		background: linear-gradient(150deg, #fef9c3 0%, #fef3c7 30%, #dcfce7 65%, #ffe4e6 100%);
	}

	h1 {
		margin: 0 0 10px;
		font-family: var(--pm-display);
		font-size: clamp(40px, 9vw, 58px);
		font-weight: 400;
		line-height: 1.1;
		text-align: center;
		color: #fde047;
		text-shadow:
			0 1px 0 #d97706,
			0 2px 0 #c96a00,
			0 3px 0 #b85c00,
			0 4px 0 #a84e00,
			0 6px 16px rgba(0, 0, 0, 0.28),
			0 0 40px rgba(234, 179, 8, 0.7);
		-webkit-text-stroke: 1.5px rgba(161, 61, 0, 0.25);
	}
	.lead {
		margin: 0 0 20px;
		color: var(--pm-ink-soft);
		font-size: 17px;
		text-align: center;
	}

	.countdown {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 8px;
		margin-bottom: 22px;
		padding: 12px 20px;
		border: 1.5px solid rgba(234, 179, 8, 0.45);
		border-radius: var(--pm-radius);
		background: linear-gradient(135deg, #fef9c3 0%, #ffedd5 60%, #ffe4e6 100%);
		box-shadow: var(--pm-shadow);
		color: var(--eg-dark);
		font-size: 17px;
		font-weight: 700;
	}
	.pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 2.6em;
		padding: 3px 10px;
		border: 2px solid var(--eg);
		border-radius: 8px;
		background: #fff;
		box-shadow: 0 2px 6px var(--eg-glow);
		font-variant-numeric: tabular-nums;
		font-weight: 700;
	}

	.bars {
		margin-bottom: 22px;
		padding: 20px 20px 24px;
		border: var(--card-border);
		border-radius: var(--pm-radius);
		background: linear-gradient(135deg, rgba(237, 233, 254, 0.82), rgba(255, 255, 255, 0.65));
		box-shadow: var(--pm-shadow);
	}
	.bar-title {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--eg-dark);
		font-family: var(--pm-display);
		font-size: 20px;
	}
	.count {
		padding: 2px 10px;
		border-radius: 20px;
		background: var(--eg-light);
		color: #b45309;
		font-family: var(--pm-body);
		font-size: 14px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.track {
		position: relative;
		height: 20px;
		margin: 24px 14px 0;
		border: 2px solid rgba(234, 179, 8, 0.25);
		border-radius: 10px;
		background: #fef9c3;
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.06);
	}
	.fill {
		position: absolute;
		inset: 0 auto 0 0;
		overflow: hidden;
		border-radius: 10px;
		background: linear-gradient(90deg, #4ade80, #eab308, #fb923c, #fb7185);
		box-shadow: 0 0 14px var(--eg-glow), inset 0 1px 0 rgba(255, 255, 255, 0.28);
		transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
	}
	.fill::after {
		content: '';
		position: absolute;
		inset: 0 auto 0 -60%;
		width: 60%;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.28), transparent);
		animation: shimmer 2.5s ease infinite;
	}
	@keyframes shimmer {
		to {
			left: 150%;
		}
	}
	.dot {
		position: absolute;
		top: 50%;
		z-index: 2;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border: 3px solid;
		border-radius: 50%;
		font-size: 11px;
		font-weight: 700;
		pointer-events: none;
		transform: translate(-50%, -50%);
	}
	.dot.locked {
		border-color: #e5d9a0;
		background: #fefce8;
		color: #c9b96a;
	}
	.dot.reached {
		border-color: var(--eg);
		background: var(--eg-light);
		box-shadow: 0 0 10px var(--eg-glow);
		color: var(--eg-dark);
	}
	.dot.claimed {
		border-color: var(--sp-orange);
		background: linear-gradient(135deg, #eab308, #fb923c);
		box-shadow: 0 0 14px rgba(251, 146, 60, 0.4);
		color: #fff;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(10, minmax(0, 1fr));
		gap: 7px;
		margin: 14px 0 0;
		padding: 0;
		list-style: none;
	}
	.item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 5px;
		min-width: 0;
		padding: 10px 4px 11px;
		border: 1.5px solid rgba(167, 139, 250, 0.35);
		border-radius: 10px;
		background: rgba(237, 233, 254, 0.55);
		text-align: center;
	}
	.item.locked {
		opacity: 0.6;
	}
	.item.reached {
		border-color: var(--eg);
		background: linear-gradient(160deg, var(--eg-light) 0%, var(--sp-purple-l) 100%);
	}
	.item.claimed {
		border-color: var(--sp-purple);
		background: linear-gradient(160deg, #fef9c3 0%, #ddd6fe 100%);
		box-shadow: 0 2px 10px rgba(167, 139, 250, 0.3);
	}
	.threshold {
		color: #92400e;
		font-size: 13px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.art,
	.egg img,
	.unknown {
		width: 58px;
		height: 58px;
	}
	.art {
		object-fit: contain;
	}
	.unknown {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 2px solid #e5d9a0;
		border-radius: 8px;
		background: linear-gradient(135deg, #fef9c3, #fef3c7);
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.06);
		color: #c9a227;
		font-family: var(--pm-display);
		font-size: 28px;
		user-select: none;
	}
	.egg {
		display: block;
		min-width: 44px;
		min-height: 44px;
		margin: 0;
		padding: 0;
		border: none;
		background: transparent;
		cursor: pointer;
		touch-action: manipulation;
	}
	.egg:focus-visible {
		outline: 3px solid var(--pm-ink);
		outline-offset: 2px;
		border-radius: 12px;
	}
	.egg img {
		display: block;
		object-fit: contain;
		image-rendering: pixelated;
		animation: bounce 1s ease-in-out infinite;
	}
	.egg:hover img {
		animation-duration: 0.45s;
	}
	@keyframes bounce {
		0%,
		100% {
			transform: translateY(0) rotate(-2deg);
		}
		40% {
			transform: translateY(-8px) rotate(2deg);
		}
		65% {
			transform: translateY(-4px) rotate(-1deg);
		}
	}
	.coins {
		color: #a07800;
		font-size: 12.5px;
		font-weight: 700;
		line-height: 1.25;
	}
	.time {
		color: #6b6b6b;
		font-size: 11px;
		line-height: 1.3;
	}
	.action {
		min-height: 18px;
		line-height: 1;
	}
	.check {
		position: relative;
		display: inline-block;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: linear-gradient(135deg, var(--eg), var(--sp-orange));
		vertical-align: middle;
	}
	.check::after {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		width: 5px;
		height: 9px;
		border-right: 2.5px solid #fff;
		border-bottom: 2.5px solid #fff;
		transform: translate(-48%, -60%) rotate(45deg);
	}
	.lock {
		position: relative;
		display: inline-block;
		width: 12px;
		height: 12px;
		margin-top: 4px;
		border: 2px solid #e5d9a0;
		border-radius: 2px;
		background: #fef9c3;
	}
	.lock::before {
		content: '';
		position: absolute;
		top: -6px;
		left: 50%;
		width: 8px;
		height: 6px;
		border: 2px solid #e5d9a0;
		border-bottom: none;
		border-radius: 4px 4px 0 0;
		transform: translateX(-50%);
	}

	/* Ten prizes in a row are too narrow for a phone: two rows of five. */
	@media (max-width: 760px) {
		.grid {
			grid-template-columns: repeat(5, minmax(0, 1fr));
		}
		.bars {
			padding: 16px 12px 18px;
		}
		.track {
			margin-inline: 10px;
		}
		.dot {
			width: 24px;
			height: 24px;
			border-width: 2px;
			font-size: 10px;
		}
	}

	.info {
		margin: 16px 0 0;
		color: #6b6b6b;
		font-size: 13px;
		line-height: 1.8;
		text-align: center;
	}

	.extras {
		margin-bottom: 22px;
	}
	.extras-header {
		position: relative;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		margin-bottom: 14px;
		padding: 14px 18px;
		overflow: hidden;
		border: 2px solid var(--eg);
		border-radius: var(--pm-radius);
		background: linear-gradient(135deg, #fef9c3 0%, #fef3c7 40%, #ffe4e6 100%);
		box-shadow: 0 0 20px rgba(234, 179, 8, 0.25), var(--pm-shadow);
	}
	.badge {
		flex-shrink: 0;
		padding: 4px 12px;
		border-radius: 20px;
		background: linear-gradient(135deg, var(--eg), var(--sp-orange));
		box-shadow: 0 2px 8px rgba(234, 179, 8, 0.4);
		color: #fff;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.06em;
		white-space: nowrap;
	}
	.extras-title {
		color: var(--eg-dark);
		font-family: var(--pm-display);
		font-size: 19px;
	}
	.extras-sub {
		color: #b45309;
		font-size: 14px;
		font-weight: 600;
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 16px;
	}
	.card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 20px 16px 18px;
		border-radius: var(--pm-radius);
		text-align: center;
	}
	.card.locked {
		border: 1.5px solid rgba(167, 139, 250, 0.3);
		background: linear-gradient(160deg, rgba(237, 233, 254, 0.55), rgba(255, 255, 255, 0.4));
		opacity: 0.75;
	}
	.card.reached {
		border: 2px solid var(--eg);
		background: linear-gradient(160deg, #fef9c3 0%, #fef3c7 50%, #ffe4e6 100%);
		box-shadow: 0 0 18px rgba(234, 179, 8, 0.3), var(--pm-shadow);
		animation: pulse 2.5s ease-in-out infinite;
	}
	.card.claimed {
		border: 2px solid var(--sp-purple);
		background: linear-gradient(160deg, #fef9c3 0%, #ddd6fe 100%);
		box-shadow: 0 2px 14px rgba(167, 139, 250, 0.35);
	}
	@keyframes pulse {
		50% {
			box-shadow: 0 0 28px rgba(234, 179, 8, 0.55), 0 0 50px rgba(251, 146, 60, 0.2);
		}
	}
	.card-label {
		padding: 2px 10px;
		border: 1px solid rgba(234, 179, 8, 0.4);
		border-radius: 20px;
		background: var(--eg-light);
		color: var(--eg-dark);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.08em;
	}
	.card-threshold {
		color: #92400e;
		font-size: 14px;
		font-weight: 700;
		line-height: 1.3;
	}
	.card-art {
		margin: 4px 0;
	}
	.card-name {
		min-height: 1.2em;
		color: #6d28d9;
		font-size: 14px;
		font-weight: 700;
	}
	.card-coins {
		color: #a07800;
		font-size: 13px;
		font-weight: 700;
	}
	.card-bar {
		width: 100%;
		margin-top: 4px;
	}
	.card-track {
		height: 10px;
		overflow: hidden;
		border: 1.5px solid rgba(234, 179, 8, 0.25);
		border-radius: 6px;
		background: #fef9c3;
	}
	.card-fill {
		height: 100%;
		border-radius: 6px;
		background: linear-gradient(90deg, #4ade80, #eab308, #fb923c);
		transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
	}
	.card-count {
		margin-top: 4px;
		color: #6b6b6b;
		font-size: 12px;
		font-variant-numeric: tabular-nums;
	}
	.card-status {
		padding: 3px 12px;
		border-radius: 20px;
		background: rgba(167, 139, 250, 0.15);
		color: #7c3aed;
		font-size: 13px;
		font-weight: 700;
	}

	@media (prefers-reduced-motion: reduce) {
		.fill::after,
		.egg img,
		.card.reached {
			animation: none;
		}
		.fill,
		.card-fill {
			transition: none;
		}
	}
</style>
