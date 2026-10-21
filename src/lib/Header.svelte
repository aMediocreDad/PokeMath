<script>
	// The top bar, cookie notice and backup reminder from static/header.html.
	// Ids and classes are kept so static/globalstyle.css styles it the same way.
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
		if (!target.closest('.dropdown')) menuOpen = false;
		if (!target.closest('.playercard')) cardOpen = false;
	}

	function snoozeBackup() {
		const days = parseInt(snoozeDays, 10);
		const until = new Date();
		until.setDate(until.getDate() + days);
		localStorage.setItem('backupReminder', until.toISOString());
		alert(`Varselett ble utsatt i ${days} dag(er).`);
		backupDue = false;
	}
</script>

{#if showCookieNotice}
	<div class="cookie-container" id="cookie-container">
		<h2 class="cookie-header">🔒 Lagring av data</h2>
		<div>
			<p class="cookie-text">
				PokéMath lagrer Pokémon og spillerdata lokalt i nettleseren din (localStorage) – ingen
				cookies, ingen sporing. Ved å bruke siden godkjenner du vår
				<a href="/about.html#privacy">personvernerklæring</a>.
			</p>
			<button class="button-1" id="acceptCookies" onclick={acceptCookies}>Forstått!</button>
			<a class="button-2" href="/about.html#privacy">Les mer</a>
		</div>
	</div>
{/if}

<!-- pointerdown rather than click: iOS often sends no click for a tap on a blank area. -->
<svelte:document onpointerdown={closeMenus} />

<div>
	<div class="topbar" id="topbar">
		<a href="/index.html" id="backbutton">&#8249;</a>
		<a href="/shop.html" id="money" class="topbar-icon-left">
			<img id="coinimage" src="/money.svg" width="50" height="50" alt="Mynter" />
			<span
				id="cointext"
				class="topbar-icontext-left money score"
				class:animate={player.moneyAnimating}
				data-added={player.moneyDelta}
				data-total={layout.cheater ? '-99999' : player.money}
			></span>
		</a>
		<a href="/dex.html" id="caught" class="topbar-icon-left">
			<img id="ballimage" src="/pokeball.svg" width="50" height="50" alt="Pokémon fanget" />
			<span id="balltext" class="topbar-icontext-left">{layout.cheater ? 0 : player.caught}</span>
		</a>
		<a href="/badges.html" id="badges" class="topbar-icon-left">
			<img id="badgeimage" src="/images/badges/1.png" width="50" height="50" alt="Merker" />
		</a>
		<div id="playercard" class="topbar-icon-left playercard" class:open={cardOpen}>
			<!-- svelte-ignore a11y_missing_attribute, a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
			<a class="playerbtn" onclick={() => (cardOpen = !cardOpen)}>
				<img id="playerimage" src={player.playerImage} width="50" height="50" alt="" />
				<span id="playertext" class="topbar-icontext-left">{layout.cheater ? 'Juksemaker' : player.username}</span>
			</a>
			<div class="playercard-content">
				<div class="trainercard">
					<div class="tc-avatar">
						<img id="playerimagebig" src={player.playerImage} alt="" />
					</div>
					<div class="tc-body">
						<div class="tc-header">
							<span id="playertextheader" class="tc-name">{player.username}</span>
							<a href="/player_profile.html" class="tc-profile-link">Min profil ›</a>
						</div>
						<div class="tc-subtitle">Pokémon Trener</div>
						<div class="tc-stats-label">Oppgaver løst per nivå</div>
						<div class="tc-stats">
							{#each player.tiersSolved as solved, i (i)}
								<div class="tc-stat">
									<span class="tc-stat-n" id="t{i + 1}solved">{solved}</span>
									<span class="tc-stat-l">Niv. {i + 1}</span>
								</div>
							{/each}
						</div>
					</div>
				</div>
				<div id="tracker" class="tc-tracker">
					<div id="levelDetails">
						{#if layout.workOverview}
							<h3>Arbeidsoversikt:</h3>
							{#each [['today', 'I dag'], ['week', 'Denne uken'], ['month', 'Denne måneden']] as [period, title] (period)}
								<h4>{title}:</h4>
								{#each Object.entries(layout.workOverview[/** @type {'today' | 'week' | 'month'} */ (period)]) as [level, count] (level)}
									<p>{level}: {count} oppgave(r)</p>
								{/each}
							{/each}
						{/if}
					</div>
				</div>
			</div>
		</div>
		<div class="dropdown" class:open={menuOpen}>
			<button class="dropbtn" aria-expanded={menuOpen} onclick={() => (menuOpen = !menuOpen)}>
				<img id="gearimage" src="/images/gear.png" width="50" height="50" alt="Meny" />
			</button>
			<div class="dropdown-content">
				<a href="/index.html">Hovedmeny</a>
				<a href="/dex.html">Pokedex</a>
				<a href="/shop.html">Butikk</a>
				<!-- Phones hide these two header shortcuts, so the menu offers them instead. -->
				<a href="/badges.html" class="phone-only">Merker</a>
				<a href="/player_profile.html" class="phone-only">Min profil</a>
				<a href="/about.html">Om siden</a>
				<a href="/about.html#contact">Kontakt oss</a>
				<a href="/about.html#news">Nylige oppdateringer</a>
				<a href="/saveandload.html">Lagre / Last Inn</a>
				<a href="/faq.html">FAQ</a>
				<!-- svelte-ignore a11y_missing_attribute, a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
				<a onclick={resetPrompt}>Tilbakestill (Slett alt)</a>
			</div>
		</div>
	</div>
	{#if player.backgroundImage}
		<img src={player.backgroundImage} alt="" id="background" />
	{/if}
	<div id="backup-popup" class="popup" class:hidden={!showBackupReminder}>
		<div class="popup-content">
			<h2>Påminnelse</h2>
			<p>
				Det er på tide å lagre en backup!<br />
				Vil du lagre en nå, eller vil du bli påminnet senere?
			</p>
			<div class="popup-actions">
				<button
					id="do-backup-btn"
					class="button-1"
					onclick={() => (location.href = '/saveandload.html')}>Lagre en backup!</button
				>
				<select id="snooze-select" bind:value={snoozeDays}>
					<option value="1">Påminn meg om 1 dag</option>
					<option value="3">Påminn meg om 3 dager</option>
					<option value="7">Påminn meg om 1 uke</option>
					<option value="14">Påminn meg om 2 uker</option>
					<option value="30">Påminn meg om 1 måned</option>
					<option value="90">Påminn meg om 3 måneder</option>
				</select>
				<button id="snooze-btn" class="button-2" onclick={snoozeBackup}>Utsett</button>
			</div>
		</div>
	</div>
</div>

<style>

	/* Touch screens: open on tap, and keep a tapped link or button from staying grey. */
	.dropdown.open .dropdown-content,
	.playercard.open .playercard-content {
		display: block;
	}
	@media (hover: none) {
		.dropdown:not(.open) .dropdown-content,
		.playercard:not(.open) .playercard-content {
			display: none;
		}
		.topbar a:hover,
		.dropdown:hover .dropbtn {
			background-color: transparent;
			color: inherit;
		}
		.dropdown-content a {
			min-height: 44px;
			display: flex;
			align-items: center;
		}
		#backbutton {
			min-width: 44px;
			min-height: 44px;
			box-sizing: border-box;
			display: flex;
			align-items: center;
			justify-content: center;
		}
		/* 16px keeps iOS from zooming in when the list opens. */
		#snooze-select {
			min-height: 44px;
			font-size: 16px;
		}
	}

	/* Phones: a single row that keeps coins and Pokémon counts visible. */
	@media (max-width: 720px) {
		.topbar {
			display: flex;
			align-items: center;
			gap: 2px;
		}
		.topbar > a,
		.topbar-icon-left,
		.dropdown {
			float: none;
			top: 0;
		}
		#backbutton {
			display: flex;
			align-items: center;
			justify-content: center;
			min-width: 44px;
			height: 50px;
			padding: 0;
		}
		.topbar-icon-left {
			display: flex;
			align-items: center;
			gap: 4px;
			height: 50px;
			padding: 0 6px;
			flex-shrink: 0;
		}
		.topbar-icon-left img {
			width: 34px;
			height: 34px;
		}
		.topbar-icontext-left {
			display: inline;
			position: static;
			top: 0;
			font-size: 17px;
		}
		.playercard {
			margin-left: auto;
		}
		.playerbtn {
			padding: 0 4px;
		}
		.playerbtn #playerimage {
			display: block;
			width: 34px;
			height: 34px;
		}
		.playerbtn #playertext {
			display: none;
		}
		.dropdown {
			flex-shrink: 0;
		}
		.dropbtn img {
			width: 40px;
			height: 40px;
		}
		.dropdown-content {
			position: fixed;
			top: 50px;
			right: 8px;
			left: auto;
			width: min(260px, calc(100vw - 16px));
			/* Scroll inside the menu on short screens instead of running under the bottom bar. */
			max-height: calc(100vh - 50px - 56px);
			/* iOS counts the area under Safari's toolbar in 100vh; dvh does not (newer Safari). */
			max-height: calc(100dvh - 50px - 56px);
			overflow-y: auto;
		}
		.playercard-content {
			position: fixed;
			top: 50px;
			left: 8px;
			right: 8px;
			min-width: 0;
		}
		.trainercard {
			min-width: 0;
		}
	}

	/* Narrow phones: the shortcuts give way to the coin and Pokémon counts, and move into the menu. */
	.dropdown-content a.phone-only {
		display: none;
	}
	@media (max-width: 420px) {
		#badges {
			display: none;
		}
		.dropdown-content a.phone-only {
			display: flex;
			align-items: center;
		}
	}
	@media (max-width: 340px) {
		.playercard {
			display: none;
		}
		.dropdown {
			margin-left: auto;
		}
	}
</style>
