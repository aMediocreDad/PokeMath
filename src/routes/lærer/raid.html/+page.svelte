<script>
	// The teacher's raid screen, made for the projector (worker/raid.js). Pick a boss and a length,
	// let the class join with the code, start, and watch every correct answer hit the boss. A reload
	// rejoins the same raid (teacherRaidCode).
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import TeacherPage from '#lib/TeacherPage.svelte';
	import Fireworks from '#lib/Fireworks.svelte';
	import { ensureTeacher, getTeacherSession } from '#lib/teacher.js';
	import { qrDataUrl } from '#lib/qr.js';
	import { joinUrl, localSprite } from '#lib/bingoHost.js';
	import { LENGTHS, RAID_BOSSES } from '#lib/raidConfig.js';

	/** @typedef {{ uuid: string, name: string, icon: string, catchCount: number, connected: boolean }} Player */
	/** @typedef {import('#lib/bingo.js').RaidState} RaidState */

	const CODE_KEY = 'teacherRaidCode';

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
	/** @type {{ name: string, id: number }[]} newest first */
	let hits = $state([]);
	/** @type {string[]} */
	let winners = $state([]);
	let shake = $state(false);

	/** @type {Record<string, any>} pokemon_info.json, for the bosses' names */
	let info = $state({});
	/** @param {number} id */
	const bossName = (id) => info[String(id)]?.['0']?.name || `#${id}`;

	let choice = $state({ boss: /** @type {number | 'random'} */ ('random'), length: 'medium', className: '' });

	const ranked = $derived([...players].sort((a, b) => b.catchCount - a.catchCount));
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
			hits = (msg.recent || []).map((/** @type {{ name: string }} */ h) => ({ name: h.name, id: hitId++ })).reverse();
			ready = true;
		} else if (msg.type === 'lobbyEnded' || msg.type === 'lobbyState' || msg.type === 'lobbyNotFound') {
			// A bingo code, or a raid that has gone: start afresh.
			forget();
		} else if (msg.type === 'playersUpdate') {
			players = msg.players;
		} else if (msg.type === 'raidHit') {
			raid = msg.raid;
			players = msg.players;
			hits = [{ name: msg.name, id: hitId++ }, ...hits].slice(0, 8);
			shake = false;
			requestAnimationFrame(() => (shake = true));
		} else if (msg.type === 'raidWon') {
			raid = msg.raid;
			winners = msg.winners;
		} else if (msg.type === 'error') {
			alert(msg.message);
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
		send({ type: 'hostCreateRaid', settings: { boss: choice.boss, length: choice.length, className: choice.className.trim() } });
	}

	function startFight() {
		send({ type: 'hostStartRaid', code });
	}

	function end() {
		const fighting = raid?.phase === 'fight';
		if (fighting && !confirm('Avslutte raidet nå? Barna får mynter for treffene sine, men ikke Pokémonen.')) return;
		if (raid?.phase === 'lobby' && players.length && !confirm('Avbryte raidet? Barna kobles fra.')) return;
		// The room is forgotten when the server says it has ended, not before: an End sent on a
		// dropped connection would leave the children playing and the coins unpaid.
		if (ws?.readyState !== WebSocket.OPEN) return alert('Ingen forbindelse akkurat nå. Vent litt og prøv igjen.');
		send({ type: 'hostEndLobby', code });
	}

	/** @param {() => boolean} gone */
	async function start(gone) {
		if (!(await ensureTeacher())) {
			if (!gone()) goto('/lærer/index.html');
			return;
		}
		if (gone()) return;
		teacherSession = getTeacherSession();
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

<TeacherPage subtitle="Raid for klassen" back={{ href: '/lærer/index.html', label: 'Lærersiden' }}>
	{#if !ready}
		<p class="muted">Kobler til…</p>
	{:else if !raid}
		<section class="panel" id="raidSetup">
			<h2>⚔️ Nytt raid</h2>
			<p class="muted">
				Klassen kjemper sammen mot én stor Pokémon. Hvert riktige svar er ett treff. Når livet er borte, fanger alle som var med
				Pokémonen.
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
					</button>
				{/each}
			</div>

			<h3>Hvor lenge?</h3>
			<div class="lengths" role="radiogroup" aria-label="Lengde">
				{#each LENGTHS as [value, label, about] (value)}
					<button class="length-pick" class:picked={choice.length === value} role="radio" aria-checked={choice.length === value} onclick={() => (choice.length = value)}>
						<strong>{label}</strong>
						<span>{about}</span>
					</button>
				{/each}
			</div>

			<label class="field">
				<span>Klasse (valgfritt)</span>
				<input id="raidClass" type="text" maxlength="40" placeholder="f.eks. 3B" bind:value={choice.className} />
			</label>
			<div class="actions">
				<button class="pm-button" id="createRaidBtn" onclick={create}>Lag raid</button>
			</div>
		</section>
	{:else}
		<section class="arena" class:won={raid.phase === 'won'}>
			<div class="boss-stage">
				<img class="boss" class:shake src={localSprite(raid.bossId)} alt={bossName(raid.bossId)} onanimationend={() => (shake = false)} />
				<h2 class="boss-name">{bossName(raid.bossId)}</h2>
				{#if raid.phase !== 'lobby'}
					<div class="hp" role="meter" aria-label="Liv igjen" aria-valuemin="0" aria-valuemax={raid.maxHp} aria-valuenow={raid.hp}>
						<span class="hp-fill" class:low={percent < 25} style:width="{percent}%"></span>
					</div>
					<p class="hp-text" id="raidHp">{raid.hp} / {raid.maxHp} liv</p>
				{/if}
			</div>

			<div class="side">
				{#if raid.phase === 'lobby'}
					<div class="join panel">
						<p class="muted">Gå til <strong>Bli med i klassespill</strong> og skann QR-koden, eller skriv</p>
						<p class="code" id="raidCode">{code}</p>
						{#await qrDataUrl(joinUrl(code), 360) then src}<img class="qr" {src} alt="QR-kode for å bli med" width="180" height="180" />{/await}
					</div>
				{:else if raid.phase === 'won'}
					<div class="panel victory" id="raidVictory">
						<h2>🎉 Dere klarte det!</h2>
						<p>Alle som var med, fanger {bossName(raid.bossId)} og får mynter for treffene sine.</p>
						{#if winners.length}<p class="muted">{winners.join(', ')}</p>{/if}
					</div>
				{:else}
					<ul class="feed" aria-live="polite" aria-label="Siste treff">
						{#each hits as h (h.id)}<li><strong>{h.name}</strong> traff!</li>{/each}
					</ul>
				{/if}

				<div class="panel players">
					<h3>{players.length} {players.length === 1 ? 'spiller' : 'spillere'}</h3>
					{#if players.length}
						<ul id="raidPlayers">
							{#each ranked as p (p.uuid)}
								<li class:offline={!p.connected}>
									<span>{p.name}</span>
									{#if raid.phase !== 'lobby'}<span class="count">{p.catchCount}</span>{/if}
								</li>
							{/each}
						</ul>
					{:else}
						<p class="muted small">Ingen har blitt med ennå.</p>
					{/if}
				</div>

				<div class="actions">
					{#if raid.phase === 'lobby'}
						<button class="pm-button" id="startRaidBtn" disabled={!players.length} onclick={startFight}>Start raidet</button>
						<button class="pm-button secondary" onclick={end}>Avbryt</button>
					{:else}
						<!-- The children leave a won raid by themselves; this clears it here too. -->
						<button class="pm-button" class:secondary={raid.phase === 'fight'} id="endRaidBtn" onclick={end}>Avslutt raidet</button>
					{/if}
				</div>
			</div>
		</section>
		{#if raid.phase === 'won'}<Fireworks />{/if}
	{/if}
</TeacherPage>

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
	.boss-pick,
	.length-pick {
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
	.lengths {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
		margin-bottom: 16px;
	}
	.length-pick strong {
		font: 400 19px/1.1 var(--pm-display);
	}
	.length-pick span {
		color: var(--pm-ink-soft);
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
		background: radial-gradient(circle at 50% 40%, var(--pm-paper), var(--pm-cream) 70%);
		box-shadow: var(--pm-shadow);
	}
	.boss {
		width: min(420px, 80%);
		aspect-ratio: 1;
		object-fit: contain;
		filter: drop-shadow(0 18px 20px oklch(0 0 0 / 0.35));
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
		background: var(--pm-line);
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
	.join {
		display: grid;
		justify-items: center;
		text-align: center;
	}
	.join p {
		margin: 0;
	}
	.join .code {
		margin: 6px 0 10px;
		font: 800 clamp(40px, 6vw, 64px)/1 ui-monospace, Menlo, monospace;
		letter-spacing: 6px;
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
	.count {
		font-variant-numeric: tabular-nums;
	}
	.victory h2 {
		margin: 0 0 6px;
	}
</style>
