<script>
	// The top bar, storage notice and backup reminder (static/header.html on the legacy pages).
	// The ids the legacy scripts and the tests rely on are kept.
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { player } from '#lib/player.svelte.js';
	import { layout } from '#lib/layoutState.svelte.js';
	import { me } from '#lib/me.svelte.js';
	import { cloud, useCloud, keepDevice, decideLater, logOut } from '#lib/cloudSave.svelte.js';
	import { acceptedOldNotice, replaceSaveData, setLegacySaveFlag } from '#lib/storage.js';
	import { readBackup, deleteBackup, countPokemon } from '#lib/idbBackup.js';
	import { ask } from '#lib/ask.svelte.js';
	import { toast } from '#lib/toast.svelte.js';

	let showCookieNotice = $state(false);
	let backupDue = $state(false);
	let snoozeDays = $state('7');

	/** The save was gone when the page opened (cleared history, or a new device). */
	let saveMissing = false;

	/** Set when the storage notice has been read, so it shows once per device and login. */
	const NOTICE_SEEN = 'storageNoticeSeen';

	onMount(() => {
		// Whoever tapped the old cookie notice has read about the storage already.
		if (acceptedOldNotice()) localStorage.setItem(NOTICE_SEEN, '1');
		showCookieNotice = localStorage.getItem(NOTICE_SEEN) === null;
		setLegacySaveFlag();
		saveMissing = localStorage.getItem('pokemonlist') === null;
	});

	// With no save, offer the IndexedDB copy, but only once the cloud copy has been checked and
	// not offered: one question at a time, and the cloud copy first.
	let backupChecked = false;
	$effect(() => {
		if (!cloud.checked || backupChecked) return;
		backupChecked = true;
		if (!saveMissing || cloud.offer) return;
		readBackup().then((found) => {
			if (found?.data?.pokemonlist) restore = found;
		});
	});

	/** @param {number} at */
	const when = (at) => new Date(at).toLocaleString('nb-NO', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

	/** @type {import('#lib/idbBackup.js').Snapshot | null} A backup to offer, when the save is gone. */
	let restore = $state(null);

	async function restoreBackup() {
		const found = await readBackup();
		if (!found) return;
		const backupCount = countPokemon(found.data.pokemonlist);
		const currentCount = countPokemon(localStorage.getItem('pokemonlist'));
		if (backupCount < currentCount && !(await ask(`Backupen har ${backupCount} Pokémon, men du har allerede ${currentCount} her. Er du sikker på at du vil gjenopprette?`, { ok: 'Gjenopprett' }))) return;
		if (!replaceSaveData(found.data)) return toast('Fikk ikke hentet backupen, for det er ikke plass på enheten. Ingenting er endret.', { bad: true });
		restore = null;
		location.reload();
	}

	async function dropBackup() {
		await deleteBackup();
		restore = null;
	}

	// Like checkReminder() in global.js: decided once, when the save has loaded.
	let reminderChecked = false;
	$effect(() => {
		if (!player.loaded || reminderChecked) return;
		reminderChecked = true;
		const snoozeUntil = localStorage.getItem('backupReminder');
		backupDue = player.caught > 25 && (!snoozeUntil || new Date() > new Date(snoozeUntil));
	});

	const onBackupPage = $derived(page.url.pathname.includes('saveandload'));
	const showBackupReminder = $derived(backupDue && !onBackupPage);

	function acceptCookies() {
		localStorage.setItem(NOTICE_SEEN, '1');
		showCookieNotice = false;
	}

	async function resetPrompt() {
		if (!(await ask('Er du sikker på at du vil slette alle Pokémon og poeng? Det kan ikke angres.', { ok: 'Slett alt' }))) return;
		localStorage.clear();
		sessionStorage.clear();
		location.reload();
	}

	// The menu and the trainer card open on a tap (they only opened on hover before), and close
	// on a tap elsewhere or when the page changes. Mouse users keep the hover behaviour.
	let menuOpen = $state(false);
	let cardOpen = $state(false);
	$effect(() => {
		void page.url.pathname;
		menuOpen = false;
		cardOpen = false;
	});

	/** @param {PointerEvent} event */
	function closeMenus(event) {
		const target = /** @type {HTMLElement} */ (event.target);
		if (!target.closest('.menu')) menuOpen = false;
		if (!target.closest('.trainer')) cardOpen = false;
	}

	/** @param {number} n */
	const format = (n) => Number(n).toLocaleString('no-NO');

	/** A missing .webp avatar falls back to the .png, once. @param {Event} event */
	function pngFallback(event) {
		const img = /** @type {HTMLImageElement} */ (event.currentTarget);
		const src = img.getAttribute('src') ?? '';
		if (src.endsWith('.webp')) img.src = src.replace(/\.webp$/, '.png');
	}

	function snoozeBackup() {
		const days = parseInt(snoozeDays, 10);
		const until = new Date();
		until.setDate(until.getDate() + days);
		localStorage.setItem('backupReminder', until.toISOString());
		toast(days === 1 ? 'Du blir påminnet i morgen.' : `Du blir påminnet om ${days} dager.`);
		backupDue = false;
	}
</script>

<svelte:document onpointerdown={closeMenus} />

{#if showCookieNotice}
	<div class="sheet" id="cookie-container" role="dialog" aria-labelledby="cookie-title">
		<h2 id="cookie-title">Slik lagrer PokéMath</h2>
		<p>
			Spillet ditt lagres i nettleseren og i skyen, så du kan spille videre på en annen enhet. En informasjonskapsel
			(cookie) husker at du er logget inn. Det er ingen reklame og ingen sporing.
		</p>
		<div class="actions">
			<button class="pm-button" id="acceptCookies" onclick={acceptCookies}>Forstått!</button>
			<a class="pm-button secondary" href="/about.html#privacy">Les mer</a>
		</div>
	</div>
{/if}

<header class="pm-bar" id="topbar">
	<a href="/index.html" class="back" aria-label="Til forsiden">
		<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
	</a>
	<a href="/shop.html" id="money" class="stat" aria-label="Mynter, til butikken">
		<img src="/money.svg" width="28" height="28" alt="" />
		<span
			id="cointext"
			class="pm-stat-value"
			data-added={player.moneyDelta}
			data-total={layout.cheater ? '-99999' : player.money}>{layout.cheater ? '-99 999' : format(player.money)}</span
		>
		{#if player.moneyAnimating}<span class="delta" aria-hidden="true">{player.moneyDelta}</span>{/if}
	</a>
	<a href="/dex.html" id="caught" class="stat" aria-label="Pokémon fanget, til Pokédexen">
		<img src="/pokeball.svg" width="28" height="28" alt="" />
		<span id="balltext" class="pm-stat-value">{layout.cheater ? 0 : player.caught}</span>
	</a>
	<a href="/badges.html" id="badges" class="stat badges" aria-label="Merker">
		<img src="/images/badges/1.png" width="28" height="28" alt="" />
	</a>

	<div class="trainer" class:open={cardOpen}>
		<button class="trainer-button" aria-expanded={cardOpen} onclick={() => (cardOpen = !cardOpen)}>
			<img id="playerimage" class="avatar" src={player.playerImage} width="36" height="36" alt="" onerror={pngFallback} />
			<span id="playertext" class="trainer-name">{layout.cheater ? 'Juksemaker' : player.username}</span>
		</button>
		<div class="pm-panel trainer-panel">
			<div class="trainer-head">
				<img class="avatar large" src={player.playerImage} alt="" onerror={pngFallback} />
				<div>
					<div class="pm-panel-title">{player.username}</div>
					<div class="muted">Pokémon-trener</div>
					<a href="/player_profile.html" class="link">Min profil ›</a>
				</div>
			</div>
			<div class="panel-label">Oppgaver løst per nivå</div>
			<div class="tiers">
				{#each player.tiersSolved as solved, i (i)}
					<div class="tier">
						<span class="tier-count" id="t{i + 1}solved">{format(solved)}</span>
						<span class="tier-label">Nivå {i + 1}</span>
					</div>
				{/each}
				<div class="tier">
					<span class="tier-count" id="tadaptivesolved">{format(player.adaptiveSolved)}</span>
					<span class="tier-label">Tilpasset</span>
				</div>
			</div>
			<div id="levelDetails">
				{#if layout.workOverview}
					<div class="panel-label">Arbeidsoversikt</div>
					{#each [['today', 'I dag'], ['week', 'Denne uken'], ['month', 'Denne måneden']] as [period, title] (period)}
						{@const levels = Object.entries(layout.workOverview[/** @type {'today' | 'week' | 'month'} */ (period)])}
						<div class="work-row">
							<span>{title}</span>
							<span class="muted">
								{levels.length ? levels.map(([level, count]) => `Nivå ${level}: ${count}`).join(' · ') : '–'}
							</span>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</div>

	<div class="menu" class:open={menuOpen}>
		<button class="menu-button dropbtn" aria-label="Meny" aria-expanded={menuOpen} onclick={() => (menuOpen = !menuOpen)}>
			<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
			{#if layout.connection === 'disconnected'}
				<span class="offline" id="connection-status" title="Frakoblet: fikk ikke kontakt med serveren"></span>
			{/if}
		</button>
		<nav class="pm-panel menu-panel dropdown-content" aria-label="Meny">
			<!-- The order of the live menu (2026-10): your things first, then the site. -->
			<a href="/player_profile.html">Min profil</a>
			<a href="/dex.html">Pokédex</a>
			<a href="/shop.html">Butikk</a>
			<!-- Phones hide the badge shortcut in the bar, so the menu offers it instead. -->
			<a href="/badges.html" class="phone-only">Merker</a>
			<hr />
			<a href="/bingo_join.html" id="menuJoinBingo">Bli med i klassespill</a>
			{#if me.teacher}<a href="/lærer/index.html" id="menuTeacher">Lærersiden</a>{/if}
			<hr />
			<a href="/saveandload.html">Lagre / Last inn</a>
			<a href="/faq.html">Spørsmål og svar</a>
			<!-- Om siden opens with links to its news, contact and privacy sections. -->
			<a href="/about.html">Om siden</a>
			<hr />
			<button id="logoutBtn" onclick={logOut}>Logg ut{me.name ? ` (${me.name})` : ''}</button>
			<button class="danger" onclick={resetPrompt}>Tilbakestill (slett alt)</button>
		</nav>
	</div>
</header>

{#if player.backgroundImage}
	<img src={player.backgroundImage} alt="" id="background" />
{/if}

{#if restore}
	<div id="idb-restore-modal" class="backdrop">
		<div class="reminder" role="dialog" aria-labelledby="restore-title">
			<h2 id="restore-title">Ingen spillerdata funnet</h2>
			<p>
				Vi finner ingen spillerdata på denne enheten, men vi har en backup lagret fra
				<strong id="idb-restore-date">{new Date(restore.timestamp).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
				med <strong id="idb-restore-count">{countPokemon(restore.data.pokemonlist)}</strong> Pokémon.
			</p>
			<p>Ønsker du å gjenopprette profilen din fra denne backupen, eller slette den?</p>
			<button id="idb-restore-btn" class="pm-button" onclick={restoreBackup}>Gjenopprett profil</button>
			<div class="snooze">
				<button id="idb-delete-btn" class="pm-button secondary" onclick={dropBackup}>Slett backup</button>
				<button id="idb-close-btn" class="pm-button secondary" onclick={() => (restore = null)}>Lukk</button>
			</div>
		</div>
	</div>
{/if}

{#if cloud.offer}
	<div id="cloud-offer" class="backdrop">
		<div class="reminder" role="dialog" aria-labelledby="cloud-title">
			<h2 id="cloud-title">To ulike lagringer</h2>
			<p>
				Denne enheten har <strong>{cloud.offer.local}</strong> Pokémon. Lagringen i skyen har
				<strong>{cloud.offer.cloud.pokemon}</strong>, sist lagret {when(cloud.offer.cloud.updatedAt)}. Hvilken vil du fortsette
				med? Den andre blir borte.
			</p>
			<div class="actions centered">
				<button id="cloud-use-btn" class="pm-button" onclick={() => cloud.offer && useCloud(cloud.offer.cloud)}>Skyen ({cloud.offer.cloud.pokemon})</button>
				<button id="cloud-keep-btn" class="pm-button secondary" onclick={keepDevice}>Denne enheten ({cloud.offer.local})</button>
			</div>
			<div class="snooze centered">
				<button id="cloud-later-btn" class="pm-button secondary" onclick={decideLater}>Ikke nå</button>
			</div>
		</div>
	</div>
{/if}

<div id="backup-popup" class="backdrop" class:hidden={!showBackupReminder}>
	<div class="reminder" role="dialog" aria-labelledby="reminder-title">
		<h2 id="reminder-title">Påminnelse</h2>
		<p>Det er på tide å lagre en backup! Vil du lagre en nå, eller vil du bli påminnet senere?</p>
		<button id="do-backup-btn" class="pm-button" onclick={() => (location.href = '/saveandload.html')}>Lagre en backup!</button>
		<div class="snooze">
			<select id="snooze-select" bind:value={snoozeDays} aria-label="Påminn meg om">
				<option value="1">Påminn meg om 1 dag</option>
				<option value="3">Påminn meg om 3 dager</option>
				<option value="7">Påminn meg om 1 uke</option>
				<option value="14">Påminn meg om 2 uker</option>
				<option value="30">Påminn meg om 1 måned</option>
				<option value="90">Påminn meg om 3 måneder</option>
			</select>
			<button id="snooze-btn" class="pm-button secondary" onclick={snoozeBackup}>Utsett</button>
		</div>
	</div>
</div>

<style>
	/* The background bought in the shop, fixed behind the whole page. */
	#background {
		position: fixed;
		inset: 0;
		z-index: -2;
		width: 100%;
		height: 100%;
		object-fit: cover;
		pointer-events: none;
	}
	/* ── The bar ─────────────────────────────────────────────────────────────── */
	.pm-bar {
		position: fixed;
		inset: 0 0 auto 0;
		z-index: 1000;
		height: var(--pm-bar-height);
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 0 8px;
		background: var(--pm-red);
		box-shadow: 0 3px 0 var(--pm-red-deep);
		color: var(--pm-paper);
	}
	.pm-bar a {
		color: inherit;
		text-decoration: none;
	}
	.pm-bar svg {
		fill: none;
		stroke: currentColor;
		stroke-width: 2.6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.back,
	.menu-button {
		position: relative;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: none;
		border-radius: 50%;
		background: transparent;
		color: var(--pm-paper);
		cursor: pointer;
	}
	.back:active,
	.menu-button:active,
	.menu.open .menu-button {
		background: var(--pm-red-deep);
	}
	/* The server did not answer the player id check: a warning dot, where the bottom bar had a light. */
	.offline {
		position: absolute;
		top: 4px;
		right: 4px;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--pm-gold);
		box-shadow: 0 0 0 2px var(--pm-red-deep);
	}

	.stat {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 40px;
		padding: 0 14px 0 6px;
		border-radius: 999px;
		background: var(--pm-red-deep);
		flex-shrink: 0;
	}
	.stat img {
		display: block;
	}
	.pm-stat-value {
		font-family: var(--pm-display);
		font-size: 20px;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}
	.badges {
		padding: 0 6px;
	}
	.delta {
		position: absolute;
		left: 40px;
		top: 34px;
		padding: 2px 8px;
		border-radius: 999px;
		background: var(--pm-gold);
		color: var(--pm-ink);
		font-family: var(--pm-display);
		font-size: 15px;
		animation: delta 0.5s ease-out both;
		pointer-events: none;
	}
	@keyframes delta {
		from { opacity: 0; transform: translateY(-6px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* ── Panels: the trainer card and the menu ───────────────────────────────── */
	.trainer {
		position: relative;
		margin-left: auto;
	}
	.trainer-button {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 44px;
		padding: 0 12px 0 4px;
		border: none;
		border-radius: 999px;
		background: transparent;
		color: var(--pm-paper);
		font: 600 18px var(--pm-body);
		cursor: pointer;
	}
	.trainer.open .trainer-button,
	.trainer-button:active {
		background: var(--pm-red-deep);
	}
	.avatar#playerimage,
	.avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--pm-paper);
		object-fit: contain;
		object-position: center top;
	}
	.avatar.large {
		width: 72px;
		height: 72px;
		border-radius: 18px;
		background: var(--pm-cream);
	}
	.menu {
		position: relative;
	}

	.pm-panel {
		display: none;
		box-sizing: border-box;
		position: absolute;
		top: calc(100% + 10px);
		right: 0;
		width: 300px;
		padding: 10px;
		border-radius: var(--pm-radius);
		background: var(--pm-paper);
		color: var(--pm-ink);
		box-shadow: var(--pm-shadow), 0 0 0 1px var(--pm-line);
		/* Below the bar, with a little room at the bottom; it scrolls only on the smallest phones. */
		max-height: calc(100vh - var(--pm-bar-height) - 24px);
		max-height: calc(100dvh - var(--pm-bar-height) - 24px);
		overflow-y: auto;
	}
	.trainer.open .pm-panel,
	.menu.open .pm-panel {
		display: block;
	}
	@media (hover: hover) {
		.trainer:hover .pm-panel,
		.menu:hover .pm-panel {
			display: block;
		}
	}

	.menu-panel a,
	.menu-panel button {
		display: flex;
		align-items: center;
		box-sizing: border-box;
		width: 100%;
		min-height: 44px;
		padding: 0 14px;
		border: none;
		border-radius: 12px;
		background: none;
		color: var(--pm-ink);
		font: 600 18px var(--pm-body);
		text-align: left;
		cursor: pointer;
	}
	.menu-panel a:hover,
	.menu-panel button:hover,
	.menu-panel a:active {
		background: var(--pm-cream);
	}
	.menu-panel .danger {
		color: var(--pm-red-deep);
	}
	.menu-panel hr {
		margin: 6px 4px;
		border: none;
		border-top: 1px solid var(--pm-line);
	}
	.menu-panel a.phone-only {
		display: none;
	}

	.trainer-head {
		display: flex;
		gap: 14px;
		align-items: center;
		padding: 6px;
	}
	.pm-panel-title {
		font-family: var(--pm-display);
		font-size: 24px;
	}
	.muted {
		color: var(--pm-ink-soft);
	}
	.link {
		color: var(--pm-red-deep);
		font-weight: 700;
	}
	.panel-label {
		margin: 14px 6px 6px;
		color: var(--pm-ink-soft);
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.tiers {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 6px;
	}
	.tier {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 8px 2px;
		border-radius: 12px;
		background: var(--pm-cream);
	}
	.tier-count {
		font-family: var(--pm-display);
		font-size: 20px;
	}
	.tier-label {
		color: var(--pm-ink-soft);
		font-size: 12px;
	}
	.work-row {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		padding: 4px 6px;
		font-size: 15px;
	}

	/* ── Storage notice and backup reminder ───────────────────────────────────── */
	.sheet {
		position: fixed;
		left: 12px;
		right: 12px;
		bottom: calc(12px + env(safe-area-inset-bottom));
		z-index: 1100;
		max-width: 520px;
		margin: 0 auto;
		padding: 18px 20px;
		border-radius: var(--pm-radius);
		background: var(--pm-paper);
		box-shadow: var(--pm-shadow), 0 0 0 1px var(--pm-line);
	}
	.sheet h2,
	.reminder h2 {
		margin: 0 0 6px;
		font-family: var(--pm-display);
		font-weight: 400;
		font-size: 24px;
	}
	.sheet p,
	.reminder p {
		margin: 0 0 14px;
		line-height: 1.45;
	}
	.sheet a:not(.pm-button) {
		color: var(--pm-red-deep);
	}
	.actions {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 1200;
		display: grid;
		place-items: center;
		padding: 16px;
		background: oklch(0.28 0.035 265 / 0.55);
	}
	.actions.centered,
	.snooze.centered {
		justify-content: center;
	}
	.backdrop.hidden {
		display: none;
	}
	.reminder {
		box-sizing: border-box;
		width: min(440px, 100%);
		padding: 22px;
		border-radius: var(--pm-radius);
		background: var(--pm-paper);
		text-align: center;
	}
	.snooze {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 12px;
	}
	/* Side by side where they fit, each a full row on a narrow phone. */
	.snooze > :global(*) {
		flex: 1 1 auto;
	}
	.snooze select {
		flex: 1 1 12em;
		min-width: 0;
		min-height: 48px;
		padding: 0 10px;
		border: 2px solid var(--pm-line);
		border-radius: 12px;
		background: var(--pm-paper);
		color: var(--pm-ink);
		font-size: 16px;
	}

	/* ── Phones ──────────────────────────────────────────────────────────────── */
	@media (max-width: 720px) {
		.trainer-name {
			display: none;
		}
		.trainer-button {
			padding: 0 4px;
		}
		.pm-panel {
			position: fixed;
			top: calc(var(--pm-bar-height) + 8px);
			left: 8px;
			right: 8px;
			width: auto;
		}
		.menu-panel {
			left: auto;
			width: min(300px, calc(100vw - 16px));
		}
	}
	@media (max-width: 420px) {
		.badges {
			display: none;
		}
		.menu-panel a.phone-only {
			display: flex;
		}
		.stat {
			padding-right: 10px;
		}
		.pm-stat-value {
			font-size: 18px;
		}
	}
	@media (max-width: 340px) {
		.trainer {
			display: none;
		}
		.menu {
			margin-left: auto;
		}
	}
</style>
