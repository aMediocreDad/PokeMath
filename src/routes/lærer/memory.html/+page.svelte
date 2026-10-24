<script>
	// The teacher's memory screen, made for the projector (worker/memory.js). Pick a board size,
	// let the class join with the code, start, and the children's correct answers earn turns. On a
	// turn the teacher taps the two cards the class calls out. A reload rejoins the same game
	// (teacherMemoryCode).
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import TeacherPage from '#lib/TeacherPage.svelte';
	import { ask } from '#lib/ask.svelte.js';
	import { toast } from '#lib/toast.svelte.js';
	import Fireworks from '#lib/Fireworks.svelte';
	import { ensureTeacher, getTeacherSession } from '#lib/teacher.js';
	import { localSprite } from '#lib/bingoHost.js';
	import Lobby from '#lib/classgame/Lobby.svelte';
	import CodeChip from '#lib/classgame/CodeChip.svelte';
	import ChoiceGroup from '#lib/classgame/ChoiceGroup.svelte';
	import GameControls from '#lib/classgame/GameControls.svelte';
	import PlayerMenu from '#lib/classgame/PlayerMenu.svelte';
	import { CARDS, COLUMNS, MAX_TURNS, SIZES } from '#lib/memoryConfig.js';

	/** @typedef {{ uuid: string, name: string, icon: string, catchCount: number, connected: boolean }} Player */
	/** @typedef {import('#lib/bingo.js').MemoryState} MemoryState */

	const CODE_KEY = 'teacherMemoryCode';
	/** The last setup, so "Nytt memory" can repeat it after a reload too. */
	const CHOICE_KEY = 'teacherMemoryChoice';
	/** How long two cards that do not match stay face up. */
	const PEEK_MS = 1800;

	/** @type {WebSocket | undefined} */
	let ws;
	let teacherSession = '';
	/** False until the stored game has been asked for, so the setup does not flash first. */
	let ready = $state(false);

	let code = $state('');
	let memory = $state(/** @type {MemoryState | null} */ (null));
	/** @type {Player[]} */
	let players = $state([]);
	/** @type {{ name: string, id: number }[]} newest first */
	let answers = $state([]);
	/** @type {string[]} */
	let winners = $state([]);
	/** Two cards that did not match, still face up so the class can remember them. */
	let peek = $state(false);
	/** @type {ReturnType<typeof setTimeout> | undefined} */
	let peekTimer;
	/** The pair just found, for the line above the board. */
	let lastPair = $state(/** @type {number | null} */ (null));
	/** The child whose menu is open (kick, rename), and where. */
	let playerMenu = $state(/** @type {{ player: { uuid?: string, name?: string }, x: number, y: number } | null} */ (null));
	/** @param {{ uuid?: string, name?: string }} player @param {MouseEvent} e */
	function openPlayerMenu(player, e) {
		e.stopPropagation();
		playerMenu = { player, x: e.clientX, y: e.clientY };
	}

	/** @type {Record<string, any>} pokemon_info.json, for the Pokémon's names */
	let info = $state({});
	/** @param {number} id */
	const pokemonName = (id) => info[String(id)]?.['0']?.name || `#${id}`;

	let choice = $state({ size: 'medium', className: '' });
	/** Set by "Nytt memory": once the old game has ended, make a new one with the same setup. */
	let restart = false;

	const ranked = $derived([...players].sort((a, b) => b.catchCount - a.catchCount));
	/** A card is face up when it is matched, or open and not yet turned back after a miss. */
	const faceUp = $derived.by(() => {
		const m = memory;
		if (!m) return [];
		return m.cards.map((c, i) => c.matched || (m.open.includes(i) && (m.open.length === 1 || peek)));
	});
	const canFlip = $derived(Boolean(memory && memory.phase === 'play' && !peek && (memory.turns > 0 || memory.open.length === 1)));
	const meterFull = $derived(Boolean(memory && memory.turns >= MAX_TURNS));
	const prompt = $derived.by(() => {
		if (!memory) return '';
		if (memory.phase === 'won') return 'Alle parene er funnet!';
		if (peek) return 'Ikke et par. Husk hvor de ligger!';
		if (memory.open.length === 1) return 'Velg ett kort til';
		if (memory.turns > 0) return lastPair ? `Par: ${pokemonName(lastPair)}! Velg to nye kort` : 'Klassen har et trekk: velg to kort';
		return 'Svar riktig på oppgaver for å få neste trekk';
	});

	/** @param {any} message */
	function send(message) {
		ws?.send(JSON.stringify({ teacherSession, ...message }));
	}

	let answerId = 0;
	/** @param {any} msg */
	function onMessage(msg) {
		if (msg.type === 'memoryState') {
			code = msg.code;
			localStorage.setItem(CODE_KEY, msg.code);
			memory = msg.memory;
			players = msg.players || [];
			choice.className = msg.className || choice.className;
			answers = (msg.recent || []).map((/** @type {{ name: string }} */ h) => ({ name: h.name, id: answerId++ })).reverse();
			ready = true;
		} else if (msg.type === 'lobbyEnded' || msg.type === 'lobbyState' || msg.type === 'raidState' || msg.type === 'lobbyNotFound') {
			// Another game's code, or a game that has gone: start afresh.
			forget();
			if (restart && msg.type === 'lobbyEnded') {
				restart = false;
				ready = false;
				create();
			}
		} else if (msg.type === 'playersUpdate') {
			players = msg.players;
		} else if (msg.type === 'memoryAnswer') {
			memory = msg.memory;
			players = msg.players;
			answers = [{ name: msg.name, id: answerId++ }, ...answers].slice(0, 8);
		} else if (msg.type === 'memoryFlip') {
			memory = msg.memory;
			if (msg.result === 'match') lastPair = memory?.cards[msg.index]?.id ?? null;
			if (msg.result === 'first') lastPair = null;
			if (msg.result === 'miss') {
				peek = true;
				clearTimeout(peekTimer);
				peekTimer = setTimeout(() => (peek = false), PEEK_MS);
			}
		} else if (msg.type === 'memoryWon') {
			memory = msg.memory;
			winners = msg.winners;
		} else if (msg.type === 'error') {
			toast(msg.message, { bad: true });
		}
	}

	function forget() {
		localStorage.removeItem(CODE_KEY);
		code = '';
		memory = null;
		players = [];
		answers = [];
		winners = [];
		lastPair = null;
		peek = false;
		ready = true;
	}

	function create() {
		localStorage.setItem(CHOICE_KEY, JSON.stringify({ size: choice.size }));
		send({ type: 'hostCreateMemory', settings: { size: choice.size, className: choice.className.trim() } });
	}

	function startGame() {
		send({ type: 'hostStartMemory', code });
	}

	/** @param {number} index */
	function flipCard(index) {
		if (!canFlip || faceUp[index]) return;
		send({ type: 'hostMemoryFlip', code, index });
	}

	/** What ending the game now means for the children, for the confirm boxes. */
	const endNote = () =>
		memory?.phase === 'play' ? ` Barna får mynter for svarene sine${memory.found ? ', og en Pokémon fra parene dere har funnet' : ''}.` : '';

	/**
	 * The room is forgotten when the server says it has ended, not before: an End sent on a
	 * dropped connection would leave the children playing and the coins unpaid.
	 */
	function sendEnd() {
		if (ws?.readyState !== WebSocket.OPEN) {
			toast('Ingen forbindelse akkurat nå. Vent litt og prøv igjen.', { bad: true });
			return false;
		}
		send({ type: 'hostEndLobby', code });
		return true;
	}

	/** Back to the setup. In the lobby this is "Avbryt". */
	async function newSettings() {
		const question = memory?.phase === 'lobby' ? (players.length ? 'Avbryte memory? Barna kobles fra.' : '') : `Velge nye innstillinger?\n\nDette spillet avsluttes.${endNote()}`;
		if (question && !(await ask(question))) return;
		sendEnd();
	}

	/** The same board size again, with new cards and a new code (as bingo's "Nytt brett"). */
	async function newGame() {
		if (!(await ask(`Lage et nytt memory med de samme innstillingene?\n\nDet gamle spillet avsluttes, og elevene må koble til med den nye koden.${endNote()}`, { ok: 'Nytt memory' }))) return;
		restart = sendEnd();
	}

	async function endGame() {
		if (!(await ask(`Avslutte memory? Alle elevene kobles fra.${endNote()}`, { ok: 'Avslutt' }))) return;
		if (sendEnd()) goto('/lærer/index.html');
	}

	/** @param {() => boolean} gone */
	async function start(gone) {
		if (!(await ensureTeacher())) {
			if (!gone()) goto('/lærer/index.html');
			return;
		}
		if (gone()) return;
		teacherSession = getTeacherSession();
		try {
			const saved = JSON.parse(localStorage.getItem(CHOICE_KEY) || 'null');
			if (saved && Object.hasOwn(CARDS, saved.size)) choice.size = saved.size;
		} catch {
			// A broken setup: the defaults do.
		}
		fetch('/pokemon_info.json')
			.then((r) => r.json())
			.then((data) => (info = data))
			.catch(() => {});
		ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`);
		ws.addEventListener('open', () => {
			const stored = (localStorage.getItem(CODE_KEY) || '').toUpperCase().trim();
			if (stored.length === 6) send({ type: 'hostJoinLobby', code: stored });
			else ready = true;
		});
		ws.addEventListener('close', () => {
			// The projector stays on for the whole lesson: come back after a dropped connection.
			if (!gone()) setTimeout(() => !gone() && start(gone), 1500);
		});
		ws.addEventListener('message', (e) => {
			try {
				onMessage(JSON.parse(e.data));
			} catch {
				// Not JSON; ignored.
			}
		});
	}

	onMount(() => {
		let gone = false;
		start(() => gone);
		return () => {
			gone = true;
			clearTimeout(peekTimer);
			ws?.close();
		};
	});
</script>

<svelte:head>
	<title>PokéMath – Memory</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#snippet board(/** @type {MemoryState} */ m)}
	<div class="board" id="memoryBoard" class:waiting={m.phase === 'play' && !canFlip && !peek} style:--cols={COLUMNS[/** @type {keyof typeof COLUMNS} */ (m.size)] || 4}>
		{#each m.cards as card, i (i)}
			<button
				class="card"
				class:up={faceUp[i]}
				class:matched={card.matched}
				data-index={i}
				disabled={m.phase !== 'play' || faceUp[i] || !canFlip}
				aria-label={faceUp[i] && card.id ? pokemonName(card.id) : `Kort ${i + 1}`}
				onclick={() => flipCard(i)}
			>
				<!-- One face at a time, swapped half way through the turn: WebKit drew the back face
				     of a 3D-flipped card blank. -->
				{#key faceUp[i]}
					<span class="face" class:front={faceUp[i]} class:back={!faceUp[i]} aria-hidden="true">
						{#if !faceUp[i]}<span class="ball"></span>{:else if card.id}<img src={localSprite(card.id)} alt="" />{/if}
					</span>
				{/key}
			</button>
		{/each}
	</div>
{/snippet}

<TeacherPage subtitle="Memory" wide back={{ href: '/lærer/index.html', label: 'Lærersiden' }}>
	{#if !ready}
		<p class="muted">Kobler til…</p>
	{:else if !memory}
		<section class="panel" id="memorySetup">
			<h2>Nytt memory</h2>
			<p class="muted">
				Pokémon-par ligger med bildet ned på tavla. Riktige svar fyller klassens måler, og en full måler gir ett trekk: klassen
				sier hvilke to kort du skal snu. Når alle parene er funnet, får alle som var med en av Pokémonene.
			</p>

			<ChoiceGroup id="memorySize" label="Hvor stort brett?" bind:value={choice.size} options={SIZES.map(([value, title, sub]) => ({ value, title, sub }))} />

			<label class="field class-name">
				<span>Klassenavn (valgfritt)</span>
				<input id="memoryClass" type="text" maxlength="40" placeholder="F.eks. 3B" bind:value={choice.className} />
			</label>
			<div class="actions">
				<button class="pm-button" id="createMemoryBtn" onclick={create}>Lag memory</button>
			</div>
		</section>
	{:else if memory.phase === 'lobby'}
		<Lobby {code} {players} startLabel="Start memory" onStart={startGame} onCancel={newSettings} onPlayer={openPlayerMenu}>
			{#snippet stage()}
				{#if memory}
					<div class="stage">
						<h2 class="stage-title">{memory.pairs} par å finne</h2>
						{@render board(memory)}
					</div>
				{/if}
			{/snippet}
		</Lobby>
	{:else}
		<header class="game-top">
			<GameControls newLabel="Nytt memory" endLabel="Avslutt memory" onNew={newGame} onSettings={newSettings} onEnd={endGame} />
			<CodeChip {code} />
		</header>
		<section class="arena" class:won={memory.phase === 'won'}>
			<div class="stage">
				<p class="prompt" id="memoryPrompt" aria-live="polite">{prompt}</p>
				{@render board(memory)}
				<p class="found" id="memoryFound">{memory.found} av {memory.pairs} par funnet</p>
			</div>

			<div class="side">
				{#if memory.phase === 'won'}
					<div class="panel victory" id="memoryVictory">
						<h2>Dere klarte det!</h2>
						<p>Alle som var med, fanger en av Pokémonene på brettet og får mynter for svarene sine.</p>
						{#if winners.length}<p class="muted">{winners.join(', ')}</p>{/if}
					</div>
				{:else}
					<div class="panel meter-panel">
						<h3>Neste trekk</h3>
						<div class="meter" role="meter" aria-label="Svar til neste trekk" aria-valuemin="0" aria-valuemax={memory.turnCost} aria-valuenow={meterFull ? memory.turnCost : memory.pool}>
							<span class="meter-fill" style:width="{meterFull ? 100 : (100 * memory.pool) / Math.max(1, memory.turnCost)}%"></span>
						</div>
						<p class="meter-text" id="memoryMeter">
							{meterFull ? 'Fullt! Bruk et trekk.' : `${memory.pool} / ${memory.turnCost} riktige svar`}
						</p>
						<div class="turns" id="memoryTurns" aria-label="{memory.turns} trekk spart">
							{#each { length: MAX_TURNS }, i (i)}<span class="turn" class:have={i < memory.turns}></span>{/each}
							<span class="turns-label">{memory.turns} trekk spart</span>
						</div>
					</div>
					{#if answers.length}
						<ul class="feed" aria-live="polite" aria-label="Siste svar">
							{#each answers as a (a.id)}<li><strong>{a.name}</strong> svarte riktig</li>{/each}
						</ul>
					{/if}
				{/if}

				<div class="panel players">
					<h3>{players.length} {players.length === 1 ? 'spiller' : 'spillere'}</h3>
					<ul id="memoryPlayers">
						{#each ranked as p (p.uuid)}
							<li class:offline={!p.connected}>
								<button class="name" title="Trykk for alternativer" onclick={(e) => openPlayerMenu(p, e)}>{p.name}</button>
								<span class="count">{p.catchCount}</span>
							</li>
						{/each}
					</ul>
				</div>
			</div>
		</section>
		{#if memory.phase === 'won'}<Fireworks />{/if}
	{/if}
</TeacherPage>

{#if playerMenu}
	<PlayerMenu menu={playerMenu} {code} {send} onClose={() => (playerMenu = null)} />
{/if}

<style>
	h3 {
		margin: 18px 0 8px;
		font-size: 17px;
	}
	.class-name {
		max-width: 320px;
	}
	.game-top {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 16px;
	}
	/* The projector view: the board on the left, everything else beside it; stacked on narrow screens. */
	.arena {
		display: grid;
		grid-template-columns: minmax(0, 3fr) minmax(260px, 1.3fr);
		gap: 20px;
		align-items: start;
	}
	@media (max-width: 760px) {
		.arena {
			grid-template-columns: 1fr;
		}
	}
	/* A dark stage, as the raid's: cream cards on the cream page would not show. */
	.stage {
		display: grid;
		gap: 12px;
		padding: 18px;
		border-radius: var(--pm-radius);
		background: radial-gradient(circle at 50% 30%, oklch(0.42 0.05 265), var(--pm-ink) 75%);
		color: var(--pm-paper);
		box-shadow: var(--pm-shadow);
	}
	.stage-title,
	.prompt,
	.found {
		margin: 0;
		text-align: center;
		font: 400 clamp(22px, 3vw, 32px)/1.1 var(--pm-display);
	}
	.found {
		font-size: clamp(18px, 2.2vw, 24px);
		opacity: 0.85;
		font-variant-numeric: tabular-nums;
	}
	.board {
		display: grid;
		grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
		gap: clamp(6px, 1.2vw, 14px);
		/* Keep the whole board on a projector's screen without scrolling. */
		max-width: min(100%, calc((100dvh - 260px) * var(--cols) / 4 * 0.8));
		margin: 0 auto;
		width: 100%;
	}
	.card {
		aspect-ratio: 4 / 5;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
	}
	.card:disabled {
		cursor: default;
	}
	.face {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		box-sizing: border-box;
		border-radius: 14px;
		animation: turn 260ms ease-out;
	}
	/* The new face grows out from the card's middle, as if the card turned over. */
	@keyframes turn {
		from { transform: scaleX(0); }
	}
	.back {
		background: var(--pm-red);
		border: 3px solid var(--pm-paper);
		box-shadow: 0 6px 14px oklch(0 0 0 / 0.35);
	}
	/* Without a turn the backs dim, so a touch screen shows that tapping does nothing yet. */
	.waiting .back {
		filter: saturate(0.35) brightness(0.75);
		transition: filter 300ms ease;
	}
	.card:not(:disabled):hover .back,
	.card:focus-visible .back {
		outline: 4px solid var(--pm-gold);
		outline-offset: 2px;
	}
	/* A Poké Ball on the back: white lower half, a band and a button. */
	.ball {
		width: 52%;
		aspect-ratio: 1;
		border-radius: 50%;
		background: linear-gradient(to bottom, transparent 46%, var(--pm-ink) 46% 54%, var(--pm-paper) 54%);
		border: 3px solid var(--pm-ink);
		position: relative;
		opacity: 0.9;
	}
	.ball::after {
		content: '';
		position: absolute;
		inset: 34%;
		border-radius: 50%;
		background: var(--pm-paper);
		border: 3px solid var(--pm-ink);
	}
	.front {
		background: var(--pm-paper);
		border: 3px solid var(--pm-paper);
		box-shadow: 0 6px 14px oklch(0 0 0 / 0.35);
	}
	.front img {
		width: 86%;
		height: 86%;
		object-fit: contain;
	}
	.card.matched .front {
		border-color: var(--pm-gold);
		box-shadow: 0 0 18px oklch(0.83 0.15 85 / 0.6);
	}
	@media (prefers-reduced-motion: reduce) {
		.face {
			animation: none;
		}
	}
	.side {
		display: grid;
		gap: 14px;
	}
	.side .panel {
		margin: 0;
	}
	.meter-panel h3 {
		margin-top: 0;
	}
	.meter {
		height: 24px;
		border-radius: 999px;
		background: var(--pm-line);
		overflow: hidden;
	}
	.meter-fill {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--pm-green);
		transition: width 300ms ease;
	}
	.meter-text {
		margin: 8px 0 10px;
		font: 400 22px/1 var(--pm-display);
		font-variant-numeric: tabular-nums;
	}
	.turns {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.turn {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		border: 3px solid var(--pm-line);
	}
	.turn.have {
		border-color: var(--pm-red);
		background: var(--pm-red);
	}
	.turns-label {
		margin-left: 4px;
		font-weight: 700;
	}
	.feed {
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 18px;
	}
	.feed li {
		padding: 6px 2px;
		border-bottom: 1px solid var(--pm-line);
	}
	.feed li:first-child {
		animation: in 300ms ease-out;
	}
	@keyframes in {
		from { opacity: 0; transform: translateY(-8px); }
	}
	.players h3 {
		margin-top: 0;
	}
	.players ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.players li {
		display: flex;
		justify-content: space-between;
		padding: 5px 0;
		border-bottom: 1px solid var(--pm-line);
		font-weight: 700;
	}
	.players li.offline {
		color: var(--pm-ink-soft);
		font-weight: 400;
	}
	.players .name {
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.count {
		font-variant-numeric: tabular-nums;
	}
	.victory h2 {
		margin: 0 0 6px;
	}
</style>
