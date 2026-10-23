<script>
	import { onMount } from 'svelte';
	import { player } from '#lib/player.svelte.js';
	import { toast } from '#lib/toast.svelte.js';
	import { ICON_MAP, BG_NAMES } from '#lib/data/cosmetics.js';
	import { loadPokemonInfo, pokemonInfo } from '#lib/game/pokemon.js';
	import { me } from '#lib/me.svelte.js';
	import { cloud, logOut } from '#lib/cloudSave.svelte.js';
	import { canTilt, tiltOn, setTilt } from '#lib/tilt.js';

	const P = 'images/playericons/';

	let usernameInput = $state('');
	let uuid = $state('Laster…');
	let iconsOpen = $state(false);
	let backgroundsOpen = $state(false);
	/** Whether the shiny foil follows the tilt; shown only on a phone or tablet. */
	let tiltShown = $state(false);
	let tilt = $state(false);

	// Fill the form once, when the save has loaded (initProfile() in the legacy page).
	let initialised = false;
	$effect(() => {
		if (!player.loaded || initialised) return;
		initialised = true;
		usernameInput = player.username || '';
	});
	/** Forms switched on in pokemon_info.json: the totals for the progress bars (live, 2026-10). */
	let enabled = $state({ base: 0, alt: 0 });
	/** Coins spent, from the Big Spender badge (id 20). */
	let spent = $state(0);
	onMount(() => {
		uuid = localStorage.getItem('UUID') || '–';
		tiltShown = canTilt();
		tilt = tiltOn();
		try {
			spent = (JSON.parse(localStorage.getItem('badges') ?? 'null') || { badges: [] }).badges.find((/** @type {{ id: number }} */ b) => b.id === 20)?.progress || 0;
		} catch {
			spent = 0;
		}
		loadPokemonInfo().then(() => {
			let base = 0;
			let alt = 0;
			for (const variants of Object.values(pokemonInfo() ?? {})) {
				for (const [key, v] of Object.entries(variants)) {
					if (!v.enabled) continue;
					if (key === '0') base++;
					else alt++;
				}
			}
			enabled = { base, alt };
		});
	});

	/** @param {string} id */
	const iconFor = (id) => ICON_MAP[id] ?? { id, name: id, img: P + id + '.png' };

	const ownedIcons = $derived([...new Set(player.boughtPlayerIcons)]);

	const activeIcon = $derived(
		player.playerIcon ? iconFor(player.playerIcon) : { name: 'Ingen valgt', img: 'images/player.png' }
	);

	const progressBars = $derived.by(() => {
		const baseN = new Set(), baseS = new Set(), altN = new Set(), altS = new Set();
		for (const entry of player.pkmnList) {
			const id = entry.slice(1);
			const isAlt = id.includes('-');
			if (entry[0] === 'S') (isAlt ? altS : baseS).add(id);
			else (isAlt ? altN : baseN).add(id);
		}
		const maxBase = enabled.base > 0 ? enabled.base : 1025;
		const maxAlt = enabled.alt > 0 ? enabled.alt : null;
		return [
			{ label: 'Normal (base)', count: baseN.size, total: maxBase, color: '#4a90d9' },
			{ label: 'Shiny (base)', count: baseS.size, total: maxBase, color: '#d4a017' },
			{ label: 'Alt form', count: altN.size, total: maxAlt, color: '#9b59b6' },
			{ label: 'Alt shiny', count: altS.size, total: maxAlt, color: '#e91e96' },
			{
				label: 'Total unike',
				count: baseN.size + baseS.size + altN.size + altS.size,
				total: (maxBase + (maxAlt || 0)) * 2,
				color: '#2cbb63'
			}
		].map((bar) => ({
			...bar,
			percent: Math.min((bar.count / (bar.total ?? 400)) * 100, 100),
			text: bar.total
				? `${bar.count.toLocaleString('no-NO')} / ${bar.total.toLocaleString('no-NO')}`
				: `${bar.count.toLocaleString('no-NO')} fanget`
		}));
	});

	/** @param {number} n */
	const format = (n) => (n || 0).toLocaleString('no-NO');

	function saveUsername() {
		const name = usernameInput.trim();
		if (!name) return;
		player.username = name;
		localStorage.setItem('username', name);
		player.save('username');
		toast('Brukernavn lagret: ' + name);
	}

	/**
	 * @param {string} id
	 * @param {string} img
	 */
	function equipIcon(id, img) {
		player.playerIcon = id;
		player.playerIconImg = img;
		localStorage.setItem('playerIcon', JSON.stringify(id));
		localStorage.setItem('playerIconImg', img);
		player.save('playerIcon');
		toast('Figuren ble endret til ' + iconFor(id).name + '!');
	}

	function removeIcon() {
		player.playerIcon = '';
		player.playerIconImg = '';
		localStorage.setItem('playerIcon', JSON.stringify(''));
		localStorage.removeItem('playerIconImg');
		player.save('playerIcon');
		toast('Figuren ble fjernet.');
	}

	/** @param {string} id */
	function equipBg(id) {
		player.background = id;
		localStorage.setItem('shopBackground', JSON.stringify(id));
		player.save('background');
		toast('Bakgrunnen ble endret til ' + (BG_NAMES[id] || id) + '!');
	}

	function removeBg() {
		player.background = '';
		localStorage.setItem('shopBackground', JSON.stringify(''));
		player.save('background');
		toast('Bakgrunnen ble fjernet.');
	}

	/** Safari asks before the page gets the tilt, and says no when the question is declined. */
	async function switchTilt() {
		const wanted = tilt;
		tilt = await setTilt(wanted);
		if (wanted && !tilt) toast('Fikk ikke lov til å bruke bevegelsen. Prøv igjen, og trykk Tillat.');
	}

	function copyUUID() {
		navigator.clipboard.writeText(uuid).then(() => toast('UUID kopiert!'));
	}
</script>

<svelte:head>
	<title>Pokémath - Min profil</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="main pm-page profile-page">
	<h1 class="pm-title">Min profil</h1>

	<section class="hero pm-surface">
		<img class="hero-avatar" src={activeIcon.img} alt="" />
		<div class="hero-body">
			<label class="field-label" for="usernameInput">Brukernavn</label>
			<div class="username-row">
				<input
					id="usernameInput"
					class="username-input"
					type="text"
					maxlength="22"
					placeholder="Ditt brukernavn"
					bind:value={usernameInput}
				/>
				<button class="pm-button small" onclick={saveUsername}>Lagre</button>
			</div>
			<p class="hint">Navnet vises i toppmenyen og på ranglisten.</p>
		</div>
	</section>

	<h2 class="pm-section-title">Statistikk</h2>
	<div class="stats-grid">
		<div class="stat-item pm-surface">
			<div class="stat-value pm-price" id="statCoins">{player.loaded ? format(player.money) : '–'}</div>
			<div class="stat-label">Mynter</div>
		</div>
		<div class="stat-item pm-surface">
			<div class="stat-value pm-price" id="statSpent">{player.loaded ? format(spent) : '–'}</div>
			<div class="stat-label">Mynter brukt</div>
		</div>
		<div class="stat-item pm-surface">
			<div class="stat-value" id="statCaught">{player.loaded ? format(player.caught) : '–'}</div>
			<div class="stat-label">Pokémon fanget</div>
		</div>
		{#each player.tiersSolved as solved, i (i)}
			<div class="stat-item pm-surface">
				<div class="stat-value" id="statT{i + 1}">{player.loaded ? format(solved) : '–'}</div>
				<div class="stat-label">Oppgaver nivå {i + 1}</div>
			</div>
		{/each}
		<div class="stat-item pm-surface">
			<div class="stat-value" id="statAdaptive">{player.loaded ? format(player.adaptiveSolved) : '–'}</div>
			<div class="stat-label">Tilpasset nivå</div>
		</div>
		<div class="stat-item pm-surface">
			<div class="stat-value" id="statCustom">{player.loaded ? format(player.customSolved) : '–'}</div>
			<div class="stat-label">Egne oppgaver</div>
		</div>
	</div>

	<section class="panel pm-surface">
		<h3 class="card-title">Pokédex</h3>
		<div id="profileProgressBars">
			{#each progressBars as bar (bar.label)}
				<div class="profile-pbar">
					<span class="profile-pbar-label">{bar.label}</span>
					<div class="profile-pbar-track">
						<div class="profile-pbar-fill" style:width="{bar.percent.toFixed(1)}%" style:background={bar.color}></div>
					</div>
					<span class="profile-pbar-text">{bar.text}</span>
				</div>
			{/each}
		</div>
	</section>

	<h2 class="pm-section-title">Utseende</h2>
	<div class="looks">
		<section class="panel pm-surface">
			<h3 class="card-title">Figur</h3>
			<div class="active-preview" id="iconPreview">
				<img id="activeIconImg" src={activeIcon.img} alt="" class="active-icon-img" />
				<span id="activeIconName" class="active-name">{activeIcon.name}</span>
				<button class="pm-button small secondary" onclick={removeIcon}>Fjern figur</button>
			</div>
			<button class="toggle" class:open={iconsOpen} aria-expanded={iconsOpen} onclick={() => (iconsOpen = !iconsOpen)}>
				<span>Dine figurer <span class="count" id="ownedIconCount">{ownedIcons.length}</span></span>
				<span class="chevron" aria-hidden="true">▾</span>
			</button>
			<div class="collapsible-body" class:collapsed={!iconsOpen} id="iconGrid">
				<div class="owned-grid" id="ownedIconGrid">
					{#each ownedIcons as id (id)}
						{@const icon = iconFor(id)}
						<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
						<div class="owned-card" class:active-card={id === player.playerIcon} onclick={() => equipIcon(id, icon.img)}>
							<img src={icon.img} alt="" loading="lazy" />
							<span>{icon.name}</span>
							{#if id === player.playerIcon}<div class="active-badge">I bruk</div>{/if}
						</div>
					{:else}
						<p class="no-owned">Du eier ingen figurer ennå. Kjøp en i <a href="/shop.html">butikken</a>.</p>
					{/each}
				</div>
			</div>
		</section>

		<section class="panel pm-surface">
			<h3 class="card-title">Bakgrunn</h3>
			<div class="active-preview" id="bgPreview">
				<div
					id="activeBgImg"
					class="active-bg-thumb"
					style:background-image={player.background ? `url('images/backgrounds/${player.background}.png')` : ''}
				></div>
				<span id="activeBgName" class="active-name">
					{player.background ? BG_NAMES[player.background] || player.background : 'Ingen valgt'}
				</span>
				<button class="pm-button small secondary" onclick={removeBg}>Fjern bakgrunn</button>
			</div>
			<button class="toggle" class:open={backgroundsOpen} aria-expanded={backgroundsOpen} onclick={() => (backgroundsOpen = !backgroundsOpen)}>
				<span>Dine bakgrunner <span class="count" id="ownedBgCount">{player.boughtBackgrounds.length}</span></span>
				<span class="chevron" aria-hidden="true">▾</span>
			</button>
			<div class="collapsible-body" class:collapsed={!backgroundsOpen} id="bgGrid">
				<div class="owned-grid" id="ownedBgGrid">
					{#each player.boughtBackgrounds as id, i (i)}
						<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
						<div
							class="owned-card bg-card"
							class:active-card={id === player.background}
							onclick={() => equipBg(id)}
							style:background-image="url('images/backgrounds/{id}.png')"
						>
							<span class="bg-label">{BG_NAMES[id] || id}</span>
							{#if id === player.background}<div class="active-badge">I bruk</div>{/if}
						</div>
					{:else}
						<p class="no-owned">Du eier ingen bakgrunner ennå. Kjøp en i <a href="/shop.html">butikken</a>.</p>
					{/each}
				</div>
			</div>
		</section>
	</div>

	<h2 class="pm-section-title">Annet</h2>
	<div class="looks">
		<section class="panel pm-surface">
			<h3 class="card-title">Innlogging</h3>
			{#if me.id}
				<p class="login-status">{me.name}</p>
				<p class="hint">
					{me.kind === 'kid' ? 'Logget inn med barnekode.' : `Logget inn med e-post (${me.email}).`}
					{cloud.savedAt ? `Lagret i skyen ${new Date(cloud.savedAt).toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' })}.` : ''}
				</p>
				<div class="login-actions">
					{#if me.teacher}<a class="pm-button small" href="/lærer/index.html">Til lærersiden</a>{/if}
					<button class="pm-button small secondary" onclick={logOut}>Logg ut</button>
				</div>
			{:else}
				<p class="hint">Ikke kontakt med serveren akkurat nå.</p>
			{/if}
		</section>
		{#if tiltShown}
			<section class="panel pm-surface">
				<h3 class="card-title">Glans på shiny</h3>
				<label class="switch-row" for="tiltSwitch">
					<span>Vipp for å få glansen til å bevege seg</span>
					<input type="checkbox" class="switch" id="tiltSwitch" bind:checked={tilt} onchange={switchTilt} />
				</label>
				<p class="hint">Glansen på shiny Pokémon følger nettbrettet når du vipper det. Av: den følger med når du scroller.</p>
			</section>
		{/if}
		<section class="panel pm-surface uuid-card">
			<h3 class="card-title">Spiller-ID</h3>
			<div class="uuid-row">
				<code id="uuidDisplay" class="uuid-code">{uuid}</code>
				<button class="pm-button small secondary" onclick={copyUUID}>Kopier</button>
			</div>
			<p class="hint">Din unike spiller-ID. Ikke del den med noen du ikke stoler på.</p>
		</section>
	</div>
</div>

<style>
	.hero {
		display: flex;
		align-items: center;
		gap: 20px;
		padding: 20px;
	}
	.hero-avatar {
		flex-shrink: 0;
		width: 104px;
		height: 104px;
		object-fit: contain;
		border-radius: 50%;
		background: var(--pm-cream);
		box-shadow: 0 0 0 4px var(--pm-paper), 0 0 0 6px var(--pm-line);
	}
	.hero-body {
		flex: 1;
		min-width: 0;
	}
	.field-label {
		display: block;
		margin-bottom: 6px;
		font-weight: 700;
	}
	.username-row {
		display: flex;
		gap: 10px;
	}
	.username-input {
		flex: 1;
		min-width: 0;
		height: 48px;
		padding: 0 14px;
		border: 2px solid var(--pm-line);
		border-radius: 12px;
		background: var(--pm-cream);
		color: var(--pm-ink);
		font: inherit;
		font-family: var(--pm-display);
		font-size: 20px;
		outline: none;
	}
	.username-input:focus {
		border-color: var(--pm-ink);
	}
	.hint {
		margin: 8px 0 0;
		color: var(--pm-ink-soft);
		font-size: 14px;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 10px;
		margin-bottom: 14px;
	}
	.stat-item {
		padding: 14px 12px;
		text-align: center;
	}
	.stat-value {
		font-family: var(--pm-display);
		font-size: 28px;
		line-height: 1.1;
	}
	.stat-value.pm-price {
		font-size: 28px;
	}
	.stat-label {
		margin-top: 2px;
		color: var(--pm-ink-soft);
		font-size: 14px;
	}

	.panel {
		padding: 16px 18px;
	}
	.card-title {
		margin: 0 0 12px;
		font-family: var(--pm-display);
		font-weight: 400;
		font-size: 20px;
	}
	.looks {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 14px;
		align-items: start;
	}

	.profile-pbar {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 6px 0;
	}
	.profile-pbar-label {
		flex-shrink: 0;
		width: 110px;
		font-size: 14px;
		font-weight: 700;
	}
	.profile-pbar-track {
		flex: 1;
		height: 10px;
		overflow: hidden;
		border-radius: 999px;
		background: var(--pm-cream);
		box-shadow: inset 0 0 0 1px var(--pm-line);
	}
	.profile-pbar-fill {
		height: 100%;
		border-radius: 999px;
	}
	.profile-pbar-text {
		flex-shrink: 0;
		width: 96px;
		color: var(--pm-ink-soft);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.active-preview {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px;
		border-radius: 14px;
		background: var(--pm-cream);
	}
	.active-icon-img {
		width: 64px;
		height: 64px;
		object-fit: contain;
	}
	.active-bg-thumb {
		width: 96px;
		height: 60px;
		border-radius: 10px;
		background: var(--pm-line) center / cover;
	}
	.active-name {
		flex: 1;
		min-width: 0;
		font-family: var(--pm-display);
		font-size: 18px;
	}
	.toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		min-height: 44px;
		margin-top: 10px;
		padding: 0 4px;
		border: none;
		background: none;
		color: var(--pm-ink);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}
	.count {
		margin-left: 6px;
		padding: 1px 9px;
		border-radius: 999px;
		background: var(--pm-cream);
		box-shadow: inset 0 0 0 1px var(--pm-line);
	}
	.chevron {
		transition: transform 200ms ease-out;
	}
	.toggle.open .chevron {
		transform: rotate(180deg);
	}
	.collapsible-body.collapsed {
		display: none;
	}
	.owned-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
		gap: 8px;
		padding-top: 6px;
	}
	.owned-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 8px 6px;
		border-radius: 12px;
		background: var(--pm-cream);
		box-shadow: inset 0 0 0 1px var(--pm-line);
		font-size: 13px;
		font-weight: 700;
		text-align: center;
		cursor: pointer;
	}
	.owned-card img {
		width: 64px;
		height: 64px;
		object-fit: contain;
	}
	.owned-card.active-card {
		box-shadow: inset 0 0 0 3px var(--pm-green);
	}
	.bg-card {
		justify-content: flex-end;
		min-height: 80px;
		background-size: cover;
		background-position: center;
	}
	.bg-label {
		padding: 1px 8px;
		border-radius: 999px;
		background: oklch(0.995 0.004 85 / 0.9);
	}
	.active-badge {
		position: absolute;
		top: 4px;
		right: 4px;
		padding: 1px 7px;
		border-radius: 999px;
		background: var(--pm-green-deep);
		color: var(--pm-paper);
		font-size: 11px;
	}
	.no-owned {
		grid-column: 1 / -1;
		margin: 4px 0;
		color: var(--pm-ink-soft);
	}
	.no-owned a {
		color: var(--pm-red-deep);
	}

	.login-status {
		margin: 0;
		font-weight: 700;
	}
	.login-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 12px;
	}
	.switch-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		font-weight: 600;
		cursor: pointer;
	}
	/* An on/off switch drawn on the checkbox itself, as in the customizer. */
	.switch {
		appearance: none;
		-webkit-appearance: none;
		position: relative;
		flex-shrink: 0;
		width: 56px;
		height: 32px;
		margin: 0;
		border-radius: 999px;
		background: var(--pm-line);
		cursor: pointer;
		transition: background 150ms ease-out;
	}
	.switch::after {
		content: '';
		position: absolute;
		top: 3px;
		left: 3px;
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: var(--pm-paper);
		box-shadow: 0 1px 3px oklch(0.3 0.03 265 / 0.3);
		transition: transform 150ms ease-out;
	}
	.switch:checked {
		background: var(--pm-green-deep);
	}
	.switch:checked::after {
		transform: translateX(24px);
	}
	.switch:focus-visible {
		outline: 3px solid var(--pm-ink);
		outline-offset: 2px;
	}

	.uuid-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.uuid-code {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		padding: 10px 12px;
		border-radius: 10px;
		background: var(--pm-cream);
		font-size: 13px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (max-width: 480px) {
		.hero {
			flex-direction: column;
			text-align: center;
		}
		.hero-body {
			width: 100%;
			text-align: left;
		}
		.stats-grid {
			grid-template-columns: repeat(2, 1fr);
		}
		/* minmax(0, …): the player id never shrinks, and would otherwise widen the column. */
		.looks {
			grid-template-columns: minmax(0, 1fr);
		}
		.active-preview {
			flex-wrap: wrap;
		}
		.profile-pbar-label {
			width: 84px;
		}
		.profile-pbar-text {
			width: 76px;
		}
	}
	@media (pointer: coarse) {
		.pm-button.small {
			min-height: 44px;
		}
	}
</style>
