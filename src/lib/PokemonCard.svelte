<script>
	// One Pokémon card, used under the game and in the Pokédex. Shiny, legendary and mythic cards
	// get a coloured edge and a badge beside the types, so the rarity does not depend on colour
	// alone. Shiny
	// cards are foiled like trading cards: a near-white ground, a holo shine and a glare sweeping
	// over the Pokémon, and a rainbow edge. Each card starts the sweep at its own moment, so a row of shinies
	// does not flash in unison. Legendaries and mythics stand in an Aura. A `locked` card is one the
	// all-species Pokédex has not seen caught: a shadow with no name, like the dex in the games.
	// With `onselect` a tap picks the card instead of opening the viewer (the Pokédex's split view).
	// A `quiet` card keeps its edge and badges but trades the moving foil and aura for a still tint:
	// the Pokédex list saves the show for the card picked out of it.
	import Foil from '#lib/Foil.svelte';
	import Aura from '#lib/Aura.svelte';

	/** @type {{ card: import('#lib/game/pokemon.js').PokemonCard, count: number, locked?: boolean, quiet?: boolean, selected?: boolean, onselect?: () => void }} */
	let { card, count, locked = false, quiet = false, selected = false, onselect } = $props();

	const phase = $derived(`${-((card.id * 0.37) % 6)}s`);

	const RARITY_LABEL = { legendary: 'Legendarisk', mythic: 'Mytisk' };
</script>

<a
	id={card.entry}
	class="pm-card"
	class:shiny={card.shiny}
	class:legendary={!locked && card.rarity === 'legendary'}
	class:mythic={!locked && card.rarity === 'mythic'}
	class:locked
	class:quiet
	class:selected
	aria-current={selected ? 'true' : undefined}
	href="./pokeviewer.html?pokemonId={card.id}{card.cardId.includes('-') ? `&form=${card.cardId.split('-')[1]}` : ''}{card.shiny ? '&shiny=1' : ''}"
	onclick={(e) => {
		if (!onselect) return;
		e.preventDefault();
		onselect();
	}}
>
	<div class="art">
		<Foil on={card.shiny && !locked && !quiet} {phase}>
			<Aura kind={locked || quiet ? '' : card.rarity} {phase}>
				<span class="sprite" style="background-image: url('{card.image}');"></span>
			</Aura>
		</Foil>
		<span class="number">#{card.cardId}</span>
		{#if !locked}<span class="count card-counter">x{count}</span>{/if}
	</div>
	<div class="name">{locked ? '???' : card.name}</div>
	<div class="types">
		{#each card.types as type, i (i)}<span class="type t-{type.toLowerCase()}">{type}</span>{/each}
		{#if !locked && card.shiny}<span class="type badge shiny-badge">Shiny</span>{/if}
		{#if !locked && card.rarity}<span class="type badge {card.rarity}-badge">{RARITY_LABEL[card.rarity]}</span>{/if}
	</div>
</a>

<style>
	.pm-card {
		display: flex;
		flex-direction: column;
		width: var(--card-width, 136px);
		padding: 8px 8px 10px;
		border-radius: 16px;
		background: var(--pm-paper);
		box-shadow: var(--pm-shadow), 0 0 0 1px var(--pm-line);
		color: var(--pm-ink);
		text-decoration: none;
		transition: transform 120ms ease-out;
	}
	.pm-card.selected {
		outline: 3px solid var(--pm-ink);
		outline-offset: 3px;
	}
	.pm-card:active {
		transform: scale(0.97);
	}
	/* Shiny, legendary and mythic cards get an edge drawn as a gradient: rainbow foil for a shiny,
	   polished gold for a legendary (bands of light and dark gold, like metal catching the light),
	   pearl for a mythic. The foil edge wins; the badges under the name still say all of it. */
	.pm-card.shiny,
	.pm-card.legendary,
	.pm-card.mythic {
		position: relative;
		isolation: isolate;
		box-shadow: var(--pm-shadow);
	}
	.pm-card.shiny::before,
	.pm-card.legendary::before,
	.pm-card.mythic::before {
		content: '';
		position: absolute;
		inset: -3px;
		z-index: -1;
		border: 3px solid transparent;
		border-radius: 19px;
		/* Paper inside, the gradient only in the border: this layer sits above the card's own background. */
		background:
			linear-gradient(var(--pm-paper), var(--pm-paper)) padding-box,
			var(--edge) border-box;
	}
	.pm-card.legendary {
		--edge: linear-gradient(
			135deg,
			oklch(0.9 0.1 92),
			oklch(0.66 0.13 68) 22%,
			oklch(0.95 0.07 95) 42%,
			oklch(0.6 0.12 62) 62%,
			oklch(0.88 0.12 88) 82%,
			oklch(0.68 0.13 70)
		);
		box-shadow: var(--pm-shadow), 0 0 14px -2px oklch(0.8 0.14 80 / 0.55);
	}
	.pm-card.legendary::before {
		inset: -4px;
		border-width: 4px;
		border-radius: 20px;
	}
	.pm-card.mythic {
		--edge: linear-gradient(135deg, oklch(0.75 0.15 330), oklch(0.82 0.09 280) 35%, oklch(0.8 0.1 220) 65%, oklch(0.72 0.16 320));
	}
	.pm-card.shiny {
		--edge: var(--pm-foil-edge);
	}
	.pm-card.shiny::before {
		inset: -3px;
		border-width: 3px;
		border-radius: 19px;
	}
	.art {
		position: relative;
		aspect-ratio: 1;
		overflow: hidden;
		border-radius: 12px;
		background-color: var(--pm-cream);
	}
	.sprite {
		position: absolute;
		inset: 0;
		background-size: 88%;
		background-position: center;
		background-repeat: no-repeat;
	}
	.shiny .art {
		background: radial-gradient(circle at 50% 55%, oklch(0.995 0.002 260), oklch(0.96 0.005 260) 60%, oklch(0.93 0.008 260));
	}
	/* Quiet cards: a still wash in the art, in the colours of what the full card shows. */
	.quiet.shiny .art {
		background: linear-gradient(
			115deg,
			oklch(0.98 0.015 85),
			oklch(0.975 0.015 350),
			oklch(0.975 0.015 250),
			oklch(0.98 0.015 160)
		);
	}
	.quiet.legendary:not(.shiny) .art {
		background: radial-gradient(circle at 50% 55%, oklch(0.94 0.09 90), oklch(0.93 0.04 80) 70%);
	}
	.quiet.mythic:not(.shiny) .art {
		background: radial-gradient(circle at 50% 55%, oklch(0.94 0.05 320), oklch(0.93 0.04 260) 70%);
	}
	.locked .sprite {
		filter: brightness(0);
		opacity: 0.55;
	}
	.locked .name {
		color: var(--pm-ink-soft);
	}
	.number,
	.count {
		position: absolute;
		top: 6px;
		font-size: 13px;
		font-weight: 700;
		color: var(--pm-ink-soft);
	}
	.number {
		left: 8px;
	}
	.count {
		right: 6px;
		padding: 0 7px;
		border-radius: 999px;
		background: var(--pm-paper);
		color: var(--pm-ink);
	}
	.name {
		margin: 8px 2px 6px;
		font-family: var(--pm-display);
		font-size: 17px;
		line-height: 1.1;
		text-align: center;
		text-transform: capitalize;
		overflow-wrap: anywhere;
	}
	.types {
		display: flex;
		justify-content: center;
		flex-wrap: wrap;
		gap: 4px;
	}
	.type {
		padding: 2px 8px;
		border-radius: 999px;
		background: var(--type, oklch(0.6 0.02 265));
		color: var(--type-text, var(--pm-paper));
		font-size: 12px;
		font-weight: 700;
		text-transform: capitalize;
	}
	/* Shiny, legendary and mythic sit with the types, each in its own colour. */
	.shiny-badge {
		background: var(--pm-gold);
		color: var(--pm-ink);
	}
	.legendary-badge {
		background: linear-gradient(135deg, oklch(0.58 0.12 68), oklch(0.47 0.1 62));
		color: oklch(0.97 0.04 90);
	}
	.mythic-badge {
		background: oklch(0.52 0.17 330);
		color: var(--pm-paper);
	}

	@media (max-width: 480px) {
		.pm-card {
			width: var(--card-width, 104px);
			padding: 6px 6px 8px;
		}
		.name {
			font-size: 15px;
		}
	}
</style>
