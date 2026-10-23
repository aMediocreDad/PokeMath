<script>
	// One Pokémon card, used under the game and in the Pokédex. Shiny, legendary and mythic cards
	// get a coloured edge and a small label, so the rarity does not depend on colour alone. Shiny
	// cards are foiled like trading cards: a rainbow foil behind the Pokémon, a glare sweeping over
	// it, and a rainbow edge. Each card starts the sweep at its own moment, so a row of shinies
	// does not flash in unison.
	/** @type {{ card: import('#lib/game/pokemon.js').PokemonCard, count: number }} */
	let { card, count } = $props();

	const RARITY_LABEL = { legendary: 'Legendarisk', mythic: 'Mytisk' };
</script>

<a
	id={card.entry}
	class="pm-card"
	class:shiny={card.shiny}
	class:legendary={card.rarity === 'legendary'}
	class:mythic={card.rarity === 'mythic'}
	href="./pokeviewer.html?pokemonId={card.id}"
	target="_blank"
>
	<div class="art" style:--phase="{-((card.id * 0.37) % 6)}s">
		{#if card.shiny}<span class="foil" aria-hidden="true"></span>{/if}
		<span class="sprite" style="background-image: url('{card.image}');"></span>
		{#if card.shiny}<span class="glare" aria-hidden="true"></span>{/if}
		<span class="number">#{card.cardId}</span>
		<span class="count card-counter">x{count}</span>
		{#if card.shiny || card.rarity}
			<span class="tag">{card.shiny ? '✨ Shiny' : ''}{card.shiny && card.rarity ? ' · ' : ''}{card.rarity ? RARITY_LABEL[card.rarity] : ''}</span>
		{/if}
	</div>
	<div class="name">{card.name}</div>
	<div class="types">
		{#each card.types as type, i (i)}<span class="type t-{type.toLowerCase()}">{type}</span>{/each}
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
	.pm-card:active {
		transform: scale(0.97);
	}
	.pm-card.legendary {
		box-shadow: var(--pm-shadow), 0 0 0 3px oklch(0.72 0.12 75);
	}
	.pm-card.mythic {
		box-shadow: var(--pm-shadow), 0 0 0 3px oklch(0.66 0.16 330);
	}
	/* The foil edge wins over the legendary and mythic rings; the tag still names both. */
	.pm-card.shiny {
		position: relative;
		isolation: isolate;
		box-shadow: var(--pm-shadow);
	}
	.pm-card.shiny::before {
		content: '';
		position: absolute;
		inset: -3px;
		z-index: -1;
		border: 3px solid transparent;
		border-radius: 19px;
		/* Paper inside, rainbow only in the border: this layer sits above the card's own background. */
		background:
			linear-gradient(var(--pm-paper), var(--pm-paper)) padding-box,
			linear-gradient(
				135deg,
				oklch(0.85 0.14 85),
				oklch(0.8 0.13 350),
				oklch(0.82 0.11 250),
				oklch(0.86 0.13 160),
				oklch(0.85 0.14 85)
			) border-box;
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
		background-color: oklch(0.94 0.05 90);
	}
	/* Foil and glare are wider than the art and slide with transform, which stays cheap with a
	   full Pokédex of shinies; animating background-position would repaint every card. */
	.foil,
	.glare {
		position: absolute;
		top: 0;
		bottom: 0;
		left: -100%;
		width: 300%;
		pointer-events: none;
	}
	.foil {
		opacity: 0.55;
		background:
			repeating-linear-gradient(115deg, oklch(1 0 0 / 0.35) 0 2px, transparent 2px 7px),
			linear-gradient(
				115deg,
				oklch(0.86 0.12 85),
				oklch(0.82 0.12 350),
				oklch(0.84 0.1 250),
				oklch(0.87 0.12 160),
				oklch(0.86 0.12 85),
				oklch(0.82 0.12 350),
				oklch(0.84 0.1 250)
			);
		animation: foil-drift 9s ease-in-out var(--phase) infinite alternate;
	}
	.glare {
		background: linear-gradient(
			115deg,
			transparent 40%,
			oklch(1 0 0 / 0.55) 48%,
			oklch(1 0 0 / 0.75) 50%,
			oklch(1 0 0 / 0.55) 52%,
			transparent 60%
		);
		transform: translateX(-34%);
		animation: glare-sweep 6s ease-in-out var(--phase) infinite;
	}
	@keyframes foil-drift {
		from { transform: translateX(-30%); }
		to { transform: translateX(30%); }
	}
	@keyframes glare-sweep {
		0% { transform: translateX(-34%); }
		30%,
		100% { transform: translateX(34%); }
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
	.tag {
		position: absolute;
		left: 6px;
		right: 6px;
		bottom: 6px;
		padding: 2px 6px;
		border-radius: 999px;
		background: var(--pm-ink);
		color: var(--pm-paper);
		font-size: 11px;
		font-weight: 700;
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
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

	@media (prefers-reduced-motion: reduce) {
		.foil {
			animation: none;
		}
		.glare {
			display: none;
		}
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
