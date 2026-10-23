<script>
	// Secret codes, ported from static/redeem.html and redeem.js. The server checks the code and
	// says what it gives; each code can be used once per device.
	import { player } from '#lib/player.svelte.js';
	import { notify } from '#lib/toast.svelte.js';
	import { giveSpecificPokemon } from '#lib/game/prizes.js';
	import Fireworks from '#lib/Fireworks.svelte';

	const LEGENDARIES = [144, 145, 146, 150, 243, 244, 245, 249, 250, 377, 378, 379, 380, 381, 382, 383, 384,
		480, 481, 482, 483, 484, 485, 486, 487, 488, 638, 639, 640, 641, 642, 643, 644, 645, 646, 716, 717, 718,
		772, 773, 785, 786, 787, 788, 789, 790, 791, 792, 800, 888, 889, 890, 891, 892, 894, 895, 896, 897, 898,
		905, 1001, 1002, 1003, 1004, 1007, 1008];
	const MYTHICS = [151, 251, 385, 386, 489, 490, 491, 492, 493, 494, 647, 648, 649, 719, 720, 721,
		801, 802, 807, 808, 809, 893];

	let code = $state('');
	let response = $state('');
	/** The code worked: the answer shows in green. */
	let responseGood = $state(false);
	let fireworks = $state(0);

	async function checkCode() {
		responseGood = false;
		const trimmed = code.trim();
		if (!trimmed) {
			response = 'Skriv inn en kode først.';
			return;
		}
		const storageKey = 'redeemed_' + trimmed.toLowerCase();
		if (localStorage.getItem(storageKey)) {
			response = 'Du har allerede brukt denne koden!';
			return;
		}
		response = 'Sjekker koden …';
		let data;
		try {
			const r = await fetch('/redeem', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code: trimmed })
			});
			data = await r.json();
		} catch {
			response = 'Nettverksfeil - sjekk internettforbindelsen og prøv igjen.';
			return;
		}
		if (!data.ok) {
			response = data.message || 'Ugyldig kode!';
			return;
		}
		localStorage.setItem(storageKey, '1');
		applyPrize(data.prize);
		response = 'Koden ble brukt!';
		responseGood = true;
		code = '';
	}

	/** @param {number[]} list */
	const pick = (list) => list[Math.floor(Math.random() * list.length)];

	/**
	 * applyRedeemPrize() from redeem.js.
	 * @param {{ type?: string, value?: string | number, label?: string, image?: string }} prize
	 */
	function applyPrize(prize) {
		const value = prize.value || '';
		const label = prize.label || 'Premie!';
		/** @param {string} fallback */
		const image = (fallback) => prize.image || fallback || 'images/logo.png';

		switch (prize.type || 'message') {
			case 'coins':
				notify(image('images/events/christmas/14.png'), label);
				player.addMoney(Number(value) || 0);
				break;
			case 'pokemon': {
				const entry = String(value || '');
				const folder = /^S/i.test(entry) ? 'shiny' : 'normal';
				const baseId = Number(entry.replace(/^[NS]/i, '').split('-')[0]);
				notify(image(`images/pokemon/${folder}/${baseId}.webp`), label);
				if (entry) giveSpecificPokemon(entry);
				break;
			}
			case 'random_legendary': {
				const id = pick(LEGENDARIES);
				notify(image(`images/pokemon/normal/${id}.webp`), label);
				giveSpecificPokemon('N' + id);
				break;
			}
			case 'random_mythic': {
				const id = pick(MYTHICS);
				notify(image(`images/pokemon/normal/${id}.webp`), label);
				giveSpecificPokemon('N' + id);
				break;
			}
			case 'random_shiny': {
				const id = Math.floor(Math.random() * 1008) + 1;
				notify(image(`images/pokemon/shiny/${id}.webp`), label);
				giveSpecificPokemon('S' + id);
				break;
			}
			case 'random_shiny_mythic': {
				const id = pick(MYTHICS);
				notify(image(`images/pokemon/shiny/${id}.webp`), label);
				giveSpecificPokemon('S' + id);
				break;
			}
			case 'stardust':
				player.shinyBaitCount += Math.max(1, Number(value) || 1);
				player.save('shinyBait');
				notify(image('images/stardust.png'), label);
				break;
			case 'background':
				if (value && !player.boughtBackgrounds.includes(String(value))) {
					player.boughtBackgrounds.push(String(value));
					player.save('background');
				}
				notify(image('images/logo.png'), label);
				break;
			case 'character':
				if (value && !player.boughtPlayerIcons.includes(String(value))) {
					player.boughtPlayerIcons.push(String(value));
					player.save('playerIcon');
				}
				notify(image('images/logo.png'), label);
				break;
			case 'fireworks':
				notify(image('images/logo.png'), label);
				fireworks++;
				break;
			default:
				notify(image('images/logo.png'), label);
		}
	}
</script>

<svelte:head>
	<title>Pokémath - Koder</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="main pm-page redeem">
	<section class="code-card pm-surface">
		<h1 class="pm-title">Har du en kode?</h1>
		<p class="lead">Skriv den inn her for å få mynter, Pokémon eller andre premier. Hver kode virker én gang.</p>
		<form id="redemptionForm" onsubmit={(e) => e.preventDefault()}>
			<input
				type="text"
				id="secretCodeInput"
				autocomplete="off"
				autocapitalize="characters"
				spellcheck="false"
				placeholder="KODE"
				aria-label="Kode"
				bind:value={code}
				onkeydown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						checkCode();
					}
				}}
			/>
			<button type="button" class="pm-button" onclick={checkCode}>Aktiver</button>
		</form>
		<p id="response" class:good={responseGood} aria-live="polite">{response}</p>
	</section>
	<!-- Each fireworks code adds three more, as on the legacy page. -->
	{#each { length: fireworks }, i (i)}
		<Fireworks />
	{/each}
</div>

<style>
	.code-card {
		max-width: 560px;
		margin: 24px auto 0;
		padding: 28px 24px 22px;
		text-align: center;
	}
	.lead {
		margin: -8px 0 20px;
		color: var(--pm-ink-soft);
		line-height: 1.45;
	}
	#redemptionForm {
		display: flex;
		gap: 10px;
	}
	/* 16px or larger, or iOS zooms the page when the field is focused. */
	#secretCodeInput {
		flex: 1;
		min-width: 0;
		height: 52px;
		padding: 0 16px;
		border: 3px solid var(--pm-ink);
		border-radius: 14px;
		background: var(--pm-paper);
		color: var(--pm-ink);
		font-family: var(--pm-display);
		font-size: 24px;
		letter-spacing: 0.08em;
		text-align: center;
		text-transform: uppercase;
		outline: none;
	}
	#secretCodeInput::placeholder {
		color: var(--pm-line);
	}
	#response {
		min-height: 1.5em;
		margin: 14px 0 0;
		color: var(--pm-red-deep);
		font-weight: 700;
	}
	#response.good {
		color: var(--pm-green-deep);
	}
</style>
