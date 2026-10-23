<script>
	// One Pokémon in detail: the big picture, facts, stats, names in other languages, evolutions
	// and alternate forms. Pokémon you have not caught are shown as a shadow. Used by the
	// Pokéviewer page and, on iPad, beside the Pokédex list, where `compact` stacks it for the
	// narrower pane. A tap on an evolution calls `onpick` with its number instead of following the
	// link.
	import { player } from '#lib/player.svelte.js';
	import Foil from '#lib/Foil.svelte';
	import Aura from '#lib/Aura.svelte';

	/** @type {{ info: import('#lib/game/pokemon.js').PokemonInfo, id: number, shiny?: boolean, compact?: boolean, onpick?: (id: number) => void }} */
	let { info, id, shiny = false, compact = false, onpick } = $props();

	const folder = $derived(shiny ? 'shiny' : 'normal');
	/** @param {string | number} entry */
	const owned = (entry) => player.pkmnList.includes(`${shiny ? 'S' : 'N'}${entry}`);
	/** @param {any} types */
	const typeList = (types) => (Array.isArray(types) ? types : [types]);

	/** @type {any} The base form, with stats, description and names in other languages. */
	const pokemon = $derived(info?.[id]?.['0']);
	const unlocked = $derived(owned(id));
	/** @type {'' | 'legendary' | 'mythic'} */
	const rarity = $derived(pokemon?.is_legendary ? 'legendary' : pokemon?.is_mythical ? 'mythic' : '');

	const evoFromId = $derived(pokemon?.evo_from ?? null);
	/** @type {any} */
	const evoFrom = $derived(evoFromId ? info?.[evoFromId]?.['0'] : null);
	const STAT_MAX = 255;
	const stats = $derived(
		pokemon
			? [['HP', pokemon.base_hp], ['Angrep', pokemon.base_atk], ['Forsvar', pokemon.base_def], ['Sp. angrep', pokemon.base_satk], ['Sp. forsvar', pokemon.base_sdef], ['Fart', pokemon.base_spd]]
			: []
	);
	const evolvesTo = $derived(
		info ? Object.keys(info).filter((key) => info?.[key]?.['0']?.evo_from === id).map(Number) : []
	);
	const altForms = $derived(Object.entries(info?.[id] ?? {}).filter(([key, form]) => key !== '0' && form));

	/**
	 * @param {MouseEvent} event
	 * @param {number} next
	 */
	function pick(event, next) {
		if (!onpick) return;
		event.preventDefault();
		onpick(next);
	}
</script>

{#snippet types(/** @type {any} */ list)}
	<p class="types">{#each typeList(list) as type, i (i)}<span class="pm-type t-{String(type).toLowerCase()} poke-types">{type}</span>{/each}</p>
{/snippet}

{#snippet smallPokemon(/** @type {string | number} */ id, /** @type {any} */ form, /** @type {boolean} */ isOwned, /** @type {string | number} */ imageId)}
	<div class="small-poke pm-surface" class:locked={!isOwned}>
		<img
			src="images/pokemon/{folder}/{imageId}.webp"
			alt={isOwned ? form.name : 'Ukjent Pokémon'}
			class="poke-image"
			style="filter: {isOwned ? 'brightness(100%)' : 'brightness(0%)'}; pointer-events: none;"
		/>
		<p class="small-name">{isOwned ? form.name : '???'} <span class="poke-id">#{id}</span></p>
		{@render types(form.types)}
	</div>
{/snippet}

<div id="pokemondata" class:compact>
	<div id="poke-details">
		<div id="main-pokemon-wrapper" class="hero pm-surface" class:shiny>
			{#if pokemon}
				<div class="hero-art" class:locked={!unlocked}>
					<Foil on={shiny && unlocked}>
						<Aura kind={unlocked ? rarity : ''}>
							<img
								src="images/pokemon/{folder}/{id}.webp"
								alt={unlocked ? pokemon.name : 'Ukjent Pokémon'}
								class="poke-image"
								style="filter: {unlocked ? 'brightness(100%)' : 'brightness(0%)'}; pointer-events: none;"
							/>
						</Aura>
					</Foil>
				</div>
				<div class="hero-info">
					<p class="number">#{id}</p>
					<svelte:element this={compact ? 'h2' : 'h1'} class="name">{unlocked ? pokemon.name : '???'}</svelte:element>
					{@render types(pokemon.types)}
					{#if unlocked && rarity}<p class="rarity {rarity}">{rarity === 'legendary' ? 'Legendarisk' : 'Mytisk'}</p>{/if}
					{#if !unlocked}<p class="locked-note">Fang denne Pokémonen for å se mer om den.</p>{/if}
					<dl class="facts">
						<div><dt>Generasjon</dt><dd>{unlocked ? (pokemon.generation ? pokemon.generation[0].toUpperCase() + pokemon.generation.slice(1) : 'Ukjent') : '???'}</dd></div>
						<div><dt>Høyde</dt><dd>{unlocked ? (pokemon.height ? (pokemon.height / 10).toFixed(1) + ' m' : 'Ukjent') : '???'}</dd></div>
						<div><dt>Vekt</dt><dd>{unlocked ? (pokemon.weight ? (pokemon.weight / 10).toFixed(1) + ' kg' : 'Ukjent') : '???'}</dd></div>
					</dl>
					<blockquote class="dexentry" lang="en">{unlocked ? pokemon.description : '???'}</blockquote>
				</div>
				<div class="hero-extra">
					<section class="stats-container">
						<h2 class="evotitle">Stats</h2>
						{#if unlocked}
							{#each stats as [label, value] (label)}
								<div class="stat-item">
									<span class="stat-label">{label}</span>
									<span class="stat-bar" aria-hidden="true"><span style:width="{Math.min(100, (Number(value) / STAT_MAX) * 100)}%"></span></span>
									<span class="stat-value">{value}</span>
								</div>
							{/each}
						{:else}
							<p class="unknown">???</p>
						{/if}
					</section>
					<section class="languages-container">
						<h2 class="evotitle">På andre språk</h2>
						{#if unlocked}
							{#each [['Japansk', pokemon.name_ja], ['Japansk (latin)', pokemon.name_ja_romanji], ['Tysk', pokemon.name_de], ['Fransk', pokemon.name_fr]] as [code, name] (code)}
								<div class="language-item"><span class="language-code">{code}</span><span class="language-name">{name || 'N/A'}</span></div>
							{/each}
						{:else}
							<p class="unknown">???</p>
						{/if}
					</section>
				</div>
			{/if}
		</div>

		<div class="evolutions">
			<div id="prev-evolution-wrapper" class="evolution-wrapper">
				<h2 class="evotitle">Utvikles fra</h2>
				{#if pokemon}
					{#if evoFrom}
						<a href="./pokeviewer.html?pokemonId={evoFromId}" onclick={(e) => pick(e, evoFromId)}>
							{@render smallPokemon(evoFromId, evoFrom, owned(evoFromId), evoFromId)}
						</a>
					{:else}
						<p class="unknown">Ingen</p>
					{/if}
				{/if}
			</div>
			<div id="next-evolution-wrapper" class="evolution-wrapper">
				<h2 class="evotitle">Utvikles til{evolvesTo.length > 1 ? ` (${evolvesTo.length})` : ''}</h2>
				{#if pokemon}
					{#if evolvesTo.length > 0}
						<div class="evo-list">
							{#each evolvesTo as evoId (evoId)}
								{@const form = info?.[evoId]?.['0']}
								{#if form}
									<a href="./pokeviewer.html?pokemonId={evoId}" onclick={(e) => pick(e, evoId)}>
										{@render smallPokemon(evoId, form, owned(evoId), evoId)}
									</a>
								{/if}
							{/each}
						</div>
					{:else}
						<p class="unknown">Ingen</p>
					{/if}
				{/if}
			</div>
		</div>
	</div>

	<section id="alternate-forms-wrapper" class="alternate-forms-wrapper" style:display={pokemon ? (altForms.length > 0 ? '' : 'none') : null}>
		<h2 class="pm-section-title wrapper-header">Andre former</h2>
		<div class="alt-grid">
			{#each altForms as [key, form] (key)}
				{@render smallPokemon(`${id}-${key}`, form, owned(`${id}-${key}`), form.imageid ?? id)}
			{/each}
		</div>
	</section>
</div>

<style>
	.hero {
		display: grid;
		grid-template-columns: minmax(200px, 300px) 1fr;
		grid-template-areas: 'art info' 'extra extra';
		gap: 20px 28px;
		padding: 22px;
	}
	.hero.shiny {
		box-shadow: var(--pm-shadow), 0 0 0 3px var(--pm-gold);
	}
	.hero-art {
		grid-area: art;
		position: relative;
		overflow: hidden;
		display: grid;
		place-items: center;
		aspect-ratio: 1;
		border-radius: 50%;
		background: var(--pm-cream);
	}
	.shiny .hero-art {
		background: oklch(0.95 0.06 90);
	}
	.hero-art img {
		position: relative;
		width: 86%;
		height: 86%;
		object-fit: contain;
	}
	.hero-info {
		grid-area: info;
		min-width: 0;
	}
	.number {
		margin: 0;
		color: var(--pm-ink-soft);
		font-family: var(--pm-display);
		font-size: 20px;
	}
	.name {
		margin: 0 0 8px;
		font-family: var(--pm-display);
		font-weight: 400;
		font-size: clamp(32px, 6vw, 48px);
		line-height: 1;
		text-transform: capitalize;
	}
	.types {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 0;
	}
	.rarity {
		display: inline-block;
		margin: 10px 0 0;
		padding: 3px 12px;
		border-radius: 999px;
		background: var(--pm-gold);
		color: var(--pm-ink);
		font-weight: 700;
	}
	.rarity.mythic {
		background: oklch(0.52 0.17 330);
		color: var(--pm-paper);
	}
	.locked-note {
		margin: 12px 0 0;
		color: var(--pm-ink-soft);
	}
	.facts {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
		margin: 16px 0;
	}
	.facts div {
		padding: 8px 10px;
		border-radius: 12px;
		background: var(--pm-cream);
	}
	.facts dt {
		color: var(--pm-ink-soft);
		font-size: 13px;
	}
	.facts dd {
		margin: 0;
		font-family: var(--pm-display);
		font-size: 18px;
	}
	.dexentry {
		margin: 0;
		padding: 12px 14px;
		border-left: 4px solid var(--pm-red);
		border-radius: 0 12px 12px 0;
		background: var(--pm-red-soft);
		font-style: italic;
		line-height: 1.45;
	}
	.hero-extra {
		grid-area: extra;
		display: grid;
		grid-template-columns: 3fr 2fr;
		gap: 20px;
	}
	.evotitle {
		margin: 0 0 8px;
		font-family: var(--pm-display);
		font-weight: 400;
		font-size: 20px;
	}
	.stat-item {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 6px 0;
	}
	.stat-label {
		width: 92px;
		font-size: 14px;
		font-weight: 700;
	}
	.stat-bar {
		flex: 1;
		height: 10px;
		overflow: hidden;
		border-radius: 999px;
		background: var(--pm-cream);
	}
	.stat-bar span {
		display: block;
		height: 100%;
		border-radius: 999px;
		background: var(--pm-red);
	}
	.stat-value {
		width: 36px;
		font-family: var(--pm-display);
		text-align: right;
	}
	.language-item {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		padding: 6px 0;
		border-bottom: 1px solid var(--pm-line);
	}
	.language-code {
		color: var(--pm-ink-soft);
		font-size: 14px;
	}
	.language-name {
		font-weight: 700;
	}
	.unknown {
		margin: 0;
		color: var(--pm-ink-soft);
	}

	.evolutions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px;
		margin-top: 16px;
	}
	.evolution-wrapper a {
		color: inherit;
		text-decoration: none;
	}
	.evo-list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 10px;
	}
	.small-poke {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 12px;
		text-align: center;
	}
	.small-poke img {
		width: 96px;
		height: 96px;
		object-fit: contain;
	}
	.small-name {
		margin: 0;
		font-family: var(--pm-display);
		font-size: 18px;
		text-transform: capitalize;
	}
	.poke-id {
		color: var(--pm-ink-soft);
		font-size: 14px;
	}
	.alt-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 12px;
	}

	/* Phones, and the pane beside the Pokédex list: one column. */
	@media (max-width: 640px) {
		.hero {
			grid-template-columns: 1fr;
			grid-template-areas: 'art' 'info' 'extra';
			padding: 16px;
		}
		.hero-art {
			width: min(240px, 70vw);
			justify-self: center;
		}
		.hero-info {
			text-align: center;
		}
		.types {
			justify-content: center;
		}
		.dexentry {
			text-align: left;
		}
		.hero-extra {
			grid-template-columns: 1fr;
		}
	}
	.compact .hero {
		grid-template-columns: 1fr;
		grid-template-areas: 'art' 'info' 'extra';
		padding: 16px;
	}
	.compact .hero-art {
		width: min(220px, 70%);
		justify-self: center;
	}
	.compact .hero-info {
		text-align: center;
	}
	.compact .types {
		justify-content: center;
	}
	.compact .dexentry {
		text-align: left;
	}
	.compact .hero-extra {
		grid-template-columns: 1fr;
	}
	.compact .evolutions {
		grid-template-columns: 1fr;
	}
	@media (max-width: 420px) {
	@media (max-width: 420px) {
		.evolutions {
			grid-template-columns: 1fr 1fr;
			gap: 10px;
		}
		.alt-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	}
</style>
