<script>
	// A Pokémon as a trading card: yellow frame, name and HP across the top, the picture in a framed
	// window, its stats set like attacks (Attack and Defense as normal / special, and Speed), and its
	// Pokédex entry as the flavour text. Like a real card, it is in English. It is the reveal of the Pokédex: the pane beside the list
	// and the viewer show it. A legendary's or mythic's aura sits in the window; a shiny's picture
	// is done like a Shiny Vault card: silver, gold sparkles, rainbow etching.
	// The whole card turns in 3D towards the mouse anywhere on it, or a finger dragged sideways
	// across it, and springs back when let go; with the tilt switched on in the profile (tilt.js),
	// tilting the iPad or phone turns it instead. The light, the sparkles and the etching all move
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
	// window's width, and depth, how far it drifts as the card turns. Streaks: start in %, angle
	// and hue.
	const STARS = [[16, 22, 20, 1], [84, 18, 13, 0.6], [80, 70, 22, 1.2], [22, 78, 12, 0.7], [56, 10, 9, 0.4], [92, 46, 8, 0.5], [8, 50, 7, 0.4]];
	const STREAKS = [[-10, 30, 18, 20], [60, 85, -24, 60], [55, 15, 28, 340], [-5, 75, -12, 30]];

	/** @type {HTMLElement | undefined} */
	let card = $state();
	/** Where the card is turned to, -1 to 1 each way, and where the hand wants it. */
	let at = { x: 0, y: 0 };
	let aim = { x: 0, y: 0 };
	let held = false;
	let frame = 0;

	// Each frame the card closes part of the gap to where the hand is, so it eases in and springs
	// back rather than snapping.
	function step() {
		frame = 0;
		if (!card) return;
		at = { x: at.x + (aim.x - at.x) * 0.14, y: at.y + (aim.y - at.y) * 0.14 };
		const settled = Math.abs(aim.x - at.x) < 0.002 && Math.abs(aim.y - at.y) < 0.002;
		if (settled && !held) {
			// Back at rest: hand the card over to the tilt, if it is on.
			card.style.removeProperty('--px');
			card.style.removeProperty('--py');
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
						{#each STREAKS as [x, y, angle, hue], i (i)}<span class="streak" style:--x="{x}%" style:--y="{y}%" style:--angle="{angle}deg" style:--hue={hue}></span>{/each}
						{#each STARS as [x, y, size, depth], i (i)}<span class="star" style:--x="{x}%" style:--y="{y}%" style:--size="{size}%" style:--depth={depth}></span>{/each}
					</span>
				{/if}
				<Aura kind={locked ? '' : rarity}>
					<img src={image} alt="" class="art" class:shadow={locked} />
				</Aura>
				{#if holo}
					<span class="etch" aria-hidden="true"></span>
					<span class="sheen" aria-hidden="true"></span>
					<span class="pearl" aria-hidden="true"></span>
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

	/* A shiny's picture, like a Shiny Vault card: a white ground engraved with a faint zig-zag,
	   gold four-point sparkles and soft coloured streaks behind the Pokémon, and over everything
	   a fine etching of rings in gold and pearl that shift as the card turns. A soft band of light
	   crosses with the turn, with a pearly glow where the light falls while the card is turned.
	   Everything takes its place from the turn (--ax, --ay), so it moves with the card wherever
	   the pointer is. */
	.holo .window {
		background:
			repeating-linear-gradient(60deg, oklch(0.75 0.04 85 / 0.09) 0 1px, transparent 1px 5px) padding-box,
			repeating-linear-gradient(-60deg, oklch(0.75 0.04 85 / 0.09) 0 1px, transparent 1px 5px) padding-box,
			radial-gradient(circle at 50% 55%, oklch(1 0 0), oklch(0.98 0.01 95) 60%, oklch(0.93 0.025 90)) padding-box,
			linear-gradient(135deg, oklch(0.93 0.02 90), oklch(0.7 0.03 80), oklch(0.95 0.02 90), oklch(0.68 0.03 80)) border-box;
	}
	.vault,
	.etch {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	/* The light catching the foil: a soft white-gold band, and a pearly glow where the light
	   falls. Both are layers three times the window's size that slide with transform as the card
	   turns, so no edge of them ever crosses the picture. The pearl shows only while the card is
	   turned, the more the further; at rest it is gone. */
	.sheen,
	.pearl {
		position: absolute;
		top: -100%;
		left: -100%;
		width: 300%;
		height: 300%;
		pointer-events: none;
	}
	.sheen {
		background: linear-gradient(
			115deg,
			transparent 40%,
			oklch(0.97 0.06 90 / 0.35) 46%,
			oklch(1 0.02 95 / 0.75) 49.5%,
			oklch(1 0.02 95 / 0.75) 50.5%,
			oklch(0.97 0.06 90 / 0.35) 54%,
			transparent 60%
		);
		mix-blend-mode: screen;
		opacity: calc(0.45 + (var(--ax) * var(--ax) + var(--ay) * var(--ay)) * 0.4);
		transform: translate(calc(-12% - var(--ax) * 18%), calc(-8% - var(--ay) * 12%));
	}
	/* Pearl: a white centre with faint pastel rings round it, like light on mother-of-pearl. It
	   sits where the glare does on the card. Pastels over white show only as plain paint, so it is
	   not blended, and it is kept faint. */
	.pearl {
		background: radial-gradient(
			circle at 50% 50%,
			oklch(1 0 0 / 0.4),
			oklch(0.94 0.05 340 / 0.3) 4%,
			oklch(0.95 0.05 80 / 0.26) 7%,
			oklch(0.95 0.05 165 / 0.24) 10%,
			oklch(0.94 0.05 250 / 0.2) 13%,
			oklch(0.94 0.05 300 / 0.12) 16%,
			transparent 21%
		);
		opacity: calc((var(--ax) * var(--ax) + var(--ay) * var(--ay)) * 1.2);
		transform: translate(calc(var(--ax) * -15%), calc(var(--ay) * -15%));
	}
	.vault {
		overflow: hidden;
	}
	.star {
		position: absolute;
		left: var(--x);
		top: var(--y);
		width: var(--size);
		aspect-ratio: 1;
		translate: calc(-50% + var(--ax) * var(--depth) * -8px) calc(-50% + var(--ay) * var(--depth) * -8px);
	}
	/* The glow, and the star itself as thin rays drawn on top. */
	.star::before,
	.star::after {
		content: '';
		position: absolute;
		inset: 0;
	}
	.star::before {
		inset: 15%;
		border-radius: 50%;
		background: radial-gradient(closest-side, oklch(0.92 0.15 95 / 0.8), oklch(0.85 0.15 85 / 0) 100%);
	}
	.star::after {
		background: radial-gradient(closest-side, oklch(1 0.02 95), oklch(0.88 0.17 92) 45%, oklch(0.8 0.16 80) 100%);
		clip-path: polygon(50% 0, 56% 44%, 100% 50%, 56% 56%, 50% 100%, 44% 56%, 0 50%, 44% 44%);
	}
	.streak {
		position: absolute;
		left: var(--x);
		top: var(--y);
		width: 75%;
		height: 3%;
		border-radius: 50%;
		background: linear-gradient(90deg, transparent, oklch(0.75 0.15 var(--hue) / 0.75) 45%, oklch(0.9 0.08 var(--hue) / 0.9) 55%, transparent);
		filter: blur(1px);
		rotate: var(--angle);
		translate: calc(var(--ax) * -5px) calc(var(--ay) * -5px);
	}
	/* Fine rings, centred on the Pokémon, cut out of a rainbow that slides with the turn. */
	.etch {
		background: linear-gradient(
				115deg,
				oklch(0.92 0.1 95),
				oklch(0.82 0.13 80),
				oklch(0.97 0.03 100),
				oklch(0.84 0.08 340),
				oklch(0.86 0.12 85),
				oklch(0.92 0.1 95)
			)
			calc(50% - var(--ax) * 45%) calc(50% - var(--ay) * 40%) / 300% 300% no-repeat;
		-webkit-mask-image: repeating-radial-gradient(circle at 50% 55%, black 0 0.8px, transparent 0.8px 2.6px);
		mask-image: repeating-radial-gradient(circle at 50% 55%, black 0 0.8px, transparent 0.8px 2.6px);
		mix-blend-mode: overlay;
		opacity: calc(0.55 + (var(--ax) * var(--ax) + var(--ay) * var(--ay)) * 0.4);
	}

	/* The light on the card: a soft spot that follows the turn, brightest when turned furthest. It
	   sits over the whole card, frame and all. The light shines straight at the card, so like a
	   reflection in a tilted mirror it moves the opposite way to the turn: turn the right edge
	   away and the light slides left. The band of light and the pearl do the same. */
	.glare {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: radial-gradient(
			farthest-corner circle at calc(50% - var(--ax) * 45%) calc(50% - var(--ay) * 45%),
			oklch(1 0 0 / 0.55),
			oklch(1 0 0 / 0.12) 30%,
			oklch(0 0 0 / 0.12) 85%
		);
		mix-blend-mode: overlay;
		opacity: calc(0.25 + (var(--ax) * var(--ax) + var(--ay) * var(--ay)) * 0.6);
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
