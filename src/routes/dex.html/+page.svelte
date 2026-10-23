<script>
	// The Pokédex, ported from static/dex.html and dex.js: every caught Pokémon once, with
	// filters, search, sorting and progress. Filtering and search match against the same card HTML
	// the legacy page built, so results are identical. "Alle" shows every species instead, like the
	// Pokédex in the games, with the ones not caught yet as shadows; "Mangler" shows only those.
	// The list stays quiet: foil and auras show on the picked Pokémon, in the pane or the viewer.
	import { onMount, tick } from 'svelte';
	import { player } from '#lib/player.svelte.js';
	import { describe, legacyCardHtml, loadPokemonInfo, alternateFormCount, pokemonInfo } from '#lib/game/pokemon.js';
	import PokemonCard from '#lib/PokemonCard.svelte';
	import PokemonDetail from '#lib/PokemonDetail.svelte';

	const PAGE_SIZE = 60;
	const ALL_GENS = ['gen-1', 'gen-2', 'gen-3', 'gen-4', 'gen-5', 'gen-6', 'gen-7', 'gen-8', 'gen-9', 'gen-0'];
	const SPECIAL_FILTERS = [
		['Shiny', 'Shiny'], ['Legendarisk', 'Legendarisk'], ['Mytisk', 'Mytisk'], [' mega ', 'Mega'],
		['gigantamax', 'Gigantamax'], ['alolan', 'Alolan'], ['galarian', 'Galarian'], ['hisuian', 'Hisuian'], ['-E', 'Vår'],
		['-H', 'Halloween'], ['-C', 'Jul'], ['-U', 'Unik']
	];
	const TYPES = ['bug', 'dark', 'dragon', 'electric', 'fairy', 'fighting', 'fire', 'flying', 'ghost', 'grass', 'ground', 'ice', 'normal', 'poison', 'psychic', 'rock', 'steel', 'water'];
	const GENERATIONS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
	const SORTS = [
		['id-asc', 'ID (lav til høy)'], ['id-desc', 'ID (høy til lav)'], ['name-asc', 'Navn (A til Å)'],
		['name-desc', 'Navn (Å til A)'], ['count-desc', 'Antall (flest først)']
	];

	/** @typedef {{ entry: string, id: number, html: string, card: import('#lib/game/pokemon.js').PokemonCard, locked?: boolean, count?: number }} DexItem */

	/** @type {DexItem[] | null} null while loading */
	let all = $state(null);
	/** @type {DexItem[]} Every species once, for "Alle" and "Mangler". */
	let species = $state.raw([]);
	let altTotal = $state(0);
	/** @typedef {'mine' | 'missing' | 'all'} DexMode */
	/** 'mine' = the Pokémon caught, 'missing' = species not caught yet, 'all' = every species. */
	let mode = $state(/** @type {DexMode} */ ('mine'));
	/** @type {[DexMode, string, string][]} */
	const MODES = [['mine', 'Mine', 'dexModeMine'], ['missing', 'Mangler', 'dexModeMissing'], ['all', 'Alle', 'dexModeAll']];
	/** The filter chips that mean something with every species; the rest are hidden there. */
	const ALL_MODE_FILTERS = new Set(['Legendarisk', 'Mytisk']);

	let genFilter = $state([...ALL_GENS]);
	/** @type {string[]} */
	let typeFilter = $state([]);
	/** @type {Record<string, 1 | 2>} 1 = only these, 2 = hide these */
	let specialFilter = $state({});
	/** 0 = all, 1 = only duplicates, 2 = no duplicates */
	let duplicates = $state(0);
	let sort = $state('id-asc');
	let search = $state('');

	/** @type {'filter' | 'sort' | null} */
	let openPanel = $state(null);
	let visibleCount = $state(PAGE_SIZE);

	/** @param {string} entry */
	const countOf = (entry) => player.pkmnList.filter((e) => e === entry).length;

	/** @param {DexMode} next */
	function setMode(next) {
		mode = next;
		localStorage.setItem('dexMode', next);
	}

	// Split view on an iPad, held either way, and wider: the list on the left, the picked Pokémon
	// in detail on the right, like the Pokédex in the games. Narrower, a card opens the viewer.
	const SPLIT_QUERY = '(min-width: 760px)';
	let split = $state(false);
	/** @type {{ id: number, shiny: boolean } | null} The Pokémon picked for the pane. */
	let picked = $state(null);
	/** pokemon_info.json, there once the list is built. */
	const info = $derived(all ? pokemonInfo() : null);
	/** The filter bar's height, so the pane sits under it. */
	let filterHeight = $state(0);
	/** @type {HTMLElement | undefined} */
	let pane = $state();
	// A newly picked Pokémon starts at the top of the pane, not where the last one was scrolled to.
	$effect(() => {
		void shown?.id;
		void shown?.shiny;
		if (pane) pane.scrollTop = 0;
	});

	onMount(() => {
		const wide = matchMedia(SPLIT_QUERY);
		split = wide.matches;
		const change = () => (split = wide.matches);
		wide.addEventListener('change', change);
		return () => wide.removeEventListener('change', change);
	});

	// Build the list once both the save and pokemon_info.json are there (_tryInitDex()).
	let started = false;
	$effect(() => {
		if (!player.loaded || started) return;
		started = true;
		loadPokemonInfo().then(() => {
			altTotal = alternateFormCount();
			const mine = [...new Set(player.pkmnList)]
				.map((entry) => {
					const card = describe(entry);
					return { entry: card.entry, id: card.id, card, html: legacyCardHtml(card, countOf(card.entry)) };
				})
				.sort((a, b) => a.id - b.id);
			/** @type {Map<number, number>} How many of each species, all forms and shinies counted. */
			const perSpecies = new Map();
			for (const item of mine) perSpecies.set(item.id, (perSpecies.get(item.id) ?? 0) + countOf(item.entry));
			// A species caught only as a shiny shows the shiny.
			const shinyOnly = (/** @type {number} */ id) => !player.pkmnList.includes(`N${id}`) && player.pkmnList.includes(`S${id}`);
			species = Object.keys(pokemonInfo() ?? {})
				.map(Number)
				.filter((id) => id >= 0 && id <= 1025)
				.sort((a, b) => a - b)
				.map((id) => {
					const card = describe(`${shinyOnly(id) ? 'S' : 'N'}${id}`);
					const count = perSpecies.get(id) ?? 0;
					return { entry: `dex-${id}`, id, card, html: legacyCardHtml(card, count), locked: count === 0, count };
				});
			const storedMode = localStorage.getItem('dexMode');
			mode = storedMode === 'all' || storedMode === 'mine' || storedMode === 'missing' ? storedMode : mine.length ? 'mine' : 'all';
			all = mine;
		});
	});

	const filtered = $derived.by(() => {
		if (!all) return [];
		const everySpecies = mode !== 'mine';
		let items = (everySpecies ? species : all).filter(({ html, locked }) => {
			if (mode === 'missing' && !locked) return false;
			if (genFilter.length > 0 && !genFilter.some((k) => html.includes(k))) return false;
			if (typeFilter.length > 0 && !typeFilter.every((k) => html.includes(k))) return false;
			for (const [key, state] of Object.entries(specialFilter)) {
				if (everySpecies && !ALL_MODE_FILTERS.has(key)) continue;
				if (state === 1 && !html.includes(key)) return false;
				if (state === 2 && html.includes(key)) return false;
			}
			return true;
		});
		if (!everySpecies && duplicates) {
			items = items.filter(({ entry }) => (duplicates === 1 ? countOf(entry) > 1 : countOf(entry) <= 1));
		}
		const q = search.trim().toUpperCase();
		if (q) items = items.filter(({ html }) => html.toUpperCase().includes(q));
		if (sort === 'name-asc' || sort === 'name-desc') {
			const direction = sort === 'name-asc' ? 1 : -1;
			items = [...items].sort((a, b) => direction * a.card.name.toLowerCase().localeCompare(b.card.name.toLowerCase(), 'no'));
		}
		if (sort === 'id-desc') items = [...items].sort((a, b) => b.id - a.id);
		if (sort === 'count-desc') items = [...items].sort((a, b) => (b.count ?? countOf(b.entry)) - (a.count ?? countOf(a.entry)));
		return items;
	});

	// The pane shows the picked Pokémon, or the first in the list until one is picked.
	const shown = $derived(
		picked ?? (filtered[0] ? { id: filtered[0].id, shiny: filtered[0].card.shiny && !filtered[0].locked } : null)
	);

	// Show the first page again whenever the results change.
	$effect(() => {
		void filtered;
		visibleCount = PAGE_SIZE;
	});

	const progress = $derived.by(() => {
		let baseN = 0, baseS = 0, altN = 0, altS = 0;
		for (const entry of new Set(player.pkmnList)) {
			const shiny = entry[0] === 'S';
			const rest = entry.slice(1);
			if (rest.includes('-')) {
				if (shiny) altS++;
				else altN++;
			} else {
				const dex = parseInt(rest);
				if (!isNaN(dex) && dex >= 0 && dex <= 1025) {
					if (shiny) baseS++;
					else baseN++;
				}
			}
		}
		return [
			{ label: 'Normal', caught: baseN, total: 1026, color: '#2cbb63' },
			{ label: 'Shiny', caught: baseS, total: 1026, color: '#e8c030' },
			{ label: 'Alt. form', caught: altN, total: altTotal, color: '#3a8fff' },
			{ label: 'Alt. shiny', caught: altS, total: altTotal, color: '#e67e22' },
			{ label: 'Totalt', caught: baseN + baseS + altN + altS, total: 1026 * 2 + altTotal * 2, color: '#cc1a1a' }
		].map((bar) => ({ ...bar, percent: bar.total > 0 ? Math.min(100, (bar.caught / bar.total) * 100) : 0 }));
	});

	/** How many filters are on, for the Filter button. Only those that apply in this mode count. */
	const activeFilters = $derived(
		typeFilter.length +
			Object.keys(specialFilter).filter((key) => mode === 'mine' || ALL_MODE_FILTERS.has(key)).length +
			(mode === 'mine' && duplicates ? 1 : 0) +
			(genFilter.length < ALL_GENS.length ? 1 : 0)
	);
	const caughtSpecies = $derived(species.filter((s) => !s.locked).length);

	function showAll() {
		genFilter = [...ALL_GENS];
		typeFilter = [];
		specialFilter = {};
		duplicates = 0;
	}

	// Coming back from the viewer brings back the filters and where the list was scrolled to.
	/** @type {import('./$types').Snapshot<any>} */
	export const snapshot = {
		capture: () => ({ mode, genFilter, typeFilter, specialFilter, duplicates, sort, search, picked, visibleCount, scrollY: window.scrollY }),
		restore: (saved) => {
			({ mode, genFilter, typeFilter, specialFilter, duplicates, sort, search, picked } = saved);
			restoreScroll = saved;
		}
	};
	/** @type {{ visibleCount: number, scrollY: number } | null} Set by restore, which can come before or after the list is built. */
	let restoreScroll = $state.raw(null);
	$effect(() => {
		if (!all || !restoreScroll) return;
		const { visibleCount: count, scrollY } = restoreScroll;
		restoreScroll = null;
		visibleCount = count;
		tick().then(() => window.scrollTo(0, scrollY));
	});

	/** @param {string} key */
	function cycleSpecial(key) {
		const next = ((specialFilter[key] || 0) + 1) % 3;
		const { [key]: _, ...rest } = specialFilter;
		specialFilter = next === 0 ? rest : { ...rest, [key]: /** @type {1 | 2} */ (next) };
	}

	/** @param {string} type */
	function toggleType(type) {
		typeFilter = typeFilter.includes(type) ? typeFilter.filter((t) => t !== type) : [...typeFilter, type];
	}

	/**
	 * @param {string} gen
	 * @param {boolean} checked
	 */
	function toggleGen(gen, checked) {
		genFilter = checked ? (genFilter.includes(gen) ? genFilter : [...genFilter, gen]) : genFilter.filter((g) => g !== gen);
		// Never let every generation be switched off.
		if (genFilter.filter((g) => g !== 'gen-0').length === 0) genFilter = [...ALL_GENS];
	}

	/** @param {'filter' | 'sort'} panel */
	function togglePanel(panel) {
		if (openPanel === panel) {
			openPanel = null;
			return;
		}
		openPanel = panel;
	}

	/** @param {MouseEvent} event */
	function closePanels(event) {
		const target = /** @type {HTMLElement} */ (event.target);
		if (target.closest('#filterBtn, #sortDropdownBtn, .dex-dropdown-panel')) return;
		openPanel = null;
	}

	/** Load the next 60 cards when the end of the list scrolls into view. @param {HTMLElement} node */
	function loadMore(node) {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) visibleCount += PAGE_SIZE;
			},
			{ rootMargin: '400px' }
		);
		observer.observe(node);
		return { destroy: () => observer.disconnect() };
	}
</script>

<svelte:head>
	<title>PokéMath – Pokédex</title>
	<meta name="description" content="Pokédexen til PokéMath – se alle pokémonene dine." />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<svelte:document onclick={closePanels} />

<div class="main dex">
	<!-- One row: which Pokémon, search, Filter and Sorter. Everything else lives in the panels. On
	     phones the search takes its own row. -->
	<div id="filterButtons" bind:offsetHeight={filterHeight}>
		<div class="mode" role="group" aria-label="Vis">
			{#each MODES as [key, label, id] (key)}
				<button {id} aria-pressed={mode === key} onclick={() => setMode(key)}>{label}</button>
			{/each}
		</div>
		<input type="search" placeholder="Søk etter navn, nummer eller type" aria-label="Søk" id="searchInput" bind:value={search} />
		<div class="dropdowns">
			<button class="altbtn" id="filterBtn" class:active={openPanel === 'filter'} class:on={activeFilters > 0} onclick={() => togglePanel('filter')}
				>Filter{#if activeFilters > 0}<span class="filter-count">{activeFilters}</span>{/if} <span class="caret">▾</span></button
			>
			<button class="altbtn" id="sortDropdownBtn" class:active={openPanel === 'sort'} onclick={() => togglePanel('sort')}
				>Sorter <span class="caret">▾</span></button
			>
		</div>
		<!-- The panels open under the bar and move with it. -->
	<div
		class="dex-dropdown-panel"
		id="filterContent"
		style:display={openPanel === 'filter' ? 'block' : 'none'}
	>
		<div class="panel-head">
			<h2>Filter</h2>
			<span class="panel-actions">
				<button class="btn" data-filter="all" disabled={activeFilters === 0} onclick={showAll}>Nullstill</button>
				<button class="btn done" onclick={() => (openPanel = null)}>Ferdig</button>
			</span>
		</div>
		<p class="panel-hint">Trykk én gang for bare disse, to ganger for å skjule dem.</p>
		<div class="chips">
			{#each SPECIAL_FILTERS.filter(([key]) => mode === 'mine' || ALL_MODE_FILTERS.has(key)) as [key, label] (key)}
				<button
					class="btn"
					class:filter-include={specialFilter[key] === 1}
					class:filter-exclude={specialFilter[key] === 2}
					data-filter={key}
					onclick={() => cycleSpecial(key)}>{label}</button
				>
			{/each}
			{#if mode === 'mine'}
				<button
					class="btn"
					id="duplicatesBtn"
					class:filter-include={duplicates === 1}
					class:filter-exclude={duplicates === 2}
					onclick={() => (duplicates = (duplicates + 1) % 3)}>Dobler</button
				>
			{/if}
		</div>
		<h3>Typer</h3>
		<div id="typecontent">
			{#each TYPES as type (type)}
				<button
					class="typecard2 type-{type} t-{type}"
					class:active={typeFilter.includes(type)}
					aria-pressed={typeFilter.includes(type)}
					data-filter={type}
					onclick={() => toggleType(type)}>{type[0].toUpperCase() + type.slice(1)}</button
				>
			{/each}
		</div>
		<h3>Generasjon</h3>
		<div id="generationContent">
			{#each GENERATIONS as roman, i (roman)}
				<label
					><input
						type="checkbox"
						class="genCheckbox"
						value="gen-{i + 1}"
						checked={genFilter.includes(`gen-${i + 1}`)}
						onchange={(e) => toggleGen(`gen-${i + 1}`, e.currentTarget.checked)}
					/> {roman}</label
				>
			{/each}
		</div>
	</div>

	<div
		class="dex-dropdown-panel"
		id="sortContent"
		style:display={openPanel === 'sort' ? 'block' : 'none'}
	>
		{#each SORTS as [key, label] (key)}
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions, a11y_missing_attribute -->
			<a
				data-sort={key}
				class:active={sort === key}
				onclick={() => {
					sort = key;
					openPanel = null;
				}}>{label}</a
			>
		{/each}
	</div>
	</div>

	<div class="dex-body" class:split>
		<div class="dex-list">
			{#if all}
				<section class="dex-progress" aria-label="Fremgang">
					<p class="dex-counts">
						<span><b id="amountCaught">{player.caught}</b> fanget</span>
						<span><b id="speciesCaught">{caughtSpecies} / {species.length}</b> arter</span>
						<span class="showing"><b id="amountCaught3">{filtered.length}</b> vises</span>
					</p>
					<div class="meters">
						{#each progress as bar (bar.label)}
							<div class="meter">
								<span class="meter-label">{bar.label}</span>
								<span class="meter-track" aria-hidden="true"><span style:width="{bar.percent.toFixed(2)}%" style:background={bar.color}></span></span>
								<span class="meter-text">{bar.caught.toLocaleString('no-NO')} / {bar.total.toLocaleString('no-NO')}</span>
							</div>
						{/each}
					</div>
				</section>
			{/if}
			<div id="pokedex">
				{#if !all}
					{#if player.loaded}
						{#each { length: 20 }, i (i)}<div class="skeleton"></div>{/each}
					{:else}
						Laster...<br /><br />
					{/if}
				{:else}
					{#each filtered.slice(0, visibleCount) as item (item.entry)}
						<PokemonCard
							card={item.card}
							count={item.count ?? countOf(item.entry)}
							locked={item.locked}
							quiet
							selected={split && shown?.id === item.id && shown?.shiny === (item.card.shiny && !item.locked)}
							onselect={split ? () => (picked = { id: item.id, shiny: item.card.shiny && !item.locked }) : undefined}
						/>
					{/each}
				{/if}
			</div>
			{#if all && visibleCount < filtered.length}
				<div id="dex-sentinel" style="height:1px;width:100%;" use:loadMore></div>
			{/if}
			<div id="dexLoadStatus" style:opacity={all && filtered.length > 0 ? '0' : '1'}>
				{#if all}{filtered.length > 0 ? `${filtered.length} Pokémon` : 'Ingen funnet'}{/if}
			</div>
		</div>
		{#if split && all}
			<aside
				bind:this={pane}
				class="dex-pane"
				aria-label="Valgt Pokémon"
				style:--pane-top="{filterHeight}px"
			>
				{#if shown && info}
					{#key shown.id}
						<PokemonDetail
							{info}
							id={shown.id}
							shiny={shown.shiny}
							compact
							onpick={(id) => (picked = { id, shiny: false })}
						/>
					{/key}
					<a class="pm-button secondary open-viewer" href="./pokeviewer.html?pokemonId={shown.id}{shown.shiny ? '&shiny=1' : ''}"
						>Åpne i Pokéviewer</a
					>
				{:else}
					<p class="pane-empty">Ingen Pokémon å vise.</p>
				{/if}
			</aside>
		{/if}
	</div>
</div>

<style>
	.dex {
		margin-bottom: 40px;
	}

	/* The bar under the header: Mine/Mangler/Alle, search, Filter and Sorter in one row. It sticks
	   while the cards scroll. */
	#filterButtons {
		position: sticky;
		top: var(--pm-bar-height);
		z-index: 100;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
		background: var(--pm-paper);
		box-shadow: 0 1px 0 var(--pm-line), 0 6px 12px -10px oklch(0.3 0.03 265 / 0.4);
	}
	.mode {
		display: flex;
		flex: 0 0 auto;
		padding: 3px;
		border-radius: 999px;
		background: var(--pm-cream);
	}
	.mode button {
		height: 34px;
		padding: 0 14px;
		border: none;
		border-radius: 999px;
		background: none;
		color: var(--pm-ink);
		font: inherit;
		font-size: 15px;
		font-weight: 700;
		cursor: pointer;
	}
	.mode button[aria-pressed='true'] {
		background: var(--pm-ink);
		color: var(--pm-paper);
	}
	#searchInput {
		flex: 1 1 160px;
		min-width: 0;
		height: 40px;
		padding: 0 14px 0 40px;
		border: 2px solid var(--pm-line);
		border-radius: 999px;
		background: var(--pm-cream) url('/images/compass.png') no-repeat 12px 50% / 20px;
		color: var(--pm-ink);
		font: inherit;
		font-size: 16px;
		outline: none;
		-webkit-appearance: none;
		appearance: none;
	}
	#searchInput:focus {
		border-color: var(--pm-ink);
	}
	.dropdowns {
		display: flex;
		flex: 0 0 auto;
		gap: 8px;
	}
	.btn,
	.altbtn {
		flex: 0 0 auto;
		height: 40px;
		padding: 0 14px;
		border: 2px solid transparent;
		border-radius: 999px;
		background: var(--pm-cream);
		color: var(--pm-ink);
		font: inherit;
		font-size: 15px;
		font-weight: 700;
		white-space: nowrap;
		cursor: pointer;
	}
	.altbtn {
		border-color: var(--pm-line);
		background: var(--pm-paper);
	}
	.altbtn.active {
		background: var(--pm-ink);
		border-color: var(--pm-ink);
		color: var(--pm-paper);
	}
	.altbtn.on:not(.active) {
		border-color: var(--pm-ink);
	}
	.filter-count {
		display: inline-grid;
		place-items: center;
		min-width: 20px;
		height: 20px;
		margin-left: 6px;
		padding: 0 5px;
		border-radius: 999px;
		background: var(--pm-red);
		color: var(--pm-paper);
		font-size: 12px;
	}
	.caret {
		margin-left: 2px;
		color: var(--pm-ink-soft);
	}
	.active .caret {
		color: inherit;
	}
	/* Tap once to show only these, twice to hide them. The ✓ and ✕ carry the meaning without colour. */
	.btn.filter-include {
		background: var(--pm-green-deep);
		color: var(--pm-paper);
	}
	.btn.filter-include::before {
		content: '✓ ';
	}
	.btn.filter-exclude {
		background: var(--pm-red-soft);
		border-color: var(--pm-red);
		color: var(--pm-red-deep);
		text-decoration: line-through;
	}
	.btn.filter-exclude::before {
		content: '✕ ';
	}
	.btn:disabled {
		opacity: 0.45;
		cursor: default;
	}

	/* Progress opens the list and scrolls away with it. */
	.dex-progress {
		max-width: 1100px;
		margin: 14px auto 0;
		padding: 0 16px;
	}
	.dex-counts {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 18px;
		margin: 0 0 8px;
		color: var(--pm-ink-soft);
	}
	.dex-counts b {
		color: var(--pm-ink);
		font-family: var(--pm-display);
		font-size: 20px;
		font-weight: 400;
	}
	.dex-counts .showing {
		margin-left: auto;
	}
	.meters {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 6px 16px;
	}
	.meter {
		display: grid;
		grid-template-columns: auto 1fr;
		grid-template-areas: 'label text' 'track track';
		gap: 3px 8px;
		font-size: 13px;
	}
	.meter-label {
		grid-area: label;
		font-weight: 700;
	}
	.meter-text {
		grid-area: text;
		justify-self: end;
		color: var(--pm-ink-soft);
		font-variant-numeric: tabular-nums;
	}
	.meter-track {
		grid-area: track;
		height: 6px;
		overflow: hidden;
		border-radius: 999px;
		background: var(--pm-line);
	}
	.meter-track span {
		display: block;
		height: 100%;
		border-radius: 999px;
	}

	/* iPad and wider: list and pane side by side. The pane stays put under the filter bar while the
	   list scrolls. */
	.dex-body.split {
		display: grid;
		grid-template-columns: minmax(0, 1fr) clamp(360px, 42vw, 520px);
		gap: 16px;
		max-width: 1400px;
		margin: 0 auto;
		padding-right: 16px;
	}
	.split .dex-progress {
		padding-right: 0;
	}
	.split #pokedex {
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		max-width: none;
		padding-right: 0;
	}
	.dex-pane {
		position: sticky;
		top: calc(var(--pm-bar-height) + var(--pane-top) + 14px);
		max-height: calc(100vh - var(--pm-bar-height) - var(--pane-top) - 28px);
		margin-top: 14px;
		overflow-y: auto;
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
		padding: 0 2px 4px;
	}
	.open-viewer {
		display: flex;
		align-items: center;
		justify-content: center;
		margin-top: 14px;
		line-height: 1;
	}
	.pane-empty {
		margin: 0;
		color: var(--pm-ink-soft);
	}

	/* Cards fill the row instead of keeping a fixed width. */
	#pokedex {
		--card-width: auto;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 16px;
		max-width: 1100px;
		margin: 0 auto;
		padding: 14px 16px;
	}
	.skeleton {
		aspect-ratio: 3 / 4;
		border-radius: 16px;
		background: linear-gradient(90deg, var(--pm-line) 25%, var(--pm-paper) 50%, var(--pm-line) 75%) 0 0 / 200% 100%;
		animation: shimmer 1.4s infinite;
	}
	@keyframes shimmer {
		from { background-position: 200% 0; }
		to { background-position: -200% 0; }
	}
	#dexLoadStatus {
		padding: 6px;
		color: var(--pm-ink-soft);
		text-align: center;
		transition: opacity 0.4s;
	}

	/* Filter and Sorter panels. Their display is set inline, so it is not set here. */
	.dex-dropdown-panel {
		position: absolute;
		top: calc(100% + 6px);
		right: 16px;
		z-index: 1;
		width: min(380px, calc(100vw - 24px));
		max-height: 70vh;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 14px;
		border-radius: var(--pm-radius);
		background: var(--pm-paper);
		box-shadow: var(--pm-shadow), 0 0 0 1px var(--pm-line), 0 18px 40px -16px oklch(0.3 0.03 265 / 0.45);
	}
	#sortContent {
		width: auto;
		min-width: 200px;
		padding: 8px;
	}
	.panel-actions {
		display: flex;
		gap: 6px;
	}
	.btn.done {
		background: var(--pm-ink);
		color: var(--pm-paper);
	}
	.panel-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.panel-head h2,
	#filterContent h3 {
		margin: 0;
		font-family: var(--pm-display);
		font-weight: 400;
	}
	.panel-head h2 {
		font-size: 22px;
	}
	#filterContent h3 {
		margin: 14px 0 6px;
		font-size: 17px;
	}
	.panel-hint {
		margin: 4px 0 8px;
		color: var(--pm-ink-soft);
		font-size: 13px;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	#typecontent {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 6px;
	}
	.typecard2 {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 36px;
		padding: 0 10px;
		border: 3px solid transparent;
		border-radius: 999px;
		background: var(--type, oklch(0.6 0.02 265));
		color: var(--type-text, var(--pm-paper));
		font: inherit;
		font-size: 14px;
		font-weight: 700;
		cursor: pointer;
	}
	.typecard2.active {
		border-color: var(--pm-ink);
		box-shadow: inset 0 0 0 2px var(--pm-paper);
	}
	.typecard2.active::before {
		content: '✓ ';
	}
	#generationContent {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 4px;
	}
	#generationContent label,
	#sortContent a {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 40px;
		padding: 0 8px;
		border-radius: 10px;
		color: var(--pm-ink);
		font-weight: 700;
		white-space: nowrap;
		cursor: pointer;
	}
	#generationContent input {
		width: 20px;
		height: 20px;
		accent-color: var(--pm-red);
	}
	#sortContent a.active {
		background: var(--pm-red-soft);
		color: var(--pm-red-deep);
	}
	@media (hover: hover) {
		#sortContent a:hover,
		#generationContent label:hover {
			background: var(--pm-cream);
		}
	}

	/* Phones: the search gets its own row under the mode and the two buttons. */
	@media (max-width: 720px) {
		#filterButtons {
			flex-wrap: wrap;
			padding: 8px 12px;
		}
		.mode {
			order: 1;
		}
		.dropdowns {
			order: 2;
			margin-left: auto;
		}
		#searchInput {
			order: 3;
			flex: 1 1 100%;
		}
		.dex-dropdown-panel {
			right: 12px;
		}
	}
	@media (max-width: 480px) {
		#pokedex {
			grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
			gap: 10px;
			padding: 12px;
		}
		.dex-progress {
			padding: 0 12px;
		}
		.mode button {
			padding: 0 11px;
		}
		.altbtn {
			padding: 0 11px;
		}
	}

	@media (pointer: coarse) {
		.btn,
		.altbtn,
		#searchInput {
			height: 44px;
		}
		.mode button {
			height: 38px;
		}
		.typecard2,
		#generationContent label,
		#sortContent a {
			min-height: 44px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.skeleton {
			animation: none;
		}
	}
</style>
