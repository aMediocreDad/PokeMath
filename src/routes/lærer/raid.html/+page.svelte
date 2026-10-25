<script>
	// The teacher's raid screen, made for the projector (worker/raid.js). Pick a boss and a length,
	// let the class join with the code, start, and watch every correct answer hit the boss for the
	// answer itself. A reload rejoins the same raid (teacherRaidCode).
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
	import { BOSS_HP, LENGTHS, RAID_BOSSES, raidMinutes } from '#lib/raidConfig.js';

	/** @typedef {{ uuid: string, name: string, icon: string, catchCount: number, damage?: number, connected: boolean }} Player */
	/** @typedef {import('#lib/bingo.js').RaidState} RaidState */

	const CODE_KEY = 'teacherRaidCode';
	/** The last setup, so "Nytt raid" can repeat it after a reload too. */
	const CHOICE_KEY = 'teacherRaidChoice';

	/** @type {WebSocket | undefined} */
	let ws;
	let teacherSession = '';
	/** False until the stored raid has been asked for, so the setup does not flash first. */
	let ready = $state(false);

	let code = $state('');
	/** @type {RaidState | null} */
	let raid = $state(null);
	/** @type {Player[]} */
	let players = $state([]);
	/** @type {{ name: string, damage?: number, id: number }[]} newest first */
	let hits = $state([]);
	/** @type {string[]} */
	let winners = $state([]);
	let shake = $state(false);
	/** The child whose menu is open (kick, rename), and where. */
	let playerMenu = $state(/** @type {{ player: { uuid?: string, name?: string }, x: number, y: number } | null} */ (null));
	/** @param {{ uuid?: string, name?: string }} player @param {MouseEvent} e */
	function openPlayerMenu(player, e) {
		e.stopPropagation();
		playerMenu = { player, x: e.clientX, y: e.clientY };
	}

	/** @type {Record<string, any>} pokemon_info.json, for the bosses' names */
	let info = $state({});
	/** @param {number} id */
	const bossName = (id) => info[String(id)]?.['0']?.name || `#${id}`;

	let choice = $state({ boss: /** @type {number | 'random'} */ ('random'), length: 'medium', className: '' });
	/** Set by "Nytt raid": once the old raid has ended, make a new one with the same setup. */
	let restart = false;

	const ranked = $derived([...players].sort((a, b) => (b.damage ?? 0) - (a.damage ?? 0) || b.catchCount - a.catchCount));
	/** The lengths, with how long each takes against the boss picked: more HP takes longer. */
	const lengths = $derived(LENGTHS.map(([value, title, minutes]) => ({ value, title, sub: `ca. ${raidMinutes(choice.boss, minutes)} min` })));
	const percent = $derived.by(() => (raid && raid.maxHp ? (100 * raid.hp) / raid.maxHp : 100));

	/** @param {any} message */
	function send(message) {
		ws?.send(JSON.stringify({ teacherSession, ...message }));
	}

	let hitId = 0;
	/** @param {any} msg */
	function onMessage(msg) {
		if (msg.type === 'raidState') {
			code = msg.code;
			localStorage.setItem(CODE_KEY, msg.code);
			raid = msg.raid;
			players = msg.players || [];
			choice.className = msg.className || choice.className;
			hits = (msg.recent || []).map((/** @type {{ name: string, damage?: number }} */ h) => ({ name: h.name, damage: h.damage, id: hitId++ })).reverse();
			ready = true;
		} else if (msg.type === 'lobbyEnded' || msg.type === 'lobbyState' || msg.type === 'lobbyNotFound') {
			// A bingo code, or a raid that has gone: start afresh.
			forget();
			if (restart && msg.type === 'lobbyEnded') {
				restart = false;
				ready = false;
				create();
			}
		} else if (msg.type === 'playersUpdate') {
			players = msg.players;
		} else if (msg.type === 'raidHit') {
			raid = msg.raid;
			players = msg.players;
			hits = [{ name: msg.name, damage: msg.damage, id: hitId++ }, ...hits].slice(0, 8);
			shake = false;
			requestAnimationFrame(() => (shake = true));
		} else if (msg.type === 'raidWon') {
			raid = msg.raid;
			winners = msg.winners;
		} else if (msg.type === 'error') {
			toast(msg.message, { bad: true });
		}
	}

	function forget() {
		localStorage.removeItem(CODE_KEY);
		code = '';
		raid = null;
		players = [];
		hits = [];
		winners = [];
		ready = true;
	}

	function create() {
		localStorage.setItem(CHOICE_KEY, JSON.stringify({ boss: choice.boss, length: choice.length }));
		send({ type: 'hostCreateRaid', settings: { boss: choice.boss, length: choice.length, className: choice.className.trim() } });
	}

	function startFight() {
		send({ type: 'hostStartRaid', code });
	}

	/** What ending the raid now means for the children, for the confirm boxes. */
	const endNote = () => (raid?.phase === 'fight' ? ' Barna får mynter for treffene sine, men ikke Pokémonen.' : '');

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
		const question = raid?.phase === 'lobby' ? (players.length ? 'Avbryte raidet? Barna kobles fra.' : '') : `Velge nye innstillinger?\n\nDette raidet avsluttes.${endNote()}`;
		if (question && !(await ask(question))) return;
		sendEnd();
	}

	/** The same boss choice and length again, with a new code (as bingo's "Nytt brett"). */
	async function newRaid() {
		if (!(await ask(`Lage et nytt raid med de samme innstillingene?\n\nDet gamle raidet avsluttes, og elevene må koble til med den nye koden.${endNote()}`, { ok: 'Nytt raid' }))) return;
		restart = sendEnd();
	}

	async function endRaid() {
		if (!(await ask(`Avslutte raidet? Alle elevene kobles fra.${endNote()}`, { ok: 'Avslutt' }))) return;
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
			if (saved && (saved.boss === 'random' || RAID_BOSSES.includes(saved.boss))) choice.boss = saved.boss;
			if (saved && LENGTHS.some(([value]) => value === saved.length)) choice.length = saved.length;
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
			ws?.close();
		};
	});
</script>

<svelte:head>
	<title>PokéMath – Raid</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#snippet bossStage(/** @type {RaidState} */ r)}
	<div class="boss-stage">
		<img class="boss" class:shake src={localSprite(r.bossId)} alt={bossName(r.bossId)} onanimationend={() => (shake = false)} />
		<h2 class="boss-name">{bossName(r.bossId)}</h2>
		{#if r.phase !== 'lobby'}
			<div class="hp" role="meter" aria-label="Liv igjen" aria-valuemin="0" aria-valuemax={r.maxHp} aria-valuenow={r.hp}>
				<span class="hp-fill" class:low={percent < 25} style:width="{percent}%"></span>
			</div>
			<p class="hp-text" id="raidHp">{r.hp} / {r.maxHp} liv</p>
		{/if}
	</div>
{/snippet}

<TeacherPage subtitle="Raid" wide back={{ href: '/lærer/index.html', label: 'Lærersiden' }}>
	{#if !ready}
		<p class="muted">Kobler til…</p>
	{:else if !raid}
		<section class="panel" id="raidSetup">
			<h2>Nytt raid</h2>
			<p class="muted">
				Klassen kjemper sammen mot én stor Pokémon. Hvert riktige svar treffer like hardt som svaret: 42 gir 42 i skade. På
				nivå 1 teller svaret 1,5 ganger, på nivå 2 0,6 ganger, på nivå 4 deles det på 10, og på nivå 5 på 1000. Når livet er borte, fanger alle som var med Pokémonen.
			</p>

			<h3>Velg boss</h3>
			<div class="bosses" role="radiogroup" aria-label="Boss">
				<button class="boss-pick" class:picked={choice.boss === 'random'} role="radio" aria-checked={choice.boss === 'random'} onclick={() => (choice.boss = 'random')}>
					<span class="random" aria-hidden="true">?</span>
					<span>Tilfeldig</span>
				</button>
				{#each RAID_BOSSES as id (id)}
					<button class="boss-pick" class:picked={choice.boss === id} role="radio" aria-checked={choice.boss === id} onclick={() => (choice.boss = id)}>
						<img src={localSprite(id)} alt="" loading="lazy" />
						<span>{bossName(id)}</span>
						<span class="boss-hp">{BOSS_HP[id]} HP</span>
					</button>
				{/each}
			</div>

			<ChoiceGroup id="raidLength" label="Hvor lenge?" bind:value={choice.length} options={lengths} />

			<label class="field class-name">
				<span>Klassenavn (valgfritt)</span>
				<input id="raidClass" type="text" maxlength="40" placeholder="F.eks. 3B" bind:value={choice.className} />
			</label>
			<div class="actions">
				<button class="pm-button" id="createRaidBtn" onclick={create}>Lag raid</button>
			</div>
		</section>
	{:else if raid.phase === 'lobby'}
		<Lobby {code} {players} startLabel="Start raidet" onStart={startFight} onCancel={newSettings} onPlayer={openPlayerMenu}>
			{#snippet stage()}{#if raid}{@render bossStage(raid)}{/if}{/snippet}
		</Lobby>
	{:else}
		<header class="game-top">
			<GameControls newLabel="Nytt raid" endLabel="Avslutt raidet" onNew={newRaid} onSettings={newSettings} onEnd={endRaid} />
			<CodeChip {code} />
		</header>
		<section class="arena" class:won={raid.phase === 'won'}>
			{@render bossStage(raid)}

			<div class="side">
				{#if raid.phase === 'won'}
					<div class="panel victory" id="raidVictory">
						<h2>Dere klarte det!</h2>
						<p>Alle som var med, fanger {bossName(raid.bossId)} og får mynter for treffene sine.</p>
						{#if winners.length}<p class="muted">{winners.join(', ')}</p>{/if}
					</div>
				{:else}
					<ul class="feed" aria-live="polite" aria-label="Siste treff">
						{#each hits as h (h.id)}
							<li>
								{#if h.damage}<strong>{h.name}</strong> traff for <b class="dmg">{h.damage}</b>!{:else}<strong>{h.name}</strong> traff!{/if}
							</li>
						{/each}
					</ul>
				{/if}

				<div class="panel players">
					<h3>{players.length} {players.length === 1 ? 'spiller' : 'spillere'}</h3>
					<ul id="raidPlayers">
						{#each ranked as p (p.uuid)}
							<li class:offline={!p.connected}>
								<button class="name" title="Trykk for alternativer" onclick={(e) => openPlayerMenu(p, e)}>{p.name}</button>
								<span class="count" title="{p.catchCount} treff">{p.damage ?? p.catchCount}</span>
							</li>
						{/each}
					</ul>
				</div>
			</div>
		</section>
		{#if raid.phase === 'won'}<Fireworks />{/if}
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
	.bosses {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
		gap: 8px;
	}
	.boss-pick {
		display: grid;
		justify-items: center;
		gap: 2px;
		min-height: 44px;
		padding: 8px 6px;
		border: 2px solid var(--pm-line);
		border-radius: 14px;
		background: var(--pm-paper);
		color: var(--pm-ink);
		font: 600 14px/1.2 var(--pm-body);
		cursor: pointer;
	}
	.boss-pick img,
	.random {
		width: 64px;
		height: 64px;
		object-fit: contain;
	}
	.boss-hp {
		font-size: 12px;
		font-weight: 400;
		color: var(--pm-ink-soft);
		font-variant-numeric: tabular-nums;
	}
	.dmg {
		color: var(--pm-red);
		font-variant-numeric: tabular-nums;
	}
	.random {
		display: grid;
		place-items: center;
		font: 400 40px/1 var(--pm-display);
		color: var(--pm-ink-soft);
	}
	.picked {
		border-color: var(--pm-red);
		background: var(--pm-red-soft);
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
	/* The projector view: the boss on the left, everything else beside it; stacked on narrow screens. */
	.arena {
		display: grid;
		grid-template-columns: minmax(0, 3fr) minmax(260px, 2fr);
		gap: 20px;
		align-items: start;
	}
	@media (max-width: 760px) {
		.arena {
			grid-template-columns: 1fr;
		}
	}
	.boss-stage {
		display: grid;
		justify-items: center;
		padding: 20px;
		border-radius: var(--pm-radius);
		/* A dark stage, as the raid banner on the children's game page; the cream page around it
		   is too close to cream for a card to show. */
		background: radial-gradient(circle at 50% 38%, oklch(0.42 0.05 265), var(--pm-ink) 72%);
		color: var(--pm-paper);
		box-shadow: var(--pm-shadow);
	}
	.boss {
		width: min(420px, 80%);
		aspect-ratio: 1;
		object-fit: contain;
		filter: drop-shadow(0 18px 20px oklch(0 0 0 / 0.5));
	}
	.boss.shake {
		animation: hit 260ms ease-out;
	}
	@keyframes hit {
		0% { transform: translateX(0); filter: drop-shadow(0 18px 20px oklch(0 0 0 / 0.35)) brightness(1.6); }
		30% { transform: translateX(-10px) rotate(-3deg); }
		60% { transform: translateX(8px) rotate(2deg); }
		100% { transform: none; }
	}
	.won .boss {
		filter: drop-shadow(0 0 30px var(--pm-gold));
	}
	@media (prefers-reduced-motion: reduce) {
		.boss.shake {
			animation: none;
		}
	}
	.boss-name {
		margin: 8px 0 12px;
		font: 400 clamp(28px, 4vw, 44px)/1 var(--pm-display);
	}
	.hp {
		width: 100%;
		height: 28px;
		border-radius: 999px;
		background: oklch(1 0 0 / 0.18);
		overflow: hidden;
	}
	.hp-fill {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--pm-green);
		transition: width 300ms ease;
	}
	.hp-fill.low {
		background: var(--pm-red);
	}
	.hp-text {
		margin: 8px 0 0;
		font: 400 26px/1 var(--pm-display);
		font-variant-numeric: tabular-nums;
	}
	.side {
		display: grid;
		gap: 14px;
	}
	.side .panel {
		margin: 0;
	}
	.feed {
		min-height: 200px;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 20px;
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
