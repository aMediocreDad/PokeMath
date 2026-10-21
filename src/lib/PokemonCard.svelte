<script>
	// One Pokémon card, used under the game and in the Pokédex. Shiny, legendary and mythic cards
	// get a coloured edge and a small label, so the rarity does not depend on colour alone.
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
	<div class="art" style="background-image: url('{card.image}');">
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
	.pm-card.shiny {
		box-shadow: var(--pm-shadow), 0 0 0 3px var(--pm-gold);
	}
	.pm-card.legendary {
		box-shadow: var(--pm-shadow), 0 0 0 3px oklch(0.72 0.12 75);
	}
	.pm-card.mythic {
		box-shadow: var(--pm-shadow), 0 0 0 3px oklch(0.66 0.16 330);
	}
	.art {
		position: relative;
		aspect-ratio: 1;
		border-radius: 12px;
		background-color: var(--pm-cream);
		background-size: 88%;
		background-position: center;
		background-repeat: no-repeat;
	}
	.shiny .art {
		background-color: oklch(0.95 0.06 90);
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
		/* globalstyle.css pins .card-counter to the bottom corner; the legacy cards still use it. */
		bottom: auto;
		text-shadow: none;
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
	/* Type colours from the games. Light ones get dark text, so every label is readable. */
	.t-normal { --type: #a8a878; }
	.t-fire { --type: #f08030; --type-text: var(--pm-ink); }
	.t-water { --type: #6890f0; }
	.t-grass { --type: #78c850; --type-text: var(--pm-ink); }
	.t-electric { --type: #f8d030; --type-text: var(--pm-ink); }
	.t-ice { --type: #98d8d8; --type-text: var(--pm-ink); }
	.t-fighting { --type: #c03028; }
	.t-poison { --type: #a040a0; }
	.t-ground { --type: #e0c068; --type-text: var(--pm-ink); }
	.t-flying, .t-bird { --type: #a890f0; --type-text: var(--pm-ink); }
	.t-psychic { --type: #f85888; --type-text: var(--pm-ink); }
	.t-bug { --type: #a8b820; --type-text: var(--pm-ink); }
	.t-rock { --type: #b8a038; --type-text: var(--pm-ink); }
	.t-ghost { --type: #705898; }
	.t-dark { --type: #705848; }
	.t-dragon { --type: #7038f8; }
	.t-steel { --type: #b8b8d0; --type-text: var(--pm-ink); }
	.t-fairy { --type: #f0b6bc; --type-text: var(--pm-ink); }

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
