<script>
	// The prize reveal after a bingo game, ported from the lootbox in static/pokestuff.js.
	// Shows one spinning ball per prize; it opens on a tap or after 2.5 seconds.

	import { pokemonInfo } from '#lib/game/pokemon.js';

	/** @type {{ prizes: import('#lib/bingo.js').Prize[], onDone: () => void }} */
	let { prizes, onDone } = $props();

	let index = $state(0);
	let revealed = $state(false);
	let flashing = $state(false);
	/** @type {ReturnType<typeof setTimeout> | undefined} */
	let autoOpen;

	const prize = $derived(prizes[index]);

	$effect(() => {
		// Restart the timer for each new prize.
		void index;
		revealed = false;
		autoOpen = setTimeout(reveal, 2500);
		return () => clearTimeout(autoOpen);
	});

	function reveal() {
		if (revealed || flashing) return;
		clearTimeout(autoOpen);
		flashing = true;
		setTimeout(() => {
			flashing = false;
			revealed = true;
		}, 400);
	}

	function next() {
		if (index + 1 < prizes.length) index++;
		else onDone();
	}

	const display = $derived.by(() => {
		if (!prize) return null;
		if (prize.type === 'coins') {
			const amount = Number(prize.amount) || 0;
			return {
				image: '/images/coinbag.svg',
				plainImage: true,
				lines: [
					(prize.source === 'admin' ? 'Gave fra admin: ' : prize.source === 'line' ? `Bingo! ${prize.label || 'En rad'} er full: ` : prize.source === 'raid' ? 'Raid: ' : '') +
						'+' +
						amount.toLocaleString('no-NO') +
						' mynter!'
				],
				small: prize.participationPot
					? 'Pott: ' + Number(prize.participationPot).toLocaleString('no-NO') + ' mynter totalt'
					: ''
			};
		}
		if (prize.type === 'pokemon') {
			const shiny = prize.shiny || (prize.entry || '').startsWith('S');
			// A form such as N667-U1 shows that form's image and name.
			const forms = pokemonInfo()?.[String(prize.pokedexId)];
			const variantKey = (prize.entry || '').match(/^[SN]?\d+[-_](\w+)$/)?.[1];
			const variant = variantKey ? forms?.[variantKey] : undefined;
			const imageId = variant?.imageid || prize.pokedexId;
			const name = prize.easterName || variant?.name || forms?.['0']?.name || 'Pokémon #' + prize.pokedexId;
			const source = prize.source === 'admin' ? 'Gave fra admin:' : prize.source === 'easter' ? 'Eventpremie!' : 'Bingo-premie!';
			const kind =
				prize.source === 'admin' || prize.source === 'easter'
					? shiny ? 'Shiny ' : ''
					: shiny ? '✨ Shiny ' : prize.legendary ? '⭐ Legendarisk ' : '🌟 Mytisk ';
			return {
				image: `/images/pokemon/${shiny ? 'shiny' : 'normal'}/${imageId}.webp`,
				plainImage: false,
				lines: [source, kind + name],
				small: prize.easterCoins ? '+' + Number(prize.easterCoins).toLocaleString('no-NO') + ' mynter' : ''
			};
		}
		if (prize.type === 'stardust') {
			return {
				image: '/images/stardust.png',
				plainImage: true,
				lines: [prize.source === 'admin' ? 'Gave fra admin:' : 'Bingo-premie!', '✨ Stardust ×' + (Number(prize.amount) || 1)],
				small: ''
			};
		}
		return { image: '', plainImage: false, lines: [], small: '' };
	});
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div id="bingo-lootbox-overlay" class:flash={flashing} onclick={() => (revealed ? next() : reveal())}>
	{#if !revealed && !flashing}
		<div class="blootbox-ball"></div>
		<div class="blootbox-tap">Trykk for å åpne...</div>
	{:else if revealed && display}
		<div class="blootbox-prize">
			<img src={display.image} alt="" style:filter={display.plainImage ? 'none' : null} />
			<div class="blootbox-label">
				{#each display.lines as line, i (i)}{#if i > 0}<br />{/if}{line}{/each}
				{#if display.small}<br /><span class="small">{display.small}</span>{/if}
			</div>
		</div>
		<div class="blootbox-tap">Trykk for å lukke</div>
	{/if}
</div>

<style>
	#bingo-lootbox-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.82);
		z-index: 99999;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-direction: column;
		animation: fade-in 0.3s ease;
	}
	#bingo-lootbox-overlay.flash {
		animation: flash 0.4s ease;
	}
	@keyframes fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}
	@keyframes spin {
		0% { transform: rotate(0deg) scale(1); }
		50% { transform: rotate(180deg) scale(1.15); }
		100% { transform: rotate(360deg) scale(1); }
	}
	@keyframes reveal {
		0% { opacity: 0; transform: scale(0.4) translateY(30px); }
		60% { transform: scale(1.1) translateY(-5px); }
		100% { opacity: 1; transform: scale(1) translateY(0); }
	}
	@keyframes flash {
		0%, 100% { background: rgba(0, 0, 0, 0.82); }
		50% { background: rgba(255, 255, 255, 0.95); }
	}
	.blootbox-ball {
		width: 110px;
		height: 110px;
		border-radius: 50%;
		background: linear-gradient(180deg, #cc1a1a 50%, #fff 50%);
		border: 5px solid #222;
		box-shadow: 0 0 40px rgba(204, 26, 26, 0.6), inset 0 -4px 8px rgba(0, 0, 0, 0.3);
		position: relative;
		animation: spin 1.2s ease-in-out;
	}
	.blootbox-ball::after {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: #fff;
		border: 5px solid #222;
		box-shadow: 0 0 0 3px #fff;
	}
	.blootbox-prize {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		animation: reveal 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
	}
	.blootbox-prize img {
		width: 200px;
		height: 200px;
		image-rendering: pixelated;
		filter: drop-shadow(0 4px 24px rgba(255, 220, 50, 0.9));
	}
	.blootbox-label {
		color: #fff;
		font-size: 1.4em;
		font-weight: 800;
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.7);
		text-align: center;
		max-width: 320px;
	}
	.small {
		font-size: 0.7em;
		opacity: 0.75;
	}
	.blootbox-tap {
		color: rgba(255, 255, 255, 0.55);
		font-size: 0.9em;
		margin-top: 20px;
	}
</style>
