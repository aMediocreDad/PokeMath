<script>
	import { onMount } from 'svelte';
	import { player } from '#lib/player.svelte.js';
	import { toast } from '#lib/toast.svelte.js';
	import { ICON_MAP, BG_NAMES } from '#lib/data/cosmetics.js';

	const P = 'images/playericons/';

	let usernameInput = $state('');
	let uuid = $state('Laster…');
	let iconsOpen = $state(false);
	let backgroundsOpen = $state(false);

	// Fill the form once, when the save has loaded (initProfile() in the legacy page).
	let initialised = false;
	$effect(() => {
		if (!player.loaded || initialised) return;
		initialised = true;
		usernameInput = player.username || '';
	});
	onMount(() => (uuid = localStorage.getItem('UUID') || '–'));

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
		const totalBase = 1025;
		return [
			{ label: 'Normal (base)', count: baseN.size, total: totalBase, color: '#4a90d9' },
			{ label: 'Shiny (base)', count: baseS.size, total: totalBase, color: '#d4a017' },
			{ label: 'Alt form', count: altN.size, total: null, color: '#9b59b6' },
			{ label: 'Alt shiny', count: altS.size, total: null, color: '#e91e96' },
			{
				label: 'Total unike',
				count: baseN.size + baseS.size + altN.size + altS.size,
				total: totalBase * 2,
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

	function copyUUID() {
		navigator.clipboard.writeText(uuid).then(() => toast('UUID kopiert!'));
	}
</script>

<svelte:head>
	<title>Pokémath - Min profil</title>
	<meta name="robots" content="noindex, nofollow" />
	<link rel="stylesheet" href="/menustyle.css?v=100" />
	<link rel="stylesheet" href="/player_profile.css?v=1" />
</svelte:head>

<div class="main profile-page">
	<h1 class="profile-title">Min profil</h1>

	<section class="profile-card">
		<h2>Brukernavn</h2>
		<div class="username-row">
			<input
				id="usernameInput"
				class="username-input"
				type="text"
				maxlength="22"
				placeholder="Ditt brukernavn"
				bind:value={usernameInput}
			/>
			<button class="button-1" onclick={saveUsername}>Lagre</button>
		</div>
		<p class="hint">Brukernavnet vises i butikk, rangliste og toppmeny.</p>
	</section>

	<section class="profile-card">
		<h2>Aktiv figur</h2>
		<div class="active-preview" id="iconPreview">
			<img id="activeIconImg" src={activeIcon.img} alt="Figur" class="active-icon-img" />
			<span id="activeIconName" class="active-name">{activeIcon.name}</span>
		</div>
		<button class="button-1 remove-btn" onclick={removeIcon}>Fjern figur</button>
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
		<h3
			class="owned-label collapsible-header"
			class:collapsed={!iconsOpen}
			onclick={() => (iconsOpen = !iconsOpen)}
		>
			Dine figurer (<span id="ownedIconCount">{ownedIcons.length}</span>)
		</h3>
		<div class="collapsible-body" class:collapsed={!iconsOpen} id="iconGrid">
			<div class="owned-grid" id="ownedIconGrid">
				{#each ownedIcons as id (id)}
					{@const icon = iconFor(id)}
					<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
					<div
						class="owned-card"
						class:active-card={id === player.playerIcon}
						onclick={() => equipIcon(id, icon.img)}
					>
						<img src={icon.img} alt={icon.name} loading="lazy" />
						<span>{icon.name}</span>
						{#if id === player.playerIcon}<div class="active-badge">I bruk</div>{/if}
					</div>
				{:else}
					<p class="no-owned">Du eier ingen figurer ennå.</p>
				{/each}
			</div>
		</div>
	</section>

	<section class="profile-card">
		<h2>Aktiv bakgrunn</h2>
		<div class="active-preview" id="bgPreview">
			<div
				id="activeBgImg"
				class="active-bg-thumb"
				style:background-image={player.background ? `url('images/backgrounds/${player.background}.png')` : ''}
			></div>
			<span id="activeBgName" class="active-name">
				{player.background ? BG_NAMES[player.background] || player.background : 'Ingen valgt'}
			</span>
		</div>
		<button class="button-1 remove-btn" onclick={removeBg}>Fjern bakgrunn</button>
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
		<h3
			class="owned-label collapsible-header"
			class:collapsed={!backgroundsOpen}
			onclick={() => (backgroundsOpen = !backgroundsOpen)}
		>
			Dine bakgrunner (<span id="ownedBgCount">{player.boughtBackgrounds.length}</span>)
		</h3>
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
					<p class="no-owned">Du eier ingen bakgrunner ennå.</p>
				{/each}
			</div>
		</div>
	</section>

	<section class="profile-card">
		<h2>Statistikk</h2>
		<div class="stats-grid">
			<div class="stat-item">
				<div class="stat-value" id="statCoins">{player.loaded ? format(player.money) : '–'}</div>
				<div class="stat-label">Mynter</div>
			</div>
			<div class="stat-item">
				<div class="stat-value" id="statCaught">{player.loaded ? format(player.caught) : '–'}</div>
				<div class="stat-label">Pokémon fanget</div>
			</div>
			{#each player.tiersSolved as solved, i (i)}
				<div class="stat-item">
					<div class="stat-value" id="statT{i + 1}">{player.loaded ? format(solved) : '–'}</div>
					<div class="stat-label">Oppgaver (Nivå {i + 1})</div>
				</div>
			{/each}
			<div class="stat-item">
				<div class="stat-value" id="statCustom">{player.loaded ? format(player.customSolved) : '–'}</div>
				<div class="stat-label">Egne oppgaver</div>
			</div>
		</div>

		<div class="profile-pbar-section">
			<div class="profile-pbar-section-title">Pokédex fremdrift</div>
			<div id="profileProgressBars">
				{#each progressBars as bar (bar.label)}
					<div class="profile-pbar">
						<span class="profile-pbar-label">{bar.label}</span>
						<div class="profile-pbar-track">
							<div
								class="profile-pbar-fill"
								style:width="{bar.percent.toFixed(1)}%"
								style:background={bar.color}
							></div>
						</div>
						<span class="profile-pbar-text">{bar.text}</span>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<section class="profile-card">
		<h2>Lærer</h2>
		<div class="teacher-placeholder">
			<div class="teacher-status">Ikke tilkoblet</div>
			<p class="hint">Under arbeid – lærerkobling kommer senere.</p>
		</div>
	</section>

	<section class="profile-card uuid-card">
		<h2>Spiller-ID</h2>
		<div class="uuid-row">
			<code id="uuidDisplay" class="uuid-code">{uuid}</code>
			<button class="button-1 copy-btn" onclick={copyUUID}>Kopier</button>
		</div>
		<p class="hint">Dette er din unike spiller-ID. Del den aldri med noen du ikke stoler på.</p>
	</section>

	<div style="height:60px"></div>
</div>
