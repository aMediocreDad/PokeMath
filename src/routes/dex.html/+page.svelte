<script>
	// The Pokédex, ported from static/dex.html and dex.js: every caught Pokémon once, with
	// filters, search, sorting and progress bars. Filtering and search match against the same
	// card HTML the legacy page built, so results are identical.
	import { onMount } from 'svelte';
	import { player } from '#lib/player.svelte.js';
	import { describe, legacyCardHtml, loadPokemonInfo, alternateFormCount } from '#lib/game/pokemon.js';
	import PokemonCard from '#lib/PokemonCard.svelte';

	const PAGE_SIZE = 60;
	const ALL_GENS = ['gen-1', 'gen-2', 'gen-3', 'gen-4', 'gen-5', 'gen-6', 'gen-7', 'gen-8', 'gen-9', 'gen-0'];
	const SPECIAL_FILTERS = [
		['Shiny', 'Shiny'], ['Legendarisk', 'Legendarisk'], ['Mytisk', 'Mytisk'], [' mega ', 'Mega'],
		['gigantamax', 'Gigantamax'], ['alolan', 'Alolan'], ['galarian', 'Galarian'], ['hisuian', 'Hisuian'],
		['-H', 'Halloween'], ['-C', 'Jul'], ['-U', 'Unik']
	];
	const TYPES = ['bug', 'dark', 'dragon', 'electric', 'fairy', 'fighting', 'fire', 'flying', 'ghost', 'grass', 'ground', 'ice', 'normal', 'poison', 'psychic', 'rock', 'steel', 'water'];
	const GENERATIONS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
	const SORTS = [
		['id-asc', 'ID (lav til høy)'], ['id-desc', 'ID (høy til lav)'], ['name-asc', 'Navn (A til Å)'],
		['name-desc', 'Navn (Å til A)'], ['count-desc', 'Antall (flest først)']
	];

	/** @typedef {{ entry: string, id: number, html: string, card: import('#lib/game/pokemon.js').PokemonCard }} DexItem */

	/** @type {DexItem[] | null} null while loading */
	let all = $state(null);
	let altTotal = $state(0);

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
			all = [...new Set(player.pkmnList)]
				.map((entry) => {
					const card = describe(entry);
					return { entry: card.entry, id: card.id, card, html: legacyCardHtml(card, countOf(card.entry)) };
				})
				.sort((a, b) => a.id - b.id);
		});
	});

	const filtered = $derived.by(() => {
		if (!all) return [];
		let items = all.filter(({ html }) => {
			if (genFilter.length > 0 && !genFilter.some((k) => html.includes(k))) return false;
			if (typeFilter.length > 0 && !typeFilter.every((k) => html.includes(k))) return false;
			for (const [key, state] of Object.entries(specialFilter)) {
				if (state === 1 && !html.includes(key)) return false;
				if (state === 2 && html.includes(key)) return false;
			}
			return true;
		});
		if (duplicates) {
			items = items.filter(({ entry }) => (duplicates === 1 ? countOf(entry) > 1 : countOf(entry) <= 1));
		}
		const q = search.trim().toUpperCase();
		if (q) items = items.filter(({ html }) => html.toUpperCase().includes(q));
		if (sort === 'name-asc' || sort === 'name-desc') {
			const direction = sort === 'name-asc' ? 1 : -1;
			items = [...items].sort((a, b) => direction * a.card.name.toLowerCase().localeCompare(b.card.name.toLowerCase(), 'no'));
		}
		if (sort === 'id-desc') items = [...items].sort((a, b) => b.id - a.id);
		if (sort === 'count-desc') items = [...items].sort((a, b) => countOf(b.entry) - countOf(a.entry));
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

	const allClean = $derived(typeFilter.length === 0 && Object.keys(specialFilter).length === 0 && duplicates === 0);

	function showAll() {
		genFilter = [...ALL_GENS];
		typeFilter = [];
		specialFilter = {};
		duplicates = 0;
	}

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
	<link rel="stylesheet" href="/menustyle.css?v=100" />
	<link rel="stylesheet" href="/dex.css?v=103" />
	<link rel="stylesheet" href="/pokemon.css?v=101" />
</svelte:head>

<svelte:document onclick={closePanels} />

<div class="main" class:dex-bars-hidden={barsCollapsed}>
	<div id="filterButtons">
		<input type="text" placeholder="Søk.." id="searchInput" bind:value={search} />
		<!-- On phones the filters scroll sideways in one row; elsewhere this wrapper changes nothing. -->
		<div class="filter-chips">

		<button class="btn" class:active={allClean} data-filter="all" onclick={showAll}>Vis alle</button>
		{#each SPECIAL_FILTERS as [key, label] (key)}
			<button
				class="btn"
				class:filter-include={specialFilter[key] === 1}
				class:filter-exclude={specialFilter[key] === 2}
				data-filter={key}
				onclick={() => cycleSpecial(key)}>{label}</button
			>
		{/each}
		<button
			class="btn"
			id="duplicatesBtn"
			class:filter-include={duplicates === 1}
			class:filter-exclude={duplicates === 2}
			onclick={() => (duplicates = (duplicates + 1) % 3)}>Dobler</button
		>

		<button class="altbtn" id="typeDropdownBtn" class:active={openPanel === 'type'} onclick={(e) => togglePanel('type', e)}
			>Typer &#x25BC;</button
		>
		<button class="altbtn" id="generationDropdown" class:active={openPanel === 'gen'} onclick={(e) => togglePanel('gen', e)}
			>Generasjon &#x25BC;</button
		>
		<button class="altbtn" id="sortDropdownBtn" class:active={openPanel === 'sort'} onclick={(e) => togglePanel('sort', e)}
			>Sorter &#x25BC;</button
		>
		</div>
	</div>

	<div class="columns is-multiline is-mobile" id="pokedex">
		{#if !all}
			{#if player.loaded}
				{#each { length: 20 }, i (i)}<div class="skeleton"></div>{/each}
			{:else}
				Laster...<br /><br />
			{/if}
		{:else}
			{#each filtered.slice(0, visibleCount) as item (item.entry)}
				<PokemonCard card={item.card} count={countOf(item.entry)} />
			{/each}
		{/if}
	</div>
	{#if all && visibleCount < filtered.length}
		<div id="dex-sentinel" style="height:1px;width:100%;" use:loadMore></div>
	{/if}
	<div class="center" id="dexLoadStatus" style:opacity={all && filtered.length > 0 ? '0' : '1'}>
		{#if all}{filtered.length > 0 ? `${filtered.length} Pokémon` : 'Ingen funnet'}{/if}
	</div>
</div>

<div class="botbar" id="dex-botbar">
	<div class="dex-stats-row">
		<button class="dex-progress-toggle" class:collapsed={barsCollapsed} id="progressToggleBtn" onclick={toggleBars} title="Vis/skjul fremdrift"
			>&#x25B2;</button
		>
		<!-- svelte-ignore a11y_missing_attribute -->
		<a id="amountCaught" class="statisticText" data-text=" fanget.">{all ? player.caught : '?'}</a>
		<!-- svelte-ignore a11y_missing_attribute -->
		<a id="amountCaught2" class="statisticText" data-text=" unike.">{all ? all.length : '?'}</a>
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
		<a class="typecard2 type-{type}" class:active={typeFilter.includes(type)} data-filter={type} onclick={() => toggleType(type)}
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
	.filter-chips {
		display: contents;
	}

	@media (max-width: 720px) {
		#searchInput {
			flex: 1 1 100%;
		}
		.filter-chips {
			display: flex;
			gap: 6px;
			width: 100%;
			overflow-x: auto;
			-webkit-overflow-scrolling: touch;
			scrollbar-width: none;
			padding-bottom: 2px;
		}
		.filter-chips::-webkit-scrollbar {
			display: none;
		}
		/* Keep "84 fanget." on one line, and all three counters on screen. */
		.dex-stats-row {
			gap: 4px;
		}
		.statisticText {
			font-size: 16px;
			white-space: nowrap;
			padding-right: 6px;
		}
	}
	@media (max-width: 360px) {
		.statisticText {
			font-size: 13px;
		}
	}

	@media (pointer: coarse) {
		/* 16px or larger, or iOS zooms the page when the search field is focused. */
		#searchInput {
			font-size: 16px;
		}
		.btn,
		.altbtn {
			height: 44px;
		}
		.dex-progress-toggle {
			min-width: 44px;
			min-height: 44px;
		}
		.typecard2 {
			min-height: 44px;
		}
		#generationContent label,
		#sortContent a {
			min-height: 44px;
		}
	}
</style>
