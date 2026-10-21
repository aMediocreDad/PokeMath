<script>
	// The top bar, cookie notice and backup reminder (static/header.html on the legacy pages).
	// It has its own class names, so the legacy header rules in globalstyle.css do not apply;
	// the ids the legacy scripts and the tests rely on are kept.
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { player } from '#lib/player.svelte.js';
	import { layout } from '#lib/layoutState.svelte.js';
	import { hasCookieConsent } from '#lib/storage.js';

	let showCookieNotice = $state(false);
	let backupDue = $state(false);
	let snoozeDays = $state('7');

	onMount(() => (showCookieNotice = !hasCookieConsent()));

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
		const expires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString();
		document.cookie = `cookies=true;expires=${expires};path=/`;
		showCookieNotice = false;
	}

	function resetPrompt() {
		if (!confirm('Er du sikker på at du vil slette alle pokemon og poeng?')) return;
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

	function snoozeBackup() {
		const days = parseInt(snoozeDays, 10);
		const until = new Date();
		until.setDate(until.getDate() + days);
		localStorage.setItem('backupReminder', until.toISOString());
		alert(`Varselett ble utsatt i ${days} dag(er).`);
		backupDue = false;
	}
</script>

<svelte:document onpointerdown={closeMenus} />

{#if showCookieNotice}
	<div class="sheet" id="cookie-container" role="dialog" aria-labelledby="cookie-title">
		<h2 id="cookie-title">🔒 Lagring av data</h2>
		<p>
			PokéMath lagrer Pokémon og spillerdata lokalt i nettleseren din (localStorage) – ingen cookies, ingen
			sporing. Ved å bruke siden godkjenner du vår <a href="/about.html#privacy">personvernerklæring</a>.
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
			<img id="playerimage" class="avatar" src={player.playerImage} width="36" height="36" alt="" />
			<span id="playertext" class="trainer-name">{layout.cheater ? 'Juksemaker' : player.username}</span>
		</button>
		<div class="pm-panel trainer-panel">
			<div class="trainer-head">
				<img class="avatar large" src={player.playerImage} alt="" />
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
		</button>
		<nav class="pm-panel menu-panel dropdown-content" aria-label="Meny">
			<a href="/index.html">Hovedmeny</a>
			<a href="/dex.html">Pokédex</a>
			<a href="/shop.html">Butikk</a>
			<!-- Phones hide these two header shortcuts, so the menu offers them instead. -->
			<a href="/badges.html" class="phone-only">Merker</a>
			<a href="/player_profile.html" class="phone-only">Min profil</a>
			<a href="/saveandload.html">Lagre / Last inn</a>
			<a href="/faq.html">Spørsmål og svar</a>
			<a href="/about.html">Om siden</a>
			<a href="/about.html#contact">Kontakt oss</a>
			<a href="/about.html#news">Nylige oppdateringer</a>
			<button class="danger" onclick={resetPrompt}>Tilbakestill (slett alt)</button>
		</nav>
	</div>
</header>

{#if player.backgroundImage}
	<img src={player.backgroundImage} alt="" id="background" />
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
		position: absolute;
		top: calc(100% + 10px);
		right: 0;
		width: 300px;
		padding: 10px;
		border-radius: var(--pm-radius);
		background: var(--pm-paper);
		color: var(--pm-ink);
		box-shadow: var(--pm-shadow), 0 0 0 1px var(--pm-line);
		max-height: calc(100vh - var(--pm-bar-height) - 60px);
		max-height: calc(100dvh - var(--pm-bar-height) - 60px);
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
		width: 100%;
		min-height: 46px;
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
		margin-top: 6px;
		border-top: 1px solid var(--pm-line);
		border-radius: 0 0 12px 12px;
		color: var(--pm-red-deep);
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
		grid-template-columns: repeat(5, 1fr);
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

	/* ── Cookie notice and backup reminder ───────────────────────────────────── */
	.sheet {
		position: fixed;
		left: 12px;
		right: 12px;
		bottom: 56px;
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
	.backdrop.hidden {
		display: none;
	}
	.reminder {
		width: min(440px, 100%);
		padding: 22px;
		border-radius: var(--pm-radius);
		background: var(--pm-paper);
		text-align: center;
	}
	.snooze {
		display: flex;
		gap: 8px;
		margin-top: 12px;
	}
	.snooze select {
		flex: 1;
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
