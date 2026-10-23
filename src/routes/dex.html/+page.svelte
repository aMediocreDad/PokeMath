<script>
	// The Pokédex, ported from static/dex.html and dex.js: every caught Pokémon once, with
	// filters, search, sorting and progress bars. Filtering and search match against the same
	// card HTML the legacy page built, so results are identical. "Alle arter" shows every species
	// instead, like the Pokédex in the games: the ones not caught yet as shadows, and each opens the
	// viewer.
	import { onMount, tick } from 'svelte';
	import { player } from '#lib/player.svelte.js';
	import { describe, legacyCardHtml, loadPokemonInfo, alternateFormCount, pokemonInfo } from '#lib/game/pokemon.js';
	import PokemonCard from '#lib/PokemonCard.svelte';

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
	/** @type {DexItem[]} Every species once, for "Alle". */
	let species = $state.raw([]);
	let altTotal = $state(0);
	/** 'mine' = the Pokémon caught, 'all' = every species. */
	let mode = $state(/** @type {'mine' | 'all'} */ ('mine'));
	/** The filter chips that mean something with every species; the rest are hidden in "Alle arter". */
	const ALL_MODE_FILTERS = new Set(['Legendarisk', 'Mytisk']);
	/** In "Alle arter": 0 = every species, 1 = only caught, 2 = only missing. */
	let caughtFilter = $state(0);

	let genFilter = $state([...ALL_GENS]);
	/** @type {string[]} */
	let typeFilter = $state([]);
	/** @type {Record<string, 1 | 2>} 1 = only these, 2 = hide these */
	let specialFilter = $state({});
	/** 0 = all, 1 = only duplicates, 2 = no duplicates */
	let duplicates = $state(0);
	let sort = $state('id-asc');
	let search = $state('');

	/** @type {'type' | 'gen' | 'sort' | null} */
	let openPanel = $state(null);
	let panelPosition = $state({ top: 0, left: 0 });
	let visibleCount = $state(PAGE_SIZE);
	let barsCollapsed = $state(false);

	/** @param {string} entry */
	const countOf = (entry) => player.pkmnList.filter((e) => e === entry).length;

	/** @param {'mine' | 'all'} next */
	function setMode(next) {
		mode = next;
		localStorage.setItem('dexMode', next);
	}

	onMount(() => {
		const stored = localStorage.getItem('dexBarsCollapsed');
		// On phones the progress bars start folded away unless the player opened them before.
		barsCollapsed = stored === null ? matchMedia('(max-width: 720px)').matches : stored === '1';
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
			mode = storedMode === 'all' || storedMode === 'mine' ? storedMode : mine.length ? 'mine' : 'all';
			all = mine;
		});
	});

	const filtered = $derived.by(() => {
		if (!all) return [];
		const everySpecies = mode === 'all';
		let items = (everySpecies ? species : all).filter(({ html }) => {
			if (genFilter.length > 0 && !genFilter.some((k) => html.includes(k))) return false;
			if (typeFilter.length > 0 && !typeFilter.every((k) => html.includes(k))) return false;
			for (const [key, state] of Object.entries(specialFilter)) {
				if (everySpecies && !ALL_MODE_FILTERS.has(key)) continue;
				if (state === 1 && !html.includes(key)) return false;
				if (state === 2 && html.includes(key)) return false;
			}
			return true;
		});
		if (everySpecies) {
			if (caughtFilter) items = items.filter(({ locked }) => (caughtFilter === 1 ? !locked : locked));
		} else if (duplicates) {
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

	const allClean = $derived(typeFilter.length === 0 && Object.keys(specialFilter).length === 0 && duplicates === 0 && caughtFilter === 0);
	const caughtSpecies = $derived(species.filter((s) => !s.locked).length);

	function showAll() {
		genFilter = [...ALL_GENS];
		typeFilter = [];
		specialFilter = {};
		duplicates = 0;
		caughtFilter = 0;
	}

	// Coming back from the viewer brings back the filters and where the list was scrolled to.
	/** @type {import('./$types').Snapshot<any>} */
	export const snapshot = {
		capture: () => ({ mode, genFilter, typeFilter, specialFilter, duplicates, caughtFilter, sort, search, visibleCount, scrollY: window.scrollY }),
		restore: (saved) => {
			({ mode, genFilter, typeFilter, specialFilter, duplicates, caughtFilter, sort, search } = saved);
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

	/**
	 * @param {'type' | 'gen' | 'sort'} panel
	 * @param {MouseEvent & { currentTarget: HTMLElement }} event
	 */
	function togglePanel(panel, event) {
		if (openPanel === panel) {
			openPanel = null;
			return;
		}
		const rect = event.currentTarget.getBoundingClientRect();
		panelPosition = { top: rect.bottom + 6, left: Math.min(rect.left, window.innerWidth - 300) };
		openPanel = panel;
	}

	/** @param {MouseEvent} event */
	function closePanels(event) {
		const target = /** @type {HTMLElement} */ (event.target);
		if (target.closest('#typeDropdownBtn, #generationDropdown, #sortDropdownBtn, #generationContent')) return;
		openPanel = null;
	}

	function toggleBars() {
		barsCollapsed = !barsCollapsed;
		localStorage.setItem('dexBarsCollapsed', barsCollapsed ? '1' : '0');
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

<div class="main dex" class:dex-bars-hidden={barsCollapsed}>
	<div id="filterButtons">
		<div class="mode" role="group" aria-label="Vis">
			<button id="dexModeMine" aria-pressed={mode === 'mine'} onclick={() => setMode('mine')}>Mine</button>
			<button id="dexModeAll" aria-pressed={mode === 'all'} onclick={() => setMode('all')}>Alle arter</button>
		</div>
		<input type="text" placeholder="Søk.." id="searchInput" bind:value={search} />
		<!-- The dropdowns sit next to the search; the filter chips scroll sideways in one row. On
		     phones dropdowns and chips share that scrolling row, dropdowns first. -->
		<div class="filter-row">
			<div class="dropdowns">
				<button class="altbtn" id="typeDropdownBtn" class:active={openPanel === 'type'} onclick={(e) => togglePanel('type', e)}
					>Typer <span class="caret">▾</span></button
				>
				<button class="altbtn" id="generationDropdown" class:active={openPanel === 'gen'} onclick={(e) => togglePanel('gen', e)}
					>Generasjon <span class="caret">▾</span></button
				>
				<button class="altbtn" id="sortDropdownBtn" class:active={openPanel === 'sort'} onclick={(e) => togglePanel('sort', e)}
					>Sorter <span class="caret">▾</span></button
				>
			</div>
			<div class="filter-chips">
				<button class="btn" class:active={allClean} data-filter="all" onclick={showAll}>Vis alle</button>
				{#if mode === 'all'}
					<button
						class="btn"
						id="caughtBtn"
						class:filter-include={caughtFilter === 1}
						class:filter-exclude={caughtFilter === 2}
						onclick={() => (caughtFilter = (caughtFilter + 1) % 3)}>Fanget</button
					>
				{/if}
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
		</div>
	</div>

	<div id="pokedex">
		{#if !all}
			{#if player.loaded}
				{#each { length: 20 }, i (i)}<div class="skeleton"></div>{/each}
			{:else}
				Laster...<br /><br />
			{/if}
		{:else}
			{#each filtered.slice(0, visibleCount) as item (item.entry)}
				<PokemonCard card={item.card} count={item.count ?? countOf(item.entry)} locked={item.locked} />
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

<div class="pm-dexbar" id="dex-botbar">
	<div class="dex-stats-row">
		<button class="dex-progress-toggle" class:collapsed={barsCollapsed} id="progressToggleBtn" onclick={toggleBars} title="Vis/skjul fremdrift"
			>&#x25B2;</button
		>
		<!-- svelte-ignore a11y_missing_attribute -->
		<a id="amountCaught" class="statisticText" data-text=" fanget.">{all ? player.caught : '?'}</a>
		{#if mode === 'all'}
			<!-- svelte-ignore a11y_missing_attribute -->
			<a id="speciesCaught" class="statisticText" data-text=" arter.">{caughtSpecies} / {species.length}</a>
		{:else}
			<!-- svelte-ignore a11y_missing_attribute -->
			<a id="amountCaught2" class="statisticText" data-text=" unike.">{all ? all.length : '?'}</a>
		{/if}
		<!-- svelte-ignore a11y_missing_attribute -->
		<a id="amountCaught3" class="statisticText" data-text=" i søk.">{all ? filtered.length : '?'}</a>
	</div>
	<div class="dex-progress-bars" class:collapsed={barsCollapsed} id="dexProgressBars">
		{#if all}
			{#each progress as bar (bar.label)}
				<div class="dex-pbar">
					<span class="dex-pbar-label">{bar.label}</span>
					<div class="dex-pbar-track">
						<div class="dex-pbar-fill" style:width="{bar.percent.toFixed(2)}%" style:background={bar.color}></div>
					</div>
					<span class="dex-pbar-text"
						>{bar.caught.toLocaleString('no-NO')} / {bar.total.toLocaleString('no-NO')} &nbsp;({bar.percent.toFixed(1)}%)</span
					>
				</div>
			{/each}
		{/if}
	</div>
</div>

<!-- Dropdown panels live outside the filter bar so they are never clipped by it. -->
<div
	class="dex-dropdown-panel"
	id="typecontent"
	style:display={openPanel === 'type' ? 'grid' : 'none'}
	style:top="{panelPosition.top}px"
	style:left="{panelPosition.left}px"
>
	{#each TYPES as type (type)}
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions, a11y_missing_attribute -->
		<a class="typecard2 type-{type} t-{type}" class:active={typeFilter.includes(type)} data-filter={type} onclick={() => toggleType(type)}
			>{type[0].toUpperCase() + type.slice(1)}</a
		>
	{/each}
</div>

<div
	class="dex-dropdown-panel"
	id="generationContent"
	style:display={openPanel === 'gen' ? 'block' : 'none'}
	style:top="{panelPosition.top}px"
	style:left="{panelPosition.left}px"
>
	{#each GENERATIONS as roman, i (roman)}
		<label
			><input
				type="checkbox"
				class="genCheckbox"
				value="gen-{i + 1}"
				checked={genFilter.includes(`gen-${i + 1}`)}
				onchange={(e) => toggleGen(`gen-${i + 1}`, e.currentTarget.checked)}
			/> Gen {roman}</label
		>
	{/each}
</div>

<div
	class="dex-dropdown-panel"
	id="sortContent"
	style:display={openPanel === 'sort' ? 'block' : 'none'}
	style:top="{panelPosition.top}px"
	style:left="{panelPosition.left}px"
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

<style>
	.dex {
		/* Room for the stats bar, which grows when the progress bars are open. */
		margin-bottom: 190px;
		transition: margin-bottom 0.3s ease;
	}
	.dex.dex-bars-hidden {
		margin-bottom: 80px;
	}

	/* Filter bar: sticks under the header while the cards scroll. */
	#filterButtons {
		position: sticky;
		top: var(--pm-bar-height);
		z-index: 100;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding: 10px 16px;
		background: var(--pm-paper);
		box-shadow: 0 1px 0 var(--pm-line), 0 6px 12px -10px oklch(0.3 0.03 265 / 0.4);
	}
	.filter-row,
	.dropdowns {
		display: contents;
	}
	/* Mine or Alle: two halves of one pill, next to the search. */
	.mode {
		display: flex;
		flex: 0 0 auto;
		padding: 3px;
		border-radius: 999px;
		background: var(--pm-cream);
	}
	.mode button {
		min-width: 64px;
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
	.dropdowns .altbtn {
		order: 1;
	}
	.filter-chips {
		order: 2;
		display: flex;
		gap: 6px;
		flex: 1 1 100%;
		min-width: 0;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
		/* Fade the right edge so it is clear there are more chips to scroll to. */
		mask-image: linear-gradient(to right, #000 calc(100% - 32px), transparent);
		-webkit-mask-image: linear-gradient(to right, #000 calc(100% - 32px), transparent);
	}
	.filter-chips::-webkit-scrollbar {
		display: none;
	}
	.filter-chips > :last-child {
		margin-right: 32px;
	}
	#searchInput {
		flex: 1 1 180px;
		min-width: 140px;
		height: 40px;
		padding: 0 14px 0 40px;
		border: 2px solid var(--pm-line);
		border-radius: 999px;
		background: var(--pm-cream) url('/images/compass.png') no-repeat 12px 50% / 20px;
		color: var(--pm-ink);
		font: inherit;
		font-size: 16px;
		outline: none;
	}
	#searchInput:focus {
		border-color: var(--pm-ink);
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
	.btn.active,
	.altbtn.active {
		background: var(--pm-ink);
		border-color: var(--pm-ink);
		color: var(--pm-paper);
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
	.caret {
		margin-left: 2px;
		color: var(--pm-ink-soft);
	}
	.active .caret {
		color: inherit;
	}

	/* Cards fill the row instead of keeping a fixed width. */
	#pokedex {
		--card-width: auto;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 16px;
		max-width: 1100px;
		margin: 0 auto;
		padding: 18px 16px;
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

	/* Dropdown panels. Their display is set inline, so it is not set here. */
	.dex-dropdown-panel {
		position: fixed;
		z-index: 9999;
		min-width: 180px;
		max-height: 70vh;
		overflow-y: auto;
		padding: 10px;
		border-radius: var(--pm-radius);
		background: var(--pm-paper);
		box-shadow: var(--pm-shadow), 0 0 0 1px var(--pm-line);
	}
	#typecontent {
		grid-template-columns: repeat(3, 1fr);
		gap: 6px;
		min-width: 300px;
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
	#generationContent label,
	#sortContent a {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 40px;
		padding: 0 10px;
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


	/* Stats bar at the bottom: counts, and progress bars that fold away. */
	.pm-dexbar {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 900;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 6px 16px calc(8px + env(safe-area-inset-bottom));
		background: var(--pm-ink);
		color: var(--pm-paper);
	}
	.dex-stats-row {
		display: flex;
		align-items: center;
		gap: 16px;
		width: 100%;
		max-width: 1100px;
		margin: 0 auto;
	}
	.dex-progress-toggle {
		min-width: 44px;
		min-height: 44px;
		border: none;
		border-radius: 50%;
		background: none;
		color: var(--pm-paper);
		font-size: 14px;
		cursor: pointer;
		transition: transform 0.25s;
	}
	.dex-progress-toggle.collapsed {
		transform: rotate(180deg);
	}
	.statisticText {
		padding-left: 24px;
		background: url('/pokeball.svg') no-repeat left center / 18px;
		color: var(--pm-paper);
		font-family: var(--pm-display);
		font-size: 18px;
		white-space: nowrap;
	}
	.statisticText::after {
		content: attr(data-text);
		font-family: var(--pm-body);
		font-size: 15px;
		opacity: 0.8;
	}
	.dex-progress-bars {
		display: flex;
		flex-direction: column;
		gap: 4px;
		max-width: 1100px;
		width: 100%;
		margin: 0 auto;
		max-height: 200px;
		overflow: hidden;
		transition: max-height 0.3s ease, opacity 0.3s ease;
	}
	.dex-progress-bars.collapsed {
		max-height: 0;
		opacity: 0;
	}
	.dex-pbar {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.dex-pbar-label {
		flex-shrink: 0;
		width: 72px;
		font-size: 13px;
		font-weight: 700;
	}
	.dex-pbar-track {
		flex: 1;
		min-width: 40px;
		height: 8px;
		overflow: hidden;
		border-radius: 999px;
		background: oklch(1 0 0 / 0.16);
	}
	.dex-pbar-fill {
		height: 100%;
		border-radius: 999px;
		transition: width 0.6s cubic-bezier(0.25, 1, 0.5, 1);
	}
	.dex-pbar-text {
		flex-shrink: 0;
		width: 140px;
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		text-align: right;
		opacity: 0.75;
	}

	@media (max-width: 720px) {
		#filterButtons {
			padding: 8px 12px;
		}
		#searchInput {
			flex: 1 1 100%;
		}
		.filter-row {
			display: flex;
			gap: 6px;
			width: 100%;
			overflow-x: auto;
			-webkit-overflow-scrolling: touch;
			scrollbar-width: none;
			mask-image: linear-gradient(to right, #000 calc(100% - 32px), transparent);
			-webkit-mask-image: linear-gradient(to right, #000 calc(100% - 32px), transparent);
		}
		.filter-row::-webkit-scrollbar {
			display: none;
		}
		.filter-chips {
			display: contents;
		}
		.dropdowns .altbtn {
			order: 0;
		}
		.dex-stats-row {
			gap: 8px;
		}
		.statisticText {
			font-size: 16px;
		}
		.statisticText::after {
			font-size: 13px;
		}
		.dex-pbar-text {
			width: 104px;
		}
	}
	@media (max-width: 480px) {
		#pokedex {
			grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
			gap: 10px;
			padding: 12px;
		}
	}
	@media (max-width: 360px) {
		.statisticText {
			font-size: 14px;
		}
	}

	@media (pointer: coarse) {
		.btn,
		.altbtn,
		#searchInput {
			height: 44px;
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
