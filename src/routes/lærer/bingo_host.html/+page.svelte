<script>
	// The bingo for the classroom screen, ported from static/lærer/bingo_host.html and
	// bingo_host_tasks.js. Like the raid it goes setup, waiting room, play: the teacher picks the
	// settings, the class joins with the code over the /ws WebSocket, and after Start their catches
	// mark cells. A reload rejoins the same lobby (teacherBingoCode).
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { ensureTeacher, getTeacherSession } from '#lib/teacher.js';
	import TeacherPage from '#lib/TeacherPage.svelte';
	import BingoSetup from '#lib/classgame/BingoSetup.svelte';
	import Lobby from '#lib/classgame/Lobby.svelte';
	import CodeChip from '#lib/classgame/CodeChip.svelte';
	import GameControls from '#lib/classgame/GameControls.svelte';
	import PlayerMenu from '#lib/classgame/PlayerMenu.svelte';
	import Icon from '#lib/Icon.svelte';
	import { ask } from '#lib/ask.svelte.js';
	import {
		DIFF_NO,
		catchPrefix,
		checkNewMilestones,
		fmtTime,
		freeSpacePrize,
		launchConfetti,
		localSprite,
		logHover,
		nok,
		prizeSummary
	} from '#lib/bingoHost.js';

	/** @typedef {import('#lib/bingoHost.js').Cell} Cell */
	/** @typedef {{ uuid?: string, name?: string, icon?: string, connected?: boolean, catchCount?: number }} Player */
	/** @typedef {{ t: string, b?: boolean, dim?: boolean }} Seg */

	/** @type {WebSocket | undefined} */
	let ws;
	let teacherSession = '';
	let settings = $state(
		/** @type {{ difficulty?: string, minLevel?: string, allowAdaptive?: boolean, gridSize?: number, className?: string, prizeType?: string, prizeSecret?: boolean }} */ ({})
	);

	let currentCode = $state('');
	/** False until the stored lobby has been asked for, so the setup does not flash first. */
	let ready = $state(false);
	/** @type {'lobby' | 'play'} The lobby's phase (worker/bingo.js); the setup shows while there is no code. */
	let phase = $state('lobby');
	let difficulty = $state('');
	let className = $state('');
	/** @type {Cell[]} */
	let cells = $state([]);
	/** The board is N×N, 5×5 up to 15×15 (live bingo_host_tasks.js, 2026-10). */
	let boardN = $state(5);
	/** Cell height in px; null fits the board to the screen. The slider sets it by hand. */
	let manualSize = $state(/** @type {number | null} */ (null));
	let autoSize = $state(/** @type {number | null} */ (null));
	/** Cells too narrow for a name show only the picture; the tooltip has the rest. */
	let compact = $state(false);
	/** @type {HTMLTableElement | undefined} */
	let boardEl = $state();
	/** The player whose menu is open, and where. */
	let playerMenu = $state(/** @type {{ player: Player, x: number, y: number } | null} */ (null));
	/** The cell shown in the corner on boards of 9×9 and up, where names do not fit. */
	let tooltipCell = $state(/** @type {Cell | null} */ (null));
	/** @type {Player[]} */
	let players = $state([]);
	let totalCatches = $state(0);
	/** @type {any[]} */
	let events = $state([]);
	let logVisible = $state(true);
	/** @type {'joined' | 'alpha' | 'catches'} */
	let sortMode = $state('joined');
	let showCatches = $state(true);
	let muted = $state(false);
	/** @type {Set<string>} cells flashing for a milestone */
	let flashing = $state(new Set());
	/** Advances every 1.5 s; unsolved range cells show the next Pokémon in their range. */
	let tick = $state(0);
	/** @type {{ kind: 'info' | 'match' | 'low', lines: Seg[][] } | null} */
	let toast = $state(null);
	/** @type {{ message: Seg[], button?: string, action?: () => void } | null} */
	let banner = $state(null);
	/** @type {ReturnType<typeof prizeSummary> | null} */
	let prize = $state(null);
	/** The prize has been handed out; the board takes no more catches. */
	let locked = $state(false);
	/** @type {{ message: string, position: string } | null} */
	let adminPopup = $state(null);
	let potPop = $state(false);

	/** @type {HTMLCanvasElement | undefined} */
	let confettiCanvas = $state();

	const celebrated = new Set();
	/** @type {Set<string>} */
	let knownPlayers = new Set();
	/** Extra details from toastCatch, merged into the log line from boardUpdate (eventExtraCache). */
	const eventExtra = new Map();

	const connectedCount = $derived(players.filter((p) => p.connected).length);
	const sortedPlayers = $derived.by(() => {
		const list = [...players];
		if (sortMode === 'alpha') list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'no'));
		if (sortMode === 'catches') list.sort((a, b) => (b.catchCount || 0) - (a.catchCount || 0));
		return list;
	});
	const shownEvents = $derived(events.slice(-60).reverse());
	const freePrize = $derived(freeSpacePrize(settings, players.length, totalCatches));
	const cellSize = $derived(manualSize ?? autoSize);
	const rows = $derived(Array.from({ length: boardN }, (_, r) => cells.slice(r * boardN, r * boardN + boardN)));

	const status = (/** @type {string} */ text) => console.log('[BINGO HOST]', text);

	/** @param {any} message */
	function send(message) {
		ws?.send(JSON.stringify({ teacherSession, ...message }));
	}

	/** @type {ReturnType<typeof setTimeout> | undefined} */
	let toastTimer;
	/** @param {'info' | 'match' | 'low'} kind @param {Seg[][]} lines */
	function showToast(kind, lines) {
		toast = { kind, lines };
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = null), 3000);
	}

	/** @param {number} n */
	function setTotal(n) {
		totalCatches = Number(n || 0);
		if (settings.prizeType === 'participation_coins' && !settings.prizeSecret) {
			potPop = true;
			setTimeout(() => (potPop = false), 350);
		}
	}

	/** @param {Player[]} list */
	function playersUpdate(list) {
		for (const p of list) {
			if (p.uuid && !knownPlayers.has(p.uuid) && p.connected) {
				showToast('info', [[{ t: p.name || 'Ash', b: true }, { t: ' koblet til!' }]]);
				knownPlayers.add(p.uuid);
			}
		}
		players = list;
	}

	/** @param {any} msg */
	function loadLobby(msg) {
		currentCode = msg.code;
		ready = true;
		phase = msg.phase === 'lobby' ? 'lobby' : 'play';
		localStorage.setItem('teacherBingoCode', msg.code);
		difficulty = msg.board?.difficulty || '';
		locked = Boolean(msg.locked);
		className = msg.className || '';
		setBoard(msg.board);
		playersUpdate(msg.players || []);
		setTotal(msg.totalCatches || 0);
	}

	/** @param {any} board */
	function setBoard(board) {
		cells = board?.cells ?? [];
		boardN = board?.cols || board?.rows || 5;
	}

	/**
	 * Fit the cells to the screen (adjustBoardSize()): as tall as the board is wide per cell, and
	 * short enough to see the whole board where the screen allows. A 5×5 board keeps its design size.
	 */
	function fitBoard() {
		if (!boardEl) return;
		const spacing = innerWidth <= 640 ? 3 : 6;
		const overhead = (boardN + 1) * spacing + 2 * spacing;
		const widthFit = Math.floor((boardEl.clientWidth - overhead) / boardN);
		compact = widthFit < 44;
		if (boardN === 5) return (autoSize = null);
		const heightFit = Math.floor((innerHeight - boardEl.getBoundingClientRect().top - 16 - overhead) / boardN);
		autoSize = Math.max(24, Math.min(150, widthFit, Math.max(heightFit, widthFit * 0.6)));
	}

	$effect(() => {
		void boardN;
		void boardEl;
		requestAnimationFrame(fitBoard);
	});

	/** @param {Player} p @param {MouseEvent} e */
	function openPlayerMenu(p, e) {
		e.stopPropagation();
		playerMenu = { player: p, x: e.clientX, y: e.clientY };
	}

	/** @param {string} icon  Icon names are stored lower case; the files start with a capital. */
	const iconSrc = (icon) => `/images/playericons/${icon.charAt(0).toUpperCase() + icon.slice(1)}.webp`;

	/** A missing .webp falls back to the .png under the stored name, once. @param {Event} e @param {string} icon */
	function pngFallback(e, icon) {
		const img = /** @type {HTMLImageElement} */ (e.currentTarget);
		if (img.getAttribute('src')?.endsWith('.webp')) img.src = `/images/playericons/${icon}.png`;
	}

	/** What the corner tooltip shows for a cell; an unsolved Pokédex cell stays a mystery. @param {Cell} cell */
	function tooltipFor(cell) {
		const rule = cell.task?.rule;
		const image = cell.task?.image ? `/${String(cell.task.image).replace(/^\//, '')}` : '';
		const img = rule?.kind === 'pokedexExact' ? image || localSprite(rule.id ?? 0) : rule?.kind === 'pokedexRange' ? localSprite(rule.start ?? 0) : image;
		const silhouette = !cell.marked && rule?.kind === 'pokedexExact';
		return { img, silhouette, name: silhouette ? '???' : cell.task?.name || '', desc: silhouette ? '' : cell.task?.description || '', hits: cell.hits || 0 };
	}

	/** @type {ReturnType<typeof setTimeout> | undefined} */
	let pressTimer;
	let pressShown = false;
	/** On touch, a long press shows the tooltip without marking the cell. @param {PointerEvent} e @param {Cell} cell */
	function cellPointerDown(e, cell) {
		pressShown = false;
		clearTimeout(pressTimer);
		if (e.pointerType === 'mouse' || boardN < 9 || cell.free) return;
		pressTimer = setTimeout(() => {
			pressShown = true;
			tooltipCell = cell;
		}, 450);
	}
	function cellPointerUp() {
		clearTimeout(pressTimer);
		if (pressShown) setTimeout(() => (tooltipCell = null), 2500);
	}

	/** @param {typeof settings} chosen */
	function createLobby(chosen = settings) {
		settings = chosen;
		status('Oppretter ny lobby…');
		knownPlayers = new Set();
		events = [];
		celebrated.clear();
		send({
			type: 'hostCreateLobby',
			settings: {
				difficulty: settings.difficulty || 'easy',
				minLevel: settings.minLevel || 'alle',
				allowAdaptive: !!settings.allowAdaptive,
				gridSize: settings.gridSize || 5,
				className: settings.className || '',
				prizeType: settings.prizeType || 'random',
				prizeSecret: !!settings.prizeSecret
			}
		});
	}

	async function newGame() {
		if (currentCode && !(await ask('Lage et nytt brett med de samme innstillingene?\n\nDet gamle brettet avsluttes, og elevene må koble til med den nye koden.', { ok: 'Nytt brett' }))) return;
		const oldCode = localStorage.getItem('teacherBingoCode');
		localStorage.removeItem('teacherBingoCode');
		if (oldCode && ws?.readyState === WebSocket.OPEN) {
			try {
				send({ type: 'hostEndLobby', code: oldCode });
			} catch {
				// The old lobby times out on the server anyway.
			}
		}
		createLobby();
	}

	function endLobby() {
		const code = currentCode;
		currentCode = '';
		locked = false;
		prize = null;
		players = [];
		localStorage.removeItem('teacherBingoCode');
		celebrated.clear();
		try {
			send({ type: 'hostEndLobby', code });
		} catch {
			// Nothing to end if the socket is gone.
		}
	}

	/** End the game with the prize now, for when the lesson runs out before the board is full. */
	async function giveNow() {
		if (!currentCode || locked || !(await ask('Dele ut premien nå? Bingoen stopper, og alle som har fanget minst én Pokémon får premien.', { ok: 'Del ut' }))) return;
		send({ type: 'hostLockLobby', code: currentCode });
	}

	async function endGame() {
		if (!currentCode || !(await ask('Avslutte bingoen? Alle elevene kobles fra.', { ok: 'Avslutt' }))) return;
		endLobby();
		goto('/lærer/index.html');
	}

	/** Back to the setup. In the waiting room this is "Avbryt". */
	async function backToSettings() {
		const question = phase === 'lobby' ? (players.length ? 'Avbryte bingoen? Elevene kobles fra.' : '') : 'Velge nye innstillinger?\n\nDette brettet avsluttes, og alle elevene kobles fra.';
		if (question && !(await ask(question))) return;
		if (currentCode) endLobby();
	}

	function startBingo() {
		send({ type: 'hostStartBingo', code: currentCode });
	}

	/** @param {Cell} cell */
	async function toggleCell(cell) {
		if (cell.free || pressShown) return;
		if (cell.marked && !(await ask(`Fjerne godkjenning for «${cell.task?.name || cell.cellId}»?`, { ok: 'Fjern' }))) return;
		send({ type: 'hostMarkCell', code: currentCode, cellId: cell.cellId, mark: !cell.marked });
	}

	function playSound(/** @type {string} */ file) {
		if (localStorage.getItem('bingoMuted') === '1') return;
		try {
			new Audio('/audio/' + file).play();
		} catch {
			// Sound is a bonus.
		}
	}

	/** When the board was last seen full, so the prize can wait for the celebration. */
	let fullAt = 0;

	/** @param {import('#lib/bingoHost.js').Milestone[]} milestones */
	function celebrate(milestones) {
		for (const m of milestones) {
			if (confettiCanvas) launchConfetti(confettiCanvas, m.intensity);
			const ids = m.indices.map((i) => cells[i]?.cellId).filter(Boolean);
			flashing = new Set([...flashing, ...ids]);
			setTimeout(() => (flashing = new Set([...flashing].filter((id) => !ids.includes(id)))), 1200);
			events = [...events, { ts: Date.now(), name: 'Bingo', pokemonName: m.label, matched: true }];
			showToast('match', [[{ t: m.label, b: true }]]);
			if (m.type === 'full') {
				// The server ends the game with the prize by itself; it shows once the confetti has had a moment.
				playSound('caughtpkmn.ogg');
				fullAt = Date.now();
			} else {
				playSound('lvlup.ogg');
			}
		}
	}

	/** @param {any} msg */
	function onMessage(msg) {
		switch (msg.type) {
			case 'lobbyPrize': {
				const shown = prizeSummary(msg.prize, msg.eligibleCount || 0);
				setTimeout(() => {
					locked = true;
					prize = shown;
				}, Math.max(0, fullAt + 1500 - Date.now()));
				return;
			}
			case 'linePrize':
				showToast('match', [
					[{ t: msg.lines.join(' og ') + ' full!', b: true }],
					[{ t: msg.eligibleCount ? `+${nok(msg.amount)} mynter til ${msg.eligibleCount} ${msg.eligibleCount === 1 ? 'elev' : 'elever'}` : 'Ingen har fanget noe ennå' }]
				]);
				return;
			case 'bingoStarted':
				phase = 'play';
				return;
			case 'lobbyCreated':
				status('Lobby opprettet: ' + msg.code);
				celebrated.clear();
				loadLobby(msg);
				return;
			case 'lobbyState':
				status((msg.restored ? 'Lobby gjenopprettet fra database: ' : 'Lobby gjenopprettet: ') + msg.code);
				loadLobby(msg);
				if (Array.isArray(msg.events)) events = [...msg.events];
				if (msg.restored) banner = { message: [{ t: 'Lobbyen ble gjenopprettet etter serverrestart. Elever må koble til på nytt.' }] };
				return;
			case 'playersUpdate':
				playersUpdate(msg.players || []);
				return;
			case 'boardUpdate': {
				setBoard(msg.board);
				if (msg.totalCatches != null) setTotal(msg.totalCatches);
				if (msg.lastEvent) {
					const ev = msg.lastEvent;
					const key = `${ev.uuid || ''}|${ev.pokemonCode || ''}|${ev.ts || ev.timestamp || ev.time || ''}`;
					const extra = eventExtra.get(key);
					events = [...events, extra ? { ...ev, ...extra } : ev];
				}
				const milestones = checkNewMilestones(cells, celebrated);
				if (milestones.length) celebrate(milestones);
				return;
			}
			case 'toastCatch': {
				if (msg.totalCatches != null) setTotal(msg.totalCatches);
				const name = msg.name || 'Ash';
				const pokeName = msg.pokemonName || msg.pokemonCode || 'Pokémon';
				const id = msg.pokedexId ? ` (#${msg.pokedexId})` : '';
				if (msg.belowLevel) {
					// Below the minimum level: logged, but no effect on the board.
					const { uuid, pokedexId, pokemonName, pokemonCode, types, flags, difficulty: stage } = msg;
					events = [...events, { ts: Date.now(), uuid, name: msg.name, pokedexId, pokemonName, pokemonCode, types, flags, difficulty: stage, matched: false, belowLevel: true }];
					showToast('low', [[{ t: name, b: true }, { t: ' fanget ' }, { t: pokeName, b: true }, { t: id + ' ' }, { t: '(nivå for lavt)', dim: true }]]);
					return;
				}
				// The legacy page keys this without a time, so it only matches a lastEvent that has none.
				eventExtra.set(`${msg.uuid || ''}|${msg.pokemonCode || ''}|`, {
					uuid: msg.uuid,
					pokedexId: msg.pokedexId,
					pokemonName: msg.pokemonName,
					types: msg.types,
					flags: msg.flags,
					difficulty: msg.difficulty,
					matchedCells: msg.matchedCells,
					matchedCell: msg.matchedCell
				});
				/** @type {Seg[][]} */
				const lines = [[{ t: name, b: true }, { t: ` fanget en ${catchPrefix(msg.flags)}` }, { t: pokeName, b: true }, { t: '!' + id }]];
				if (Array.isArray(msg.types) && msg.types.length) lines.push([{ t: 'Type: ' }, { t: msg.types.join(', '), b: true }]);
				const matches = Array.isArray(msg.matchedCells) && msg.matchedCells.length ? msg.matchedCells.join(', ') : msg.matchedCell;
				if (matches) lines.push([{ t: 'Match: ' }, { t: matches, b: true }]);
				showToast(msg.matched ? 'match' : 'info', lines);
				return;
			}
			case 'adminPopup':
				adminPopup = { message: msg.message, position: msg.position || 'top-center' };
				setTimeout(() => (adminPopup = null), (msg.duration || 5) * 1000);
				return;
			case 'adminSound':
				playSound(msg.file);
				return;
			case 'lobbyNotFound':
				// The game has ended or timed out: back to the setup.
				status('Lobby ikke funnet.');
				localStorage.removeItem('teacherBingoCode');
				currentCode = '';
				ready = true;
				return;
			case 'error':
				status('SERVER ERROR: ' + (msg.message || 'Feil'));
				banner = { message: [{ t: msg.message || 'Serverfeil' }] };
				return;
		}
	}

	/** Waits before reconnecting: longer after each failed try, back to the start once connected. */
	let retryDelay = 1500;

	/**
	 * Log in through Access, then connect. The board stays on the projector for the whole lesson,
	 * so a dropped connection comes back by itself and picks the running game up again.
	 * @param {() => boolean} gone true once the page has closed
	 * @param {boolean} [reconnect] coming back after a dropped connection
	 */
	async function start(gone, reconnect = false) {
		// A reconnect keeps the login it has: checking it again offline would leave the page.
		if (!reconnect) {
			if (!(await ensureTeacher())) {
				if (!gone()) goto('/lærer/index.html');
				return;
			}
			if (gone()) return;
			teacherSession = getTeacherSession();
			try {
				// The running game's settings, for its free space and "Nytt brett".
				settings = JSON.parse(localStorage.getItem('teacherBingoSettings') || sessionStorage.getItem('bingoSettings') || '{}');
			} catch {
				settings = {};
			}
			muted = localStorage.getItem('bingoMuted') === '1';
		}

		ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`);
		ws.addEventListener('open', () => {
			retryDelay = 1500;
			const stored = (localStorage.getItem('teacherBingoCode') || '').toUpperCase().trim();
			if (reconnect) {
				// Back after a dropped connection: the same game, never a new one.
				if (stored.length === 6) send({ type: 'hostJoinLobby', code: stored });
				status('Koblet til igjen.');
				return;
			}
			if (stored.length === 6) {
				status('Gjenoppretter lobby ' + stored + ' …');
				send({ type: 'hostJoinLobby', code: stored });
			} else {
				ready = true;
			}
		});
		ws.addEventListener('error', (e) => {
			status('WebSocket ERROR – se Console.');
			console.error(e);
		});
		ws.addEventListener('close', () => {
			if (gone()) return;
			status('Mistet forbindelsen. Kobler til igjen …');
			setTimeout(() => !gone() && start(gone, true), retryDelay);
			retryDelay = Math.min(retryDelay * 2, 15000);
		});
		ws.addEventListener('message', (e) => {
			let msg;
			try {
				msg = JSON.parse(e.data);
			} catch {
				return; // Not JSON; ignored, as before.
			}
			onMessage(msg);
		});
	}

	onMount(() => {
		let gone = false;
		start(() => gone);
		const cycler = setInterval(() => tick++, 1500);
		addEventListener('resize', fitBoard);
		return () => {
			removeEventListener('resize', fitBoard);
			clearTimeout(pressTimer);
			clearInterval(cycler);
			clearTimeout(toastTimer);
			gone = true;
			ws?.close();
		};
	});

	function toggleMute() {
		muted = !muted;
		localStorage.setItem('bingoMuted', muted ? '1' : '0');
	}

	/** The Pokémon a range cell shows now: it steps through up to 60 of the range. @param {Cell} cell */
	function rangeSprite(cell) {
		const start = Number(cell.task?.rule?.start);
		const end = Number(cell.task?.rule?.end);
		if (isNaN(start) || isNaN(end) || end < start) return localSprite(start);
		return localSprite(start + (tick % Math.min(end - start + 1, 60)));
	}
</script>

<svelte:head>
	<title>Pokémath – Bingo</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#snippet segs(/** @type {Seg[]} */ line)}
	{#each line as s, i (i)}{#if s.b}<b>{s.t}</b>{:else if s.dim}<span class="dim">{s.t}</span>{:else}{s.t}{/if}{/each}
{/snippet}

<TeacherPage subtitle="PokéBingo" wide back={{ href: '/lærer/index.html', label: 'Lærersiden' }}>
	{#if !ready}
		<p class="muted">Kobler til…</p>
	{:else if !currentCode}
		<BingoSetup onCreate={createLobby} />
	{:else if phase === 'lobby'}
		<Lobby code={currentCode} {players} startLabel="Start bingoen" onStart={startBingo} onCancel={backToSettings} onPlayer={openPlayerMenu}>
			{#snippet stage()}
				<div class="lobby-stage">
					<h1>PokéBingo</h1>
					<dl>
						<dt>Brett</dt>
						<dd>{boardN}×{boardN} · {DIFF_NO[difficulty] || difficulty}</dd>
						<dt>Premie</dt>
						<dd>{freePrize.text}</dd>
						{#if className}<dt>Klasse</dt><dd>{className}</dd>{/if}
					</dl>
					<p class="muted">Fangster teller fra du trykker Start. Hver hele rad eller kolonne gir 500 mynter.</p>
				</div>
			{/snippet}
		</Lobby>
	{:else}
	<header class="host-top">
		<div class="title-block">
			<h1>PokéBingo</h1>
			<p class="labels">
				<span id="difficultyLabel">{DIFF_NO[difficulty] || difficulty}</span>
				{#if className}· <span id="classNameLabel">Klasse: {className}</span>{/if}
			</p>
		</div>
		<CodeChip code={currentCode} />
	</header>

	<div class="controls">
		<GameControls
			primary={{ id: 'giveNowBtn', label: locked ? 'Premien er delt ut' : 'Del ut premien nå', onclick: giveNow, disabled: locked }}
			newLabel="Nytt brett"
			endLabel="Avslutt bingo"
			onNew={newGame}
			onSettings={backToSettings}
			onEnd={endGame}
		/>
		<div class="group" role="group" aria-label="Visning">
			<button id="toggleLog" class="pm-button small secondary" onclick={() => (logVisible = !logVisible)}>{logVisible ? 'Skjul logg' : 'Vis logg'}</button>
			<button id="muteBtn" class="pm-button small secondary" aria-pressed={muted} onclick={toggleMute}><Icon name={muted ? 'speakerSlash' : 'speakerHigh'} />{muted ? 'Lyd av' : 'Lyd på'}</button>
			<span class="size-control">
				<label for="cellSizeSlider">Størrelse</label>
				<input
					type="range"
					id="cellSizeSlider"
					min="24"
					max="150"
					value={cellSize ?? 118}
					oninput={(e) => (manualSize = Number(e.currentTarget.value))}
					ondblclick={() => (manualSize = null)}
				/>
				{#if manualSize !== null}
					<button id="cellSizeAuto" class="pm-button small secondary" onclick={() => (manualSize = null)}>Auto</button>
				{/if}
			</span>
		</div>
		<span id="totalCatches" class="total">Totalt fanget: {totalCatches}</span>
	</div>

	<div class="grid">
		<section class="side-panel players-panel" aria-label="Tilkoblede elever">
			<div class="panel-header">
				<span>Elever</span>
				<span id="playerCount" class="badge">{connectedCount}/{players.length}</span>
			</div>
			<div class="sort" role="group" aria-label="Sorter elever">
				<button id="sortJoinBtn" aria-pressed={sortMode === 'joined'} onclick={() => (sortMode = 'joined')} title="Etter tilkobling"><Icon name="clock" label="Etter tilkobling" /></button>
				<button id="sortAlphaBtn" aria-pressed={sortMode === 'alpha'} onclick={() => (sortMode = 'alpha')}>A–Å</button>
				<button id="sortCatchBtn" aria-pressed={sortMode === 'catches'} onclick={() => (sortMode = 'catches')} title="Flest fangster"><Icon name="ranking" label="Flest fangster" /></button>
				<button id="toggleCatchesBtn" class="eye" onclick={() => (showCatches = !showCatches)}><Icon name={showCatches ? 'eyeSlash' : 'eye'} /> {showCatches ? 'Skjul' : 'Vis'}</button>
			</div>
			<div id="players">
				{#each sortedPlayers as p, i (p.uuid ?? i)}
					<div class="player-row">
						{#if p.icon}
							{@const icon = p.icon}
							<img class="player-icon" src={iconSrc(icon)} alt="" onerror={(e) => pngFallback(e, icon)} />
						{:else}
							<span class="player-dot" class:connected={p.connected}></span>
						{/if}
						<button class="player-name" title="Trykk for alternativer" onclick={(e) => openPlayerMenu(p, e)}>{p.name || 'Ash'}</button>
						{#if showCatches}
							<span class="player-catches">
								{p.catchCount ?? 0}<small>({totalCatches > 0 ? Math.round(((p.catchCount || 0) / totalCatches) * 100) : 0}%)</small>
							</span>
						{/if}
					</div>
				{:else}
					<p class="empty">Ingen elever ennå. Del koden over.</p>
				{/each}
			</div>
		</section>

		<table
			id="bingoCard"
			bind:this={boardEl}
			class:board-tiny={boardN >= 13}
			class:board-big={boardN >= 9}
			class:board-compact={compact && boardN >= 9}
			style:--cell-size={cellSize ? `${cellSize}px` : null}
			onmouseleave={() => (tooltipCell = null)}
		>
			<tbody>
				{#each rows as row, r (r)}
					<tr>
						{#each row as cell (cell.cellId)}
							{@const rule = cell.task?.rule}
							<td
								data-cell-id={cell.cellId}
								class:free-space={cell.free}
								class:toggled={cell.marked && !cell.free}
								class:host-cell={!cell.free}
								class:bingo-flash={flashing.has(cell.cellId)}
								class:no-pic={!cell.free && !rule?.kind?.startsWith('pokedex') && !cell.task?.image && cell.task?.textClass !== 'letter-task'}
								title={cell.free || boardN >= 9 ? null : 'Trykk for å godkjenne / fjerne godkjenning'}
								onclick={() => toggleCell(cell)}
								onpointerdown={(e) => cellPointerDown(e, cell)}
								onpointerup={cellPointerUp}
								onpointercancel={cellPointerUp}
								onpointerover={(e) => e.pointerType === 'mouse' && (tooltipCell = boardN >= 9 && !cell.free ? cell : null)}
							>
								{#if !cell.free}<span class="hit-badge">{cell.hits || 0}</span>{/if}
								{#if cell.free}
									<img src="/images/compass.png" alt="" />
									<span class="cell-name">FREE SPACE</span>
									<span class="free-prize" class:strong={freePrize.strong}>
										{#if freePrize.pot}<span id="participationPot" class="pot" class:pop={potPop}>{freePrize.text}</span>{:else}{freePrize.text}{/if}
									</span>
									{#if freePrize.note}<span class="free-note">{freePrize.note}</span>{/if}
								{:else}
									{#if rule?.kind === 'pokedexExact'}
										<img class:silhouette={!cell.marked} src={cell.task?.image ? `/${String(cell.task.image).replace(/^\//, '')}` : localSprite(rule.id ?? 0)} alt={cell.task?.name || ''} />
									{:else if rule?.kind === 'pokedexRange'}
										{#if cell.marked}
											<span class="cell-range-solved">✓</span>
										{:else}
											<img class="silhouette range-sprite" src={rangeSprite(cell)} alt={cell.task?.name || ''} />
										{/if}
									{:else if cell.task?.image}
										<img src="/{String(cell.task.image).replace(/^\//, '')}" alt={cell.task?.name || ''} />
									{:else if cell.task?.textClass === 'letter-task'}
										<span class="cell-letter">{cell.task.text || ''}</span>
									{/if}
									<span class="cell-name">{cell.task?.name || ''}</span>
									<span class="task-description">{cell.task?.description || ''}</span>
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>

		<section class="side-panel log-panel" aria-label="Logg">
			<div class="panel-header">
				<span>Logg</span>
				<span id="logCount" class="badge">{events.length}</span>
			</div>
			{#if logVisible}
				<div id="events">
					{#each shownEvents as ev, i (i)}
						<div class="log-entry" class:log-match={ev.matched} class:below={ev.belowLevel} title={logHover(ev)}>
							<span class="log-time">{fmtTime(ev.ts)}</span>
							<b>{ev.name || 'Ash'}</b> – {ev.pokedexId ? `#${ev.pokedexId} ` : ''}<b>{ev.pokemonName || ev.pokemonCode || 'Pokémon'}</b>
							{#if ev.difficulty}<span class="dim">({ev.difficulty})</span>{/if}
							{#if ev.matched}<span class="pill match">MATCH</span>{/if}
							{#if ev.belowLevel}<span class="pill low">nivå for lavt</span>{/if}
						</div>
					{/each}
				</div>
			{/if}
		</section>
	</div>
	{/if}
</TeacherPage>

{#if toast}
	<div id="toast" class="bingo-toast {toast.kind}" role="status">
		{#each toast.lines as line, i (i)}<div>{@render segs(line)}</div>{/each}
	</div>
{/if}

{#if tooltipCell}
	{@const tip = tooltipFor(tooltipCell)}
	<div id="cell-tooltip" role="status">
		{#if tip.img}<img src={tip.img} alt="" class="tooltip-img" class:silhouette={tip.silhouette} />{/if}
		{#if tip.name}<div class="tooltip-name">{tip.name}</div>{/if}
		{#if tip.desc}<div class="tooltip-desc">{tip.desc}</div>{/if}
		{#if compact}<div class="tooltip-desc">Treff: {tip.hits}</div>{/if}
	</div>
{/if}

{#if playerMenu}
	<PlayerMenu menu={playerMenu} code={currentCode} {send} onClose={() => (playerMenu = null)} />
{/if}

{#if banner}
	<div id="host-banner" role="alert">
		<span class="banner-text">{@render segs(banner.message)}</span>
		{#if banner.button}
			<button
				id="host-banner-btn"
				class="pm-button small"
				onclick={() => {
					const action = banner?.action;
					banner = null;
					action?.();
				}}>{banner.button}</button
			>
		{/if}
		<button id="host-banner-close" class="close" aria-label="Lukk" onclick={() => (banner = null)}>×</button>
	</div>
{/if}

{#if prize}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div id="prizeModal" class="overlay dark" onclick={(e) => e.target === e.currentTarget && (prize = null)}>
		<div class="prize-box" role="dialog" aria-modal="true" aria-labelledby="prize-title">
			{#if prize.image}
				<img class="prize-image" src={prize.image} alt="" width="96" height="96" />
			{:else if prize.sprites}
				<div class="prize-sprites">{#each prize.sprites as src, i (i)}<img {src} alt="" width="80" height="80" />{/each}</div>
			{/if}
			<h2 id="prize-title">Bingo fullført!</h2>
			<h3>{prize.title}</h3>
			<p>{prize.sub}</p>
			<button class="pm-button" onclick={() => (prize = null)}>OK</button>
		</div>
	</div>
{/if}

{#if adminPopup}
	<div id="admin-popup" class="admin-popup pos-{adminPopup.position}">{adminPopup.message}</div>
{/if}

<canvas id="confetti-canvas" bind:this={confettiCanvas}></canvas>

<style>
	.lobby-stage {
		padding: 24px;
		border-radius: var(--pm-radius);
		background: var(--pm-paper);
		box-shadow: var(--pm-shadow), 0 0 0 1px var(--pm-line);
	}
	.lobby-stage dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 6px 16px;
		margin: 12px 0 16px;
		font-size: 20px;
	}
	.lobby-stage dt {
		color: var(--pm-ink-soft);
		font-weight: 700;
	}
	.lobby-stage dd {
		margin: 0;
	}
	.host-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}
	.title-block h1,
	.lobby-stage h1 {
		margin: 0;
		font-family: var(--pm-display);
		font-weight: 400;
		font-size: clamp(32px, 4vw, 48px);
		color: var(--pm-red);
	}
	.labels {
		margin: 0;
		color: var(--pm-ink-soft);
		font-weight: 700;
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin: 14px 0;
	}
	.group {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.total {
		margin-left: auto;
		font-family: var(--pm-display);
		font-size: 20px;
	}
	.grid {
		display: grid;
		grid-template-columns: 220px minmax(0, 1fr) 280px;
		gap: 14px;
		align-items: start;
	}
	.side-panel {
		overflow: hidden;
		border-radius: var(--pm-radius);
		background: var(--pm-paper);
		box-shadow: var(--pm-shadow), 0 0 0 1px var(--pm-line);
	}
	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 12px;
		border-bottom: 1px solid var(--pm-line);
		font-family: var(--pm-display);
		font-size: 18px;
	}
	.badge {
		padding: 1px 9px;
		border-radius: 999px;
		background: var(--pm-cream);
		font-family: var(--pm-body);
		font-size: 14px;
		font-weight: 700;
	}
	.sort {
		display: flex;
		gap: 4px;
		padding: 6px 8px;
		border-bottom: 1px solid var(--pm-line);
	}
	.sort button {
		min-width: 36px;
		min-height: 32px;
		padding: 0 8px;
		border: none;
		border-radius: 8px;
		background: var(--pm-cream);
		color: var(--pm-ink);
		font: inherit;
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
	}
	.sort button[aria-pressed='true'] {
		background: var(--pm-ink);
		color: var(--pm-paper);
	}
	.sort .eye {
		margin-left: auto;
	}
	#players,
	#events {
		max-height: 70vh;
		overflow-y: auto;
	}
	.player-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 7px 12px;
		border-bottom: 1px solid var(--pm-cream);
	}
	.player-icon {
		width: 28px;
		height: 28px;
		object-fit: contain;
	}
	.player-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--pm-line);
	}
	.player-dot.connected {
		background: var(--pm-green);
	}
	.player-name {
		flex: 1;
		min-width: 0;
		min-height: 32px;
		overflow: hidden;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		font-weight: 700;
		text-align: left;
		text-overflow: ellipsis;
		white-space: nowrap;
		cursor: pointer;
	}
	@media (hover: hover) {
		.player-name:hover {
			color: var(--pm-red-deep);
			text-decoration: underline;
		}
	}
	.size-control {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--pm-ink-soft);
		font-size: 14px;
		font-weight: 700;
	}
	#cellSizeSlider {
		width: 120px;
		accent-color: var(--pm-red);
	}
	#cell-tooltip {
		position: fixed;
		bottom: 18px;
		left: 18px;
		z-index: 2300;
		max-width: 220px;
		padding: 12px 14px;
		border-radius: 14px;
		background: var(--pm-paper);
		box-shadow: var(--pm-shadow), 0 0 0 1px var(--pm-line);
		text-align: center;
		pointer-events: none;
		animation: tooltip-in 0.12s ease-out;
	}
	@keyframes tooltip-in {
		from { opacity: 0; transform: translateY(6px); }
	}
	.tooltip-img {
		display: block;
		width: 80px;
		height: 80px;
		margin: 0 auto 8px;
		object-fit: contain;
	}
	.tooltip-img.silhouette {
		filter: brightness(0);
	}
	.tooltip-name {
		margin-bottom: 4px;
		font-weight: 700;
	}
	.tooltip-desc {
		color: var(--pm-ink-soft);
		font-size: 13px;
		line-height: 1.4;
	}
	.player-catches {
		font-family: var(--pm-display);
	}
	.player-catches small {
		margin-left: 2px;
		font-family: var(--pm-body);
		font-size: 12px;
		opacity: 0.6;
	}
	.empty {
		margin: 0;
		padding: 12px;
		color: var(--pm-ink-soft);
		font-size: 14px;
	}

	#bingoCard {
		width: 100%;
		table-layout: fixed;
		border-collapse: separate;
		border-spacing: 6px;
		padding: 6px;
		border-radius: var(--pm-radius);
		background: var(--pm-paper);
		box-shadow: var(--pm-shadow), 0 0 0 1px var(--pm-line);
	}
	/* --cell-size is set for boards bigger than 5×5 and by the size slider; the rest scales with it. */
	#bingoCard td {
		position: relative;
		height: var(--cell-size, 118px);
		overflow: hidden;
		padding: min(22px, calc(var(--cell-size, 118px) * 0.19)) min(6px, calc(var(--cell-size, 118px) * 0.05)) min(8px, calc(var(--cell-size, 118px) * 0.05));
		border-radius: min(12px, calc(var(--cell-size, 118px) * 0.12));
		background: var(--pm-cream);
		box-shadow: inset 0 0 0 1px var(--pm-line);
		font-size: clamp(9px, calc(var(--cell-size, 118px) * 0.11), 13px);
		-webkit-touch-callout: none;
		user-select: none;
		line-height: 1.2;
		text-align: center;
		vertical-align: top;
		cursor: pointer;
		transition: background 0.2s;
	}
	#bingoCard td.toggled {
		background: var(--pm-green-deep);
		color: var(--pm-paper);
		box-shadow: none;
	}
	#bingoCard td.free-space {
		background: var(--pm-red);
		color: var(--pm-paper);
		box-shadow: none;
		cursor: default;
	}
	@media (hover: hover) {
		#bingoCard td.host-cell:not(.toggled):hover {
			box-shadow: inset 0 0 0 2px var(--pm-red);
		}
	}
	#bingoCard td img {
		display: block;
		width: min(48px, calc(var(--cell-size, 118px) * 0.4));
		height: min(48px, calc(var(--cell-size, 118px) * 0.4));
		margin: 0 auto 4px;
		object-fit: contain;
	}
	#bingoCard td img.silhouette {
		filter: brightness(0);
	}
	.cell-name {
		display: block;
		font-weight: 700;
	}
	/* A name with no picture above it sits in the middle, clear of the hit count in the corner. */
	#bingoCard td.no-pic {
		vertical-align: middle;
	}
	.task-description {
		display: block;
		margin-top: 2px;
		font-size: clamp(8px, calc(var(--cell-size, 118px) * 0.1), 12px);
		opacity: 0.75;
	}
	#bingoCard.board-tiny .task-description,
	#bingoCard.board-compact .cell-name,
	#bingoCard.board-compact .task-description,
	#bingoCard.board-compact .free-prize,
	#bingoCard.board-compact .free-note {
		display: none;
	}
	#bingoCard.board-compact td {
		padding: 2px;
		vertical-align: middle;
	}
	#bingoCard.board-compact td img {
		width: min(40px, calc(var(--cell-size, 118px) * 0.7));
		height: min(40px, calc(var(--cell-size, 118px) * 0.7));
		margin: 0 auto;
	}
	/* A task with no picture keeps its name, cut to fit. */
	#bingoCard.board-compact td.no-pic .cell-name {
		display: block;
		overflow: hidden;
		font-size: 8px;
		line-height: 1.1;
		max-height: 2.2em;
		overflow-wrap: anywhere;
	}
	#bingoCard.board-compact .hit-badge {
		display: none;
	}
	/* Big boards: the hit count would cover the picture, so it shrinks with the cell. */
	#bingoCard.board-big .hit-badge {
		top: 2px;
		left: 2px;
		min-width: 14px;
		height: 14px;
		padding: 0 3px;
		font-size: 9px;
		line-height: 14px;
	}
	.cell-letter {
		display: block;
		color: var(--pm-red);
		font-family: var(--pm-display);
		font-size: min(40px, calc(var(--cell-size, 118px) * 0.36));
		line-height: 1;
	}
	.toggled .cell-letter {
		color: var(--pm-paper);
	}
	.hit-badge {
		position: absolute;
		top: 5px;
		left: 5px;
		min-width: 20px;
		height: 20px;
		padding: 0 5px;
		border-radius: 999px;
		background: oklch(0.3 0.03 265 / 0.12);
		font-size: 11px;
		font-weight: 800;
		line-height: 20px;
	}
	.toggled .hit-badge {
		background: oklch(1 0 0 / 0.3);
	}
	.cell-range-solved {
		display: block;
		margin: 4px 0;
		font-size: min(34px, calc(var(--cell-size, 118px) * 0.4));
		font-weight: 900;
		line-height: 1;
	}
	.free-prize {
		display: block;
		margin-top: 4px;
		font-size: 12px;
		opacity: 0.85;
	}
	.free-prize.strong {
		font-weight: 700;
		opacity: 1;
	}
	.pot {
		display: inline-block;
		color: oklch(0.92 0.13 95);
		transition: transform 0.25s, color 0.25s;
	}
	.pot.pop {
		transform: scale(1.35);
		color: var(--pm-paper);
	}
	.free-note {
		display: block;
		font-size: 11px;
		opacity: 0.65;
	}
	#bingoCard td.bingo-flash {
		z-index: 3;
		animation: bingo-flash 1.2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
	}
	@keyframes bingo-flash {
		0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 215, 0, 0); }
		30% { transform: scale(1.16); box-shadow: 0 0 28px 10px rgba(255, 215, 0, 0.95); }
		65% { transform: scale(1.08); box-shadow: 0 0 16px 5px rgba(255, 215, 0, 0.55); }
		100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 215, 0, 0); }
	}

	.log-entry {
		padding: 7px 12px;
		border-bottom: 1px solid var(--pm-cream);
		font-size: 13px;
	}
	.log-entry.log-match {
		background: oklch(0.95 0.06 145);
	}
	.log-entry.below {
		background: oklch(0.97 0.05 90);
	}
	.log-time {
		color: var(--pm-ink-soft);
		font-size: 12px;
	}
	.dim {
		opacity: 0.6;
	}
	.pill {
		display: inline-block;
		margin-left: 4px;
		padding: 1px 7px;
		border-radius: 999px;
		font-size: 11px;
		font-weight: 800;
	}
	.pill.match {
		background: var(--pm-green-deep);
		color: var(--pm-paper);
	}
	.pill.low {
		background: oklch(0.85 0.13 90);
		color: oklch(0.4 0.08 80);
	}

	.bingo-toast {
		position: fixed;
		left: 50%;
		bottom: 24px;
		z-index: 2000;
		max-width: min(520px, calc(100vw - 32px));
		padding: 14px 20px;
		border-radius: 16px;
		background: var(--pm-paper);
		box-shadow: 0 16px 40px -16px oklch(0.25 0.04 265 / 0.6), 0 0 0 2px oklch(0.65 0.12 245);
		font-size: 18px;
		transform: translateX(-50%);
	}
	.bingo-toast.match {
		background: var(--pm-green-deep);
		color: var(--pm-paper);
		box-shadow: 0 16px 40px -16px oklch(0.25 0.04 265 / 0.6);
	}
	.bingo-toast.low {
		background: oklch(0.97 0.05 90);
		color: oklch(0.4 0.08 80);
		box-shadow: 0 16px 40px -16px oklch(0.25 0.04 265 / 0.6), 0 0 0 2px oklch(0.82 0.13 90);
	}
	.bingo-toast div + div {
		margin-top: 6px;
	}

	#host-banner {
		position: fixed;
		top: 16px;
		left: 50%;
		z-index: 2100;
		display: flex;
		align-items: center;
		gap: 12px;
		width: min(560px, calc(100vw - 32px));
		padding: 12px 16px;
		border-radius: 14px;
		background: var(--pm-paper);
		box-shadow: 0 16px 40px -16px oklch(0.25 0.04 265 / 0.6), 0 0 0 2px var(--pm-red);
		transform: translateX(-50%);
	}
	.banner-text {
		flex: 1;
	}
	.close {
		width: 36px;
		height: 36px;
		border: none;
		border-radius: 50%;
		background: none;
		color: var(--pm-ink-soft);
		font-size: 24px;
		cursor: pointer;
	}

	.overlay {
		position: fixed;
		inset: 0;
		z-index: 2200;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
		background: oklch(0.2 0.03 265 / 0.5);
	}
	.overlay.dark {
		background: oklch(0.15 0.03 265 / 0.8);
	}
	.prize-box {
		position: relative;
		padding: 28px 32px;
		border-radius: 20px;
		background: var(--pm-paper);
		text-align: center;
	}
	.prize-box {
		width: min(520px, 100%);
	}
	.prize-image {
		width: 96px;
		height: 96px;
		object-fit: contain;
	}
	.prize-sprites img {
		margin: 4px;
		image-rendering: pixelated;
	}
	.prize-box h2 {
		margin: 8px 0;
		font-family: var(--pm-display);
		font-weight: 400;
		font-size: 30px;
	}
	.prize-box h3 {
		margin: 0 0 12px;
		color: oklch(0.55 0.15 255);
		font-size: 20px;
	}
	.prize-box p {
		margin: 0 0 22px;
		color: var(--pm-ink-soft);
	}

	.admin-popup {
		position: fixed;
		z-index: 2300;
		max-width: 500px;
		padding: 16px 28px;
		border-radius: 16px;
		background: var(--pm-ink);
		color: var(--pm-paper);
		font-size: 19px;
		font-weight: 700;
		text-align: center;
		box-shadow: 0 8px 32px oklch(0.15 0.03 265 / 0.5);
		animation: admin-pop 0.25s ease;
	}
	.pos-top-left { top: 16px; left: 16px; }
	.pos-top-center { top: 16px; left: 50%; translate: -50% 0; }
	.pos-top-right { top: 16px; right: 16px; }
	.pos-center { top: 50%; left: 50%; translate: -50% -50%; }
	.pos-bottom-left { bottom: 16px; left: 16px; }
	.pos-bottom-center { bottom: 16px; left: 50%; translate: -50% 0; }
	.pos-bottom-right { bottom: 16px; right: 16px; }
	@keyframes admin-pop {
		from { opacity: 0; transform: scale(0.88); }
		to { opacity: 1; transform: scale(1); }
	}

	#confetti-canvas {
		position: fixed;
		inset: 0;
		z-index: 2400;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	/* Smaller screens: the board on top, players and log side by side under it. */
	@media (max-width: 1100px) {
		.grid {
			grid-template-columns: 1fr 1fr;
			grid-template-areas: 'board board' 'players log';
		}
		#bingoCard { grid-area: board; }
		.players-panel { grid-area: players; }
		.log-panel { grid-area: log; }
	}
	@media (max-width: 640px) {
		.grid {
			grid-template-columns: 1fr;
			grid-template-areas: 'board' 'players' 'log';
		}
		#bingoCard {
			border-spacing: 3px;
			padding: 3px;
		}
		#bingoCard td {
			height: var(--cell-size, 92px);
			padding: min(20px, calc(var(--cell-size, 92px) * 0.19)) 2px 4px;
			font-size: clamp(9px, calc(var(--cell-size, 92px) * 0.11), 11px);
		}
		#bingoCard td img {
			width: min(34px, calc(var(--cell-size, 92px) * 0.4));
			height: min(34px, calc(var(--cell-size, 92px) * 0.4));
		}
		.task-description {
			display: none;
		}
		.bingo-toast {
			padding: 10px 14px;
			font-size: 15px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		#bingoCard td.bingo-flash {
			animation: none;
		}
	}
</style>
