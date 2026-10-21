<script>
	// One Pokémon in detail, with its evolutions and alternate forms. Ported from
	// static/pokeviewer.html and pokeviewer.js. Pokémon you have not caught are shown as a shadow.
	import { player } from '#lib/player.svelte.js';
	import { loadPokemonInfo, pokemonInfo } from '#lib/game/pokemon.js';

	// The legacy page stops at 1010, though the data goes to 1025; those are found by name.
	const MAX_ID = 1010;
	const MIN_ID = 0;

	/** @type {import('#lib/game/pokemon.js').PokemonInfo | null} */
	let info = $state.raw(null);
	let currentId = $state(1);
	let shiny = $state(false);
	let searchText = $state('');
	/** @type {HTMLElement | undefined} */
	let altWrapper = $state();
	/** @type {boolean | null} null until the first scroll, as on the legacy page */
	let altHeaderFixed = $state(null);

	const folder = $derived(shiny ? 'shiny' : 'normal');
	const shinyClass = $derived(shiny ? 'pokemon-shiny' : '');
	/** @param {string | number} id */
	const owned = (id) => player.pkmnList.includes(`${shiny ? 'S' : 'N'}${id}`);
	/** @param {any} types */
	const typeList = (types) => (Array.isArray(types) ? types : [types]);

	/** @type {any} The base form, with stats, description and names in other languages. */
	const pokemon = $derived(info?.[currentId]?.['0']);
	const unlocked = $derived(owned(currentId));
	const prevId = $derived(currentId > MIN_ID ? currentId - 1 : MAX_ID);
	const nextId = $derived(currentId < MAX_ID ? currentId + 1 : MIN_ID);

	const evoFromId = $derived(pokemon?.evo_from ?? null);
	/** @type {any} */
	const evoFrom = $derived(evoFromId ? info?.[evoFromId]?.['0'] : null);
	const evolvesTo = $derived(
		info ? Object.keys(info).filter((id) => info?.[id]?.['0']?.evo_from === currentId).map(Number) : []
	);
	const altForms = $derived(
		Object.entries(info?.[currentId] ?? {}).filter(([key, form]) => key !== '0' && form)
	);

	/**
	 * searchPokemon(): by number (0–1010) or by exact name.
	 * @param {string | number} [term]
	 */
	function searchPokemon(term) {
		if (!info) return;
		// As in the original, stepping to #0 leaves the search box as it was.
		if (term) searchText = String(term);
		const query = term !== undefined ? String(term) : searchText.trim().toLowerCase();
		const asNumber = Number(query);
		if (query !== '' && !isNaN(asNumber) && asNumber >= MIN_ID && asNumber <= MAX_ID) {
			if (info[query]?.['0']) currentId = parseInt(query);
			return;
		}
		for (const id in info) {
			if (info[id]['0']?.name?.toLowerCase() === query) {
				currentId = parseInt(id);
				return;
			}
		}
	}

	/** @param {'prev' | 'next'} direction */
	function step(direction) {
		const id = direction === 'next' ? nextId : prevId;
		searchPokemon(id);
	}

	// The "Alternative Former" header sticks to the bottom of the screen until the section is reached.
	function updateAltHeader() {
		if (!altWrapper) return;
		const header = /** @type {HTMLElement | null} */ (altWrapper.querySelector('.wrapper-header'));
		altHeaderFixed = altWrapper.getBoundingClientRect().top + (header?.offsetHeight ?? 0) > window.innerHeight;
	}

	let started = false;
	$effect(() => {
		if (!player.loaded || started) return;
		started = true;
		loadPokemonInfo().then(() => {
			info = pokemonInfo();
			const id = new URLSearchParams(location.search).get('pokemonId');
			if (id) {
				searchText = id;
				searchPokemon();
			} else {
				searchPokemon(1);
			}
		});
	});

</script>

<svelte:head>
	<title>PokéMath – Pokéviewer</title>
	<meta name="description" content="Se på dine Pokémon." />
	<meta name="robots" content="noindex, nofollow" />
	<link rel="stylesheet" href="/menustyle.css?v=100" />
	<link rel="stylesheet" href="/pokeviewer.css?v=101" />
	<link rel="stylesheet" href="/pokemon.css?v=101" />
</svelte:head>

<svelte:document onscroll={updateAltHeader} />

{#snippet smallPokemon(/** @type {string | number} */ id, /** @type {any} */ form, /** @type {boolean} */ isOwned, /** @type {string | number} */ imageId, style = '')}
	<div class="small-poke-container {shinyClass}" {style}>
		<img
			src="images/pokemon/{folder}/{imageId}.png"
			alt={form.name}
			class="poke-image"
			style="filter: {isOwned ? 'brightness(100%)' : 'brightness(0%)'}; pointer-events: none;"
		/>
		<p class="poke-name-box">{isOwned ? form.name : '???'} <span class="poke-id">#{id}</span></p>
		<p>{#each typeList(form.types) as type, i (i)}<span class="poke-types type-{type}">{type}</span>{/each}</p>
	</div>
{/snippet}

<div class="main">
	<div id="navbar">
		<button id="prevButton" class="navButton searchButton" onclick={() => step('prev')}>
			<div
				class="button-bg"
				id="prevButtonBG"
				style:filter={info ? (owned(prevId) ? 'brightness(100%)' : 'brightness(0%)') : null}
				style:background-image={info ? `url(images/pokemon/${folder}/${prevId}.png)` : null}
			>
				Forrige
			</div>
		</button>
		<div class="toggle-pill-color">
			<!-- svelte-ignore a11y_missing_attribute -->
			<a class="categoryname">Shiny</a>
			<input type="checkbox" id="shinycheck" name="shiny" bind:checked={shiny} />
			<label for="shinycheck"> </label>
		</div>
		<input
			type="text"
			id="searchBar"
			placeholder="Search by Name or ID"
			bind:value={searchText}
			onkeypress={(e) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					searchPokemon();
				}
			}}
		/>
		<button id="searchButton" class="searchButton" onclick={() => searchPokemon()}>Search</button>
		<button id="nextButton" class="navButton searchButton" onclick={() => step('next')}>
			<div
				class="button-bg"
				id="nextButtonBG"
				style:filter={info ? (owned(nextId) ? 'brightness(100%)' : 'brightness(0%)') : null}
				style:background-image={info ? `url(images/pokemon/${folder}/${nextId}.png)` : null}
			>
				Neste
			</div>
		</button>
	</div>

	<div id="pokemondata">
		<div id="poke-details">
			<div id="prev-evolution-wrapper" class="evolution-wrapper poke-container">
				{#if pokemon}
					<div class="prev-pokemon-container">
						<div class="evotitle">Utvikles fra:</div>
						{#if evoFrom}
							<a style="cursor: pointer;" href="./pokeviewer.html?pokemonId={evoFromId}" data-sveltekit-reload>
								{@render smallPokemon(evoFromId, evoFrom, owned(evoFromId), evoFromId)}
							</a>
						{:else}
							<div class="evotitle">Ingen</div>
						{/if}
					</div>
				{:else}
					<div class="evotitle">Utvikles fra:</div>
				{/if}
			</div>

			<div id="main-pokemon-wrapper" class="main-pokemon-wrapper poke-container">
				{#if pokemon}
					<!-- The legacy page sets the shiny background only on its first render, which is never shiny. -->
					<div class="main-pokemon-container">
						<img
							src="images/pokemon/{folder}/{currentId}.png"
							alt={pokemon.name}
							class="poke-image"
							style="filter: {unlocked ? 'brightness(100%)' : 'brightness(0%)'}; pointer-events: none;"
						/>
						<p class="poke-name-box">{unlocked ? pokemon.name : '???'} <span class="poke-id">#{currentId}</span></p>
						<p>{#each typeList(pokemon.types) as type, i (i)}<span class="poke-types type-{type}">{type}</span>{/each}</p>
						<p class="pokemon-details">
							<strong>Generasjon:</strong>
							{unlocked ? (pokemon.generation ? pokemon.generation[0].toUpperCase() + pokemon.generation.slice(1) : 'Unknown') : '???'}
							| <strong>Høyde:</strong>
							{unlocked ? (pokemon.height ? (pokemon.height / 10).toFixed(1) + 'm' : 'Unknown') : '???'}
							| <strong>Vekt:</strong>
							{unlocked ? (pokemon.weight ? (pokemon.weight / 10).toFixed(1) + 'kg' : 'Unknown') : '???'}
						</p>
						<div>
							<div class="poke-name-box" style="background-color: #ed9999;">
								Engelsk Pokedex Info:
								<p class="dexentry">{unlocked ? pokemon.description : '???'}</p>
							</div>
						</div>
						<div class="stats-container">
							<div class="evotitle">Stats:</div>
							{#if unlocked}
								{#each [['HP', pokemon.base_hp], ['Attack', pokemon.base_atk], ['Defense', pokemon.base_def], ['Sp. Attack', pokemon.base_satk], ['Sp. Defense', pokemon.base_sdef], ['Speed', pokemon.base_spd]] as [label, value] (label)}
									<div class="stat-item"><span class="stat-label">{label}</span><span class="stat-value">{value}</span></div>
								{/each}
							{:else}
								<div>???</div>
							{/if}
						</div>
						<div class="languages-container">
							<div class="evotitle">Navn på andre språk:</div>
							{#if unlocked}
								{#each [['JA', pokemon.name_ja], ['JA-R', pokemon.name_ja_romanji], ['DE', pokemon.name_de], ['FR', pokemon.name_fr]] as [code, name] (code)}
									<div class="language-item"><span class="language-code">{code}</span><span class="language-name">{name || 'N/A'}</span></div>
								{/each}
							{:else}
								<div>???</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>

			<div id="next-evolution-wrapper" class="evolution-wrapper poke-container">
				{#if pokemon}
					<div class="next-pokemon-container">
						{#if evolvesTo.length > 0}
							<div class="evotitle">Utvikles til ({evolvesTo.length}):</div>
							{#each evolvesTo as id (id)}
								{@const form = info?.[id]?.['0']}
								{#if form}
									<a style="cursor: pointer;" href="./pokeviewer.html?pokemonId={id}" data-sveltekit-reload>
										{@render smallPokemon(id, form, owned(id), id)}
									</a>
								{/if}
							{/each}
						{:else}
							<div class="evotitle">Utvikles til:</div>
							<div class="evotitle">Ukjent</div>
						{/if}
					</div>
				{:else}
					<div class="evotitle">Utvikles til:</div>
				{/if}
			</div>
		</div>

		<div
			id="alternate-forms-wrapper"
			class="alternate-forms-wrapper"
			bind:this={altWrapper}
			style:display={pokemon ? (altForms.length > 0 ? 'flex' : 'none') : null}
		>
			<div
				class="wrapper-header"
				style:position={altHeaderFixed === null ? null : altHeaderFixed ? 'fixed' : 'relative'}
				style:bottom={altHeaderFixed === null ? null : altHeaderFixed ? '0' : 'auto'}
			>
				Alternative Former:
			</div>
			{#each altForms as [key, form] (key)}
				{@render smallPokemon(`${currentId}-${key}`, form, owned(`${currentId}-${key}`), form.imageid, 'display: block;')}
			{/each}
		</div>
	</div>
</div>

<style>
	@media (pointer: coarse) {
		#searchButton,
		.navButton {
			min-height: 44px;
		}
		/* 16px or larger, or iOS zooms the page when the search field is focused. */
		#searchBar {
			font-size: 16px;
		}
	}
	/* Touch screens: an invisible margin around the on/off switches makes them 44px to tap,
	   without changing how they look. */
	@media (pointer: coarse) {
		.toggle-pill-color label {
			position: relative;
		}
		.toggle-pill-color label::after {
			content: '';
			position: absolute;
			inset: -10px -4px;
		}
	}
</style>
