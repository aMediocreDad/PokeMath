<script>
	// One Pokémon card, the markup loadFromList() in static/pokestuff.js builds.
	/** @type {{ card: import('#lib/game/pokemon.js').PokemonCard, count: number, show?: boolean }} */
	let { card, count, show = false } = $props();
</script>

<a
	id={card.entry}
	class="column is-narrow {card.filterText}"
	class:show
	style="cursor: pointer;"
	href="./pokeviewer.html?pokemonId={card.id}"
	target="_blank"
>
	<div class="card {card.shiny ? 'pokemon-shiny' : ''} {card.rarity}">
		<div class="card-content">
			<div class="has-text-centered card-image">
				<div class="card-image" style="background-image: url('{card.image}');"></div>
				<div class="card-id">#{card.cardId}</div>
				<div id="cardcounter" class="card-counter">x{count}</div>
			</div>
			<div class="card-footer">
				<p class="card-footer-item">
					<strong style="text-transform: capitalize;">{card.name}&nbsp;</strong>
				</p>
			</div>
			<footer class="card-footer">
				<p class="card-footer-item" style="text-transform: capitalize;">
					{#each card.types as type, i (i)}<span class="typecard type-{type}">{type}</span>{/each}
				</p>
			</footer>
		</div>
	</div>
</a>

<style>
	/* Phones: slightly smaller cards, so three fit in a row instead of two. */
	@media (max-width: 480px) {
		.card {
			max-width: 104px;
			margin-left: 3px;
			margin-right: 3px;
		}
		.card-image,
		.card-image .card-image {
			width: 104px;
			height: 104px;
		}
		.card-footer-item {
			font-size: 14px;
		}
	}
</style>
