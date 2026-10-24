<script>
	// A Pokémon as a trading card: yellow frame, name and HP across the top, the picture in a framed
	// window, its stats set like attacks (Attack and Defense as normal / special, and Speed), and its
	// Pokédex entry as the flavour text. Like a real card, it is in English. It is the reveal of the Pokédex: the pane beside the list
	// and the viewer show it. A legendary's or mythic's aura sits in the window; a shiny's picture
	// is done like a Shiny Vault card, with a holo shine that is always lit and moves as the card turns.
	// The whole card turns in 3D towards the mouse anywhere on it, or a finger dragged sideways
	// across it, and springs back when let go; with the tilt switched on in the profile (tilt.js),
	// tilting the iPad or phone turns it instead. The light, the sparkles and the shine all move
	// with the turn, not with the pointer. Only this one card turns, never the cards in the list. The
	// technique follows poke-holo.simey.me; no code is taken from it.
	import Aura from '#lib/Aura.svelte';
	import TypeIcon from '#lib/TypeIcon.svelte';
	import { followTilt } from '#lib/tilt.js';

	/**
	 * @type {{
	 *   pokemon: any,
	 *   id: number,
	 *   image: string,
	 *   shiny?: boolean,
	 *   rarity?: '' | 'legendary' | 'mythic',
	 *   stage?: number,
	 *   locked?: boolean
	 * }}
	 */
	let { pokemon, id, image, shiny = false, rarity = '', stage = 0, locked = false } = $props();

	/** @param {any} types */
	const typeList = (types) => (Array.isArray(types) ? types : [types]).map((t) => String(t).toLowerCase());
	const types = $derived(typeList(pokemon.types));
	const STAGES = ['Basic', 'Stage 1', 'Stage 2'];
	const RARITY_MARK = { legendary: '★', mythic: '✦' };
	const metres = (/** @type {number} */ dm) => (dm / 10).toLocaleString('en-GB', { minimumFractionDigits: 1 });
	/** One energy for each 50 of the stronger value, one to four, as a stronger attack costs more. */
	const cost = (/** @type {number[]} */ values) => Math.max(1, Math.min(4, Math.ceil(Math.max(...values.map(Number)) / 50)));
	/** @type {[string, number[]][]} */
	const moves = $derived([
		['Attack', [pokemon.base_atk, pokemon.base_satk]],
		['Defense', [pokemon.base_def, pokemon.base_sdef]],
		['Speed', [pokemon.base_spd]]
	]);
	const holo = $derived(shiny && !locked);
	// A shiny's picture, like a Shiny Vault card: gold four-point sparkles and soft streaks of
	// coloured light behind the Pokémon. Sparkles: x and y of the centre in %, size in % of the
	// window's width, and depth, how far it drifts as the card turns. Streaks shine out from the
	// Pokémon in the middle, all in one pink-to-green gradient: angle, and a shift of its hues.
	const STARS = [[16, 22, 20, 1], [84, 18, 13, 0.6], [80, 70, 22, 1.2], [22, 78, 12, 0.7], [56, 10, 9, 0.4], [92, 46, 8, 0.5], [8, 50, 7, 0.4]];
	const STREAKS = [[-150, 0], [-32, 25], [18, -15], [158, 10], [-100, -25], [118, 20]];
	/** Flat yellow five-point stars, as printed between the sparkles: x, y in %, size in %. */
	const FLAT_STARS = [[44, 8, 7], [12, 64, 8], [70, 90, 6]];

	/** @type {HTMLElement | undefined} */
	let card = $state();
	/** Where the card is turned to (-1 to 1 each way), where the hand wants it, and how fast it is moving. */
	let at = { x: 0, y: 0 };
	let aim = { x: 0, y: 0 };
	let speed = { x: 0, y: 0 };
	let held = false;
	let frame = 0;
	// A loose spring, so the card overshoots a little and settles, like one held in the hand.
	const STIFFNESS = 0.066;
	const DAMPING = 0.25;

	function step() {
		frame = 0;
		if (!card) return;
		let settled = true;
		for (const k of /** @type {const} */ (['x', 'y'])) {
			speed[k] = (speed[k] + (aim[k] - at[k]) * STIFFNESS) * (1 - DAMPING);
			at[k] += speed[k];
			if (Math.abs(aim[k] - at[k]) > 0.002 || Math.abs(speed[k]) > 0.002) settled = false;
		}
		if (settled && !held) {
			// Back at rest: hand the card over to the tilt, if it is on.
			at = { x: 0, y: 0 };
			for (const name of ['--px', '--py']) card.style.removeProperty(name);
			return;
		}
		card.style.setProperty('--px', at.x.toFixed(3));
		card.style.setProperty('--py', at.y.toFixed(3));
		frame = requestAnimationFrame(step);
	}

	$effect(() => {
		if (!card || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const el = card;
		const unfollow = followTilt(el);
		/** @param {PointerEvent} e */
		const move = (e) => {
			const box = el.getBoundingClientRect();
			const across = (/** @type {number} */ v, /** @type {number} */ from, /** @type {number} */ size) => Math.max(-1, Math.min(1, ((v - from) / size) * 2 - 1));
			held = true;
			aim = { x: across(e.clientX, box.left, box.width), y: across(e.clientY, box.top, box.height) };
			frame ||= requestAnimationFrame(step);
		};
		const leave = () => {
			held = false;
			aim = { x: 0, y: 0 };
			frame ||= requestAnimationFrame(step);
		};
		const events = /** @type {const} */ ([['pointermove', move], ['pointerleave', leave], ['pointercancel', leave], ['pointerup', leave]]);
		for (const [type, f] of events) el.addEventListener(type, /** @type {EventListener} */ (f));
		return () => {
			cancelAnimationFrame(frame);
			frame = 0;
			unfollow();
			for (const [type, f] of events) el.removeEventListener(type, /** @type {EventListener} */ (f));
		};
	});
</script>

<div class="stage">
	<div
		bind:this={card}
		data-id={id}
		class="holo-card t-{types[0]}"
		class:locked
		class:holo
		role="img"
		lang="en"
		aria-label={locked ? 'Unknown Pokémon' : `${pokemon.name}${holo ? ', shiny' : ''}`}
	>
		<div class="face">
			<header>
				<span class="stage-label">{STAGES[Math.min(stage, 2)]}</span>
				<span class="card-name">{locked ? '???' : pokemon.name}</span>
				<span class="hp"><small>HP</small>{locked ? '??' : pokemon.base_hp}</span>
				<span class="energy">{#each types as type (type)}<TypeIcon {type} />{/each}</span>
			</header>
			<div class="window">
				{#if holo}
					<span class="vault" aria-hidden="true">
						{#each STREAKS as [angle, shift], i (i)}<span class="streak" style:--angle="{angle}deg" style:--shift={shift}></span>{/each}
						{#each FLAT_STARS as [x, y, size], i (i)}<span class="flat-star" style:--x="{x}%" style:--y="{y}%" style:--size="{size}%"></span>{/each}
						{#each STARS as [x, y, size, depth], i (i)}<span class="star" style:--x={x} style:--y={y} style:--size="{size}%" style:--depth={depth}></span>{/each}
					</span>
				{/if}
				<Aura kind={locked ? '' : rarity}>
					<img src={image} alt="" class="art" class:shadow={locked} />
				</Aura>
				{#if holo}
					<span class="shine" aria-hidden="true"></span>
				{/if}
			</div>
			<p class="strip">
				No. {id}{#if !locked}
					· {pokemon.generation ? pokemon.generation[0].toUpperCase() + pokemon.generation.slice(1) : 'Unknown'}
					{#if pokemon.height}· {metres(pokemon.height)} m{/if}
					{#if pokemon.weight}· {metres(pokemon.weight)} kg{/if}
				{/if}
			</p>
			<div class="moves">
				{#each moves as [label, values] (label)}
					<div class="move">
						<span class="cost">{#each { length: cost(values) }, i (i)}<TypeIcon type={types[0]} />{/each}</span>
						<span class="move-name">{label}</span>
						<span class="move-value">
							{#if locked}??{:else}{values[0]}{#if values.length > 1}<small> / {values[1]}</small>{/if}{/if}
						</span>
					</div>
				{/each}
				<p class="move-key">Normal / special</p>
			</div>
			<p class="flavor">{locked ? 'Catch this Pokémon to learn more about it.' : pokemon.description}</p>
			<footer>
				<span>{types.map((t) => t[0].toUpperCase() + t.slice(1)).join(' / ')}</span>
				<span>{#if !locked && rarity}<span class="mark {rarity}" aria-label={rarity === 'legendary' ? 'Legendary' : 'Mythical'}>{RARITY_MARK[rarity]}</span>{/if}{id}/1025</span>
			</footer>
		</div>
		<span class="glare" aria-hidden="true"></span>
	</div>
</div>

<style>
	/* The card is 63 × 88 like a real one, and everything inside is set in em of a font size tied to
	   the card's width. */
	.stage {
		perspective: 900px;
		width: 100%;
		max-width: 320px;
		margin: 0 auto;
		container-type: inline-size;
		touch-action: pan-y;
	}
	.holo-card {
		/* Turned by the hand (--px, --py) or else the device's tilt (--tilt, --tilt-y). */
		--ax: var(--px, var(--tilt, 0));
		--ay: var(--py, var(--tilt-y, 0));
		/* Where the light falls, in % from the top-left: against the turn. As numbers for the
		   sparkles (--lx, --ly) and as positions (--mx, --my). */
		--lx: calc(50 - var(--ax) * 45);
		--ly: calc(50 - var(--ay) * 45);
		--mx: calc(var(--lx) * 1%);
		--my: calc(var(--ly) * 1%);
		/* Where the shine's patterns sit: a quarter of their range, round the middle. */
		--bgx: calc(50% - var(--ax) * 13%);
		--bgy: calc(50% - var(--ay) * 17%);
		/* How far the card is turned from facing you, 0 to 1. */
		--fc: min(1, var(--ax) * var(--ax) + var(--ay) * var(--ay));
		position: relative;
		aspect-ratio: 63 / 88;
		padding: 4.2%;
		border-radius: 4.5% / 3.2%;
		background: linear-gradient(135deg, oklch(0.9 0.14 98), oklch(0.82 0.15 85) 50%, oklch(0.9 0.13 98));
		box-shadow:
			0 1px 0 oklch(1 0 0 / 0.6) inset,
			calc(var(--ax) * -10px) calc(14px - var(--ay) * 6px) 30px -12px oklch(0.25 0.04 265 / 0.55);
		color: var(--pm-ink);
		/* Text scales with the card; a fixed size where container units are missing (iOS 15). */
		font-size: 14px;
		font-size: 4.6cqw;
		transform: rotateY(calc(var(--ax) * 16deg)) rotateX(calc(var(--ay) * -16deg));
		transform-style: preserve-3d;
		will-change: transform;
		user-select: none;
		-webkit-user-select: none;
	}
	:global(html[data-tilt]) .holo-card {
		transition: transform 120ms ease-out;
	}
	.face {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: 0.5em 0.6em 0.4em;
		overflow: hidden;
		border-radius: 0.6em;
		/* The panel takes its colour from the first type; a plain cream where color-mix is missing. */
		background: oklch(0.95 0.03 85);
		background: linear-gradient(
			170deg,
			color-mix(in oklch, var(--type, #aaa) 45%, white),
			color-mix(in oklch, var(--type, #aaa) 22%, white) 60%,
			color-mix(in oklch, var(--type, #aaa) 40%, white)
		);
		box-shadow: 0 0 0 0.15em oklch(0.7 0.08 85) inset;
	}
	header {
		display: grid;
		grid-template-columns: 1fr auto auto;
		grid-template-areas: 'stage stage stage' 'name hp energy';
		align-items: end;
		column-gap: 0.3em;
	}
	.stage-label {
		grid-area: stage;
		font-size: 0.62em;
		font-weight: 700;
		font-style: italic;
		opacity: 0.75;
	}
	.card-name {
		grid-area: name;
		overflow: hidden;
		font-family: var(--pm-display);
		font-size: 1.45em;
		line-height: 1.05;
		text-overflow: ellipsis;
		text-transform: capitalize;
		white-space: nowrap;
	}
	.hp {
		grid-area: hp;
		font-family: var(--pm-display);
		font-size: 1.3em;
		line-height: 1;
	}
	.hp small {
		margin-right: 0.1em;
		font-size: 0.5em;
	}
	.energy {
		grid-area: energy;
		display: flex;
		gap: 0.15em;
		font-size: 1.05em;
	}
	.window {
		position: relative;
		flex: 1 1 auto;
		min-height: 40%;
		max-height: 52%;
		margin: 0.3em 0 0;
		overflow: hidden;
		border: 0.28em solid transparent;
		border-radius: 0.2em;
		background:
			radial-gradient(circle at 50% 60%, oklch(0.99 0.01 90), oklch(0.92 0.03 85)) padding-box,
			linear-gradient(135deg, oklch(0.93 0.02 90), oklch(0.7 0.03 80), oklch(0.95 0.02 90), oklch(0.68 0.03 80)) border-box;
		box-shadow: 0 0.15em 0.3em oklch(0 0 0 / 0.2);
	}
	/* Pinned to the window's edges: the window's height comes from the flex layout, which a
	   percentage height cannot follow, and the picture would sit at the top and run off the bottom. */
	.art {
		position: absolute;
		inset: 0;
		box-sizing: border-box;
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
		padding: 4%;
		pointer-events: none;
	}
	.art.shadow {
		filter: brightness(0);
		opacity: 0.6;
	}
	.strip {
		margin: 0.25em 0.4em 0;
		padding: 0.12em 0.5em;
		border-radius: 0.2em;
		background: linear-gradient(90deg, oklch(0.85 0.06 85), oklch(0.93 0.05 92), oklch(0.85 0.06 85));
		font-size: 0.6em;
		font-style: italic;
		font-weight: 700;
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.moves {
		margin: 0.3em 0 0;
	}
	.move {
		display: grid;
		grid-template-columns: 4.4em 1fr auto;
		align-items: center;
		padding: 0.2em 0.1em;
		border-bottom: 0.06em solid oklch(0.3 0.03 265 / 0.25);
	}
	.cost {
		display: flex;
		gap: 0.1em;
		font-size: 0.8em;
	}
	.move-name {
		font-family: var(--pm-display);
		font-size: 1.02em;
	}
	.move-value {
		font-family: var(--pm-display);
		font-size: 1.15em;
	}
	.move-value small {
		font-size: 0.8em;
		opacity: 0.75;
	}
	.move-key {
		margin: 0.15em 0 0;
		font-size: 0.5em;
		font-style: italic;
		text-align: right;
		opacity: 0.7;
	}
	.flavor {
		margin: 0.3em 0 0;
		padding: 0.3em 0.5em;
		overflow: hidden;
		border: 0.08em solid oklch(0.7 0.08 85);
		border-radius: 0.2em;
		background: oklch(1 0 0 / 0.35);
		font-size: 0.66em;
		font-style: italic;
		line-height: 1.3;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		line-clamp: 3;
	}
	footer {
		display: flex;
		justify-content: space-between;
		margin-top: auto;
		padding-top: 0.3em;
		font-size: 0.55em;
		font-weight: 700;
		opacity: 0.8;
	}
	.mark {
		margin-right: 0.4em;
		color: oklch(0.55 0.12 70);
	}
	.mark.mythic {
		color: oklch(0.52 0.17 330);
	}
	.locked .face {
		background: oklch(0.9 0.01 265);
	}

	/* A shiny's picture, like a Shiny Vault card. Printed in it: a near-white ground printed with a faint maze, gold four-point sparkles and flat stars, and rays from the Pokémon. Over it, the
	   shine. The real card's ground is silver; this one is whiter by choice, which leaves the
	   colour-dodged shine less to brighten, so it is gentler on the ground than on the Pokémon. */
	.holo .window {
		background:
			url('./assets/holo/maze.svg') center / 7% padding-box,
			radial-gradient(circle at 50% 55%, oklch(0.995 0.008 85), oklch(0.97 0.015 82) 60%, oklch(0.94 0.02 80)) padding-box,
			linear-gradient(135deg, oklch(0.93 0.02 90), oklch(0.7 0.03 80), oklch(0.95 0.02 90), oklch(0.68 0.03 80)) border-box;
	}
	.vault {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	.vault {
		overflow: hidden;
	}
	/* A sparkle flares as the light passes over it: --glint is 1 with the light on it and falls to
	   0 about half the picture away. Where abs() is missing (before iOS 15.4) it stays at rest. */
	.star {
		--glint: 0;
		--glint: clamp(0, 1 - (abs(var(--x) - var(--lx)) + abs(var(--y) - var(--ly))) / 55, 1);
		position: absolute;
		left: calc(var(--x) * 1%);
		top: calc(var(--y) * 1%);
		width: var(--size);
		aspect-ratio: 1;
		translate: calc(-50% + var(--ax) * var(--depth) * -8px) calc(-50% + var(--ay) * var(--depth) * -8px);
		scale: calc(0.8 + var(--glint) * 0.55);
	}
	/* The glow, and the star itself as thin rays drawn on top. */
	.star::before,
	.star::after {
		content: '';
		position: absolute;
		inset: 0;
	}
	.star::before {
		inset: -30%;
		border-radius: 50%;
		background: radial-gradient(closest-side, oklch(1 0 0), oklch(0.97 0.08 95 / 0.95) 12%, oklch(0.88 0.17 90 / 0.7) 32%, oklch(0.85 0.17 85 / 0) 100%);
		opacity: calc(0.45 + var(--glint) * 0.55);
	}
	.star::after {
		background: radial-gradient(closest-side, oklch(1 0 0) 20%, oklch(0.9 0.19 92) 55%, oklch(0.8 0.18 78) 100%);
		clip-path: polygon(50% 0, 56% 44%, 100% 50%, 56% 56%, 50% 100%, 44% 56%, 0 50%, 44% 44%);
	}
	.flat-star {
		position: absolute;
		left: var(--x);
		top: var(--y);
		width: var(--size);
		aspect-ratio: 1;
		translate: -50% -50%;
		background: oklch(0.89 0.18 98);
		clip-path: polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
	}
	/* A ray from the Pokémon at the middle out past the window's edge, clear where it starts so it
	   seems to come from behind the Pokémon. */
	.streak {
		position: absolute;
		left: 50%;
		top: 55%;
		width: 80%;
		height: 2.4%;
		border-radius: 50%;
		background: linear-gradient(
			90deg,
			transparent 18%,
			oklch(0.7 0.21 calc(350 + var(--shift)) / 0.9) 32%,
			oklch(0.76 0.19 calc(40 + var(--shift))) 47%,
			oklch(0.86 0.17 calc(95 + var(--shift))) 62%,
			oklch(0.78 0.19 calc(150 + var(--shift)) / 0.8) 78%,
			transparent
		);
		filter: blur(0.5px);
		/* Present but quiet, so the Pokémon stays the first thing seen. */
		opacity: 0.55;
		transform-origin: 0 50%;
		translate: calc(var(--ax) * -5px) calc(-50% + var(--ay) * -5px);
		rotate: var(--angle);
	}
	/* The shine, the way holo trading-card effects are commonly built (the technique after
	   poke-holo.simey.me; no code taken). One layer stacks four patterns: fine etched rings round the Pokémon,
	   a rainbow of vertical sun pillars, dark diagonal bands with one bright stripe, and a soft
	   darkening round the light. Blended into each other (soft-light, hue, hard-light) they make
	   coloured stripes on dark; contrast and saturation push them, and the layer is colour-dodged
	   onto the picture, where dark leaves it alone and colour blows out bright. A mirrored copy
	   is combined by exclusion, and a white spot overlays the light. The patterns move through
	   only a quarter of their range (--bgx, --bgy) as the card turns. The shine is always lit; at
	   rest the light sits in the middle. */
	.shine,
	.shine::before,
	.shine::after {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	.shine {
		--rainbow: oklch(0.8 0.18 25), oklch(0.9 0.16 100), oklch(0.88 0.18 140), oklch(0.9 0.12 195), oklch(0.78 0.15 270),
			oklch(0.76 0.19 320);
		background-image:
			repeating-radial-gradient(circle at 50% 55%, oklch(0.95 0 0) 0 0.6px, oklch(0.4 0 0) 0.6px 2px),
			repeating-linear-gradient(0deg, var(--rainbow), oklch(0.8 0.18 25) 32%),
			repeating-linear-gradient(
				130deg,
				oklch(0.2 0.04 265) 0%,
				oklch(0.66 0.02 200) 3.6%,
				oklch(0.76 0.06 195) 4.4%,
				oklch(0.66 0.02 200) 5.2%,
				oklch(0.2 0.04 265) 9.6%,
				oklch(0.2 0.04 265) 12%
			),
			radial-gradient(
				farthest-corner circle at var(--mx) var(--my),
				oklch(0 0 0 / 0.1) 12%,
				oklch(0 0 0 / 0.15) 20%,
				oklch(0 0 0 / 0.25) 120%
			);
		background-size: auto, 200% 700%, 300% 100%, 200% 100%;
		background-position:
			0 0,
			0% var(--bgy),
			calc(var(--bgx) + var(--bgy) * 0.2) var(--bgy),
			var(--bgx) var(--bgy);
		background-blend-mode: soft-light, hue, hard-light;
		filter: brightness(calc(var(--fc) * 0.4 + 0.45)) contrast(1.5) saturate(2.2);
		mix-blend-mode: color-dodge;
	}
	/* The mirrored copy: the same patterns running the other way, so the stripes cross and shift. */
	.shine::after {
		content: '';
		background: inherit;
		background-size: auto, 200% 400%, 200% 100%, 200% 100%;
		background-position:
			0 0,
			0% calc(100% - var(--bgy)),
			calc(100% - var(--bgx) - var(--bgy) * 0.2) calc(100% - var(--bgy)),
			var(--bgx) var(--bgy);
		background-blend-mode: soft-light, hue, hard-light;
		filter: brightness(calc(var(--fc) * 0.4 + 0.8)) contrast(1.5) saturate(1.3);
		mix-blend-mode: exclusion;
	}
	.shine::before {
		content: '';
		z-index: 1;
		background: radial-gradient(farthest-corner circle at var(--mx) var(--my), oklch(1 0 0), oklch(0 0 0 / 0) 40%);
		mix-blend-mode: overlay;
		opacity: 0.75;
	}

	/* The light on the whole card: bright where it falls, dimming a little towards the far side,
	   multiplied in, so the card darkens slightly away from the light. It shows the more the card is turned. */
	.glare {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: radial-gradient(farthest-corner circle at var(--mx) var(--my), oklch(1 0 0), oklch(0.68 0.01 330) 150%);
		mix-blend-mode: multiply;
		filter: brightness(1.15) saturate(0.7);
		opacity: calc(var(--fc) * 0.72);
		pointer-events: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.holo-card {
			transform: none;
		}
		.glare {
			opacity: 0.25;
		}
	}
</style>
