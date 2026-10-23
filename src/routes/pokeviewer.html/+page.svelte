<script>
	// One Pokémon in detail, with its evolutions and alternate forms. Ported from
	// static/pokeviewer.html and pokeviewer.js. Pokémon you have not caught are shown as a shadow.
	import { afterNavigate, replaceState } from '$app/navigation';
	import { player } from '#lib/player.svelte.js';
	import { loadPokemonInfo, pokemonInfo } from '#lib/game/pokemon.js';
	import PokemonDetail from '#lib/PokemonDetail.svelte';

	// Stepping wraps at the highest number in the data (live pokeviewer.js, 2026-10; it was 1010).
	let MAX_ID = $state(1025);
	const MIN_ID = 0;

	/** @type {import('#lib/game/pokemon.js').PokemonInfo | null} */
	let info = $state.raw(null);
	let currentId = $state(1);
	let shiny = $state(false);
	/** An alternate form's key from the link, as in "89-1"; cleared when moving to another Pokémon. */
	let form = $state('');
	let searchText = $state('');

	const folder = $derived(shiny ? 'shiny' : 'normal');
	/** @param {string | number} id */
	const owned = (id) => player.pkmnList.includes(`${shiny ? 'S' : 'N'}${id}`);

	// Back to where the viewer was opened from, the Pokédex or the game, through history so the
	// Pokédex's filters and scroll come back too. Opened straight from a link, it leads to the
	// Pokédex.
	/** @type {string | null} */
	let cameFrom = $state(null);
	afterNavigate(({ from }) => {
		cameFrom = from?.url.pathname ?? null;
	});
	const backLabel = $derived(cameFrom === '/pokemath.html' ? 'Spillet' : 'Pokédex');
	const prevId = $derived(currentId > MIN_ID ? currentId - 1 : MAX_ID);
	const nextId = $derived(currentId < MAX_ID ? currentId + 1 : MIN_ID);

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

	/**
	 * An evolution or another form tapped in the detail: show it here, and keep the address in step.
	 * @param {number} id
	 * @param {string} [nextForm] an alternate form's key, or none for the base form
	 */
	function pickPokemon(id, nextForm = '') {
		form = nextForm;
		searchPokemon(id);
		replaceState(`?pokemonId=${id}${form ? `&form=${form}` : ''}${shiny ? '&shiny=1' : ''}`, {});
	}

	/** @param {'prev' | 'next'} direction */
	function step(direction) {
		form = '';
		const id = direction === 'next' ? nextId : prevId;
		searchPokemon(id);
	}

	let started = false;
	$effect(() => {
		if (!player.loaded || started) return;
		started = true;
		loadPokemonInfo().then(() => {
			info = pokemonInfo();
			const ids = Object.keys(info ?? {})
				.map(Number)
				.filter((n) => n > 0 && n <= 99999);
			if (ids.length) MAX_ID = Math.max(...ids);
			const params = new URLSearchParams(location.search);
			shiny = params.get('shiny') === '1';
			form = params.get('form') ?? '';
			const id = params.get('pokemonId');
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
</svelte:head>

<div class="main pm-page viewer">
	<a
		class="to-dex"
		href="/dex.html"
		onclick={(e) => {
			if (!cameFrom || cameFrom === '/pokeviewer.html') return;
			e.preventDefault();
			history.back();
		}}>‹ {backLabel}</a
	>
	<div id="navbar">
		<button id="prevButton" class="nav-step" onclick={() => step('prev')} aria-label="Forrige Pokémon">
			<span class="arrow" aria-hidden="true">‹</span>
			<span
				class="button-bg"
				id="prevButtonBG"
				style:filter={info ? (owned(prevId) ? 'brightness(100%)' : 'brightness(0%)') : null}
				style:background-image={info ? `url(images/pokemon/${folder}/${prevId}.webp)` : null}
			></span>
		</button>
		<form class="search" onsubmit={(e) => { e.preventDefault(); form = ''; searchPokemon(); }}>
			<input type="text" id="searchBar" placeholder="Navn eller nummer" aria-label="Søk etter Pokémon" bind:value={searchText} />
			<button id="searchButton" class="pm-button small" type="submit">Søk</button>
		</form>
		<label class="shiny-toggle" for="shinycheck">
			<span>✨ Shiny</span>
			<input type="checkbox" class="switch" id="shinycheck" name="shiny" bind:checked={shiny} />
		</label>
		<button id="nextButton" class="nav-step" onclick={() => step('next')} aria-label="Neste Pokémon">
			<span
				class="button-bg"
				id="nextButtonBG"
				style:filter={info ? (owned(nextId) ? 'brightness(100%)' : 'brightness(0%)') : null}
				style:background-image={info ? `url(images/pokemon/${folder}/${nextId}.webp)` : null}
			></span>
			<span class="arrow" aria-hidden="true">›</span>
		</button>
	</div>


	{#if info}
		<PokemonDetail {info} id={currentId} {form} {shiny} onpick={pickPokemon} />
	{/if}
</div>

<style>
	.to-dex {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		margin-bottom: 4px;
		color: var(--pm-ink);
		font-family: var(--pm-display);
		font-size: 18px;
		text-decoration: none;
	}
	#navbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		margin-bottom: 16px;
	}
	.nav-step {
		display: flex;
		align-items: center;
		gap: 2px;
		height: 56px;
		padding: 0 8px;
		border: none;
		border-radius: 16px;
		background: var(--pm-paper);
		box-shadow: var(--pm-shadow), 0 0 0 1px var(--pm-line);
		color: var(--pm-ink);
		cursor: pointer;
	}
	#nextButton {
		margin-left: auto;
	}
	.arrow {
		font-size: 30px;
		line-height: 1;
	}
	.button-bg {
		width: 44px;
		height: 44px;
		background: center / contain no-repeat;
	}
	.search {
		display: flex;
		flex: 1 1 260px;
		gap: 8px;
	}
	#searchBar {
		flex: 1;
		min-width: 0;
		height: 44px;
		padding: 0 14px;
		border: 2px solid var(--pm-line);
		border-radius: 12px;
		background: var(--pm-paper);
		color: var(--pm-ink);
		font: inherit;
		font-size: 16px;
		outline: none;
	}
	#searchBar:focus {
		border-color: var(--pm-ink);
	}
	.shiny-toggle {
		display: flex;
		min-height: 44px;
		align-items: center;
		gap: 8px;
		font-weight: 700;
		cursor: pointer;
	}
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
		background: var(--pm-gold);
	}
	.switch:checked::after {
		transform: translateX(24px);
	}

	@media (max-width: 640px) {
		#navbar {
			display: grid;
			grid-template-columns: auto 1fr auto;
			grid-template-areas: 'prev shiny next' 'search search search';
		}
		#prevButton { grid-area: prev; }
		#nextButton { grid-area: next; margin-left: 0; }
		.shiny-toggle { grid-area: shiny; justify-self: center; }
		.search { grid-area: search; }
	}
</style>
