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
		<div id="playercard" class="topbar-icon-left playercard">
			<!-- No href: on touch screens a tap opens the trainer card, as in the legacy header. -->
			<!-- svelte-ignore a11y_missing_attribute -->
			<a class="playerbtn">
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
		<div class="dropdown">
			<button class="dropbtn">
				<img id="gearimage" src="/images/gear.png" width="50" height="50" alt="Meny" />
			</button>
			<div class="dropdown-content">
				<a href="/index.html">Hovedmeny</a>
				<a href="/dex.html">Pokedex</a>
				<a href="/shop.html">Butikk</a>
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
