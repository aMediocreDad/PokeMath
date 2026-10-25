<script>
	// The aura of a legendary or mythic, behind the Pokémon. A legendary stands in slowly turning
	// golden rays with a warm glow, like the catch screen's burst, and bands of rainbow light run
	// along the rays like a holo foil; a mythic in a turning violet swirl with an opal shimmer running through
	// it, and stars that twinkle. Same contract as Foil: the parent is the window, with
	// position: relative and overflow: hidden, and the Pokémon passed in must be positioned. Inside
	// a Foil the layers stack foil, aura, Pokémon, glare. With no `kind` only the Pokémon is
	// rendered.
	// The holo bands move with the card, not on a timer: with the trading card's turn (its --ax and
	// --ay), or else a mouse or finger on the window, or the tilt when it is on (tilt.js).
	import { followTilt } from '#lib/tilt.js';

	/** @type {{ kind?: '' | 'legendary' | 'mythic', phase?: string, children: import('svelte').Snippet }} */
	let { kind = '', phase = '0s', children } = $props();

	/** @type {HTMLElement | undefined} */
	let aura = $state();

	$effect(() => {
		if (!aura) return;
		const el = aura;
		const unfollow = followTilt(el);
		// The trading card turns itself and hands its turn down; nothing to listen for here.
		if (el.closest('.holo-card')) return unfollow;
		const windowEl = /** @type {HTMLElement} */ (el.parentElement);
		const link = !!windowEl.closest('a');
		/** @param {PointerEvent} e */
		const move = (e) => {
			if (e.pointerType === 'touch' && link) return;
			const box = windowEl.getBoundingClientRect();
			el.style.setProperty('--aura-x', (((e.clientX - box.left) / box.width) * 2 - 1).toFixed(3));
			el.style.setProperty('--aura-y', (((e.clientY - box.top) / box.height) * 2 - 1).toFixed(3));
		};
		const leave = () => {
			el.style.removeProperty('--aura-x');
			el.style.removeProperty('--aura-y');
		};
		const events = /** @type {const} */ ([['pointermove', move], ['pointerleave', leave], ['pointercancel', leave]]);
		for (const [type, f] of events) windowEl.addEventListener(type, /** @type {EventListener} */ (f));
		return () => {
			unfollow();
			for (const [type, f] of events) windowEl.removeEventListener(type, /** @type {EventListener} */ (f));
		};
	});
</script>

{#if kind}
	<span bind:this={aura} class="aura {kind}" style:--phase={phase} aria-hidden="true">
		<span class="glow"></span>
		<span class="turn"></span>
		{#if kind === 'mythic'}{#each [0, 1, 2, 3] as i (i)}<span class="star"></span>{/each}{/if}
	</span>
{/if}
{@render children()}

<style>
	/* Only transform and opacity animate, as in Foil, so a Pokédex full of legendaries stays cheap.
	   The turning layer is a square wider than the window, so its corners never show. */
	.aura {
		/* Where the holo light is, -1 to 1 each way: the card's turn, the hand, the tilt, or the middle. */
		--hx: var(--ax, var(--aura-x, var(--tilt, 0)));
		--hy: var(--ay, var(--aura-y, var(--tilt-y, 0)));
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	.glow,
	.turn {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 150%;
		aspect-ratio: 1;
		border-radius: 50%;
		transform: translate(-50%, -50%);
	}
	.turn {
		mask-image: radial-gradient(closest-side, black 25%, transparent 100%);
		-webkit-mask-image: radial-gradient(closest-side, black 25%, transparent 100%);
		animation: aura-turn 24s linear var(--phase) infinite;
	}
	.glow {
		width: 90%;
		animation: aura-pulse 3.2s ease-in-out var(--phase) infinite alternate;
	}

	/* The rays are a mask over a gold sheet striped with rainbow bands; the bands move with the card
	   (--hx, --hy), so the light runs along the rays like a holo foil. Where masks cannot be
	   combined (before iOS 15.4) the sheet shows through the fade alone, as a soft gold disc. */
	.legendary .turn {
		background: repeating-linear-gradient(
				115deg,
				oklch(0.8 0.16 80) 0,
				oklch(0.8 0.16 80) 10%,
				oklch(0.84 0.14 350) 14%,
				oklch(0.9 0.1 200) 17%,
				oklch(0.98 0.03 95) 19%,
				oklch(0.88 0.14 150) 21%,
				oklch(0.9 0.12 95) 24%,
				oklch(0.8 0.16 80) 28%,
				oklch(0.8 0.16 80) 40%
			)
			0 0 / 200% 200%;
		background-position: calc(50% - var(--hx) * 50%) calc(50% - var(--hy) * 50%);
		opacity: 0.7;
		mask-image:
			repeating-conic-gradient(#000 0 9deg, transparent 9deg 22.5deg),
			radial-gradient(closest-side, black 25%, transparent 100%);
		-webkit-mask-image:
			repeating-conic-gradient(#000 0 9deg, transparent 9deg 22.5deg),
			radial-gradient(closest-side, black 25%, transparent 100%);
		mask-composite: intersect;
		-webkit-mask-composite: source-in;
		transition: background-position 150ms ease-out;
	}
	.legendary .glow {
		background: radial-gradient(closest-side, oklch(0.9 0.15 90 / 0.95), oklch(0.85 0.14 80 / 0) 100%);
	}

	.mythic .turn {
		overflow: hidden;
		background: conic-gradient(
			oklch(0.72 0.18 330 / 0.9),
			oklch(0.7 0.16 290 / 0.3),
			oklch(0.76 0.13 220 / 0.85),
			oklch(0.7 0.16 290 / 0.3),
			oklch(0.72 0.18 330 / 0.9)
		);
		animation-duration: 14s;
	}
	/* The opal shimmer: thin pastel bands that slide across the swirl as the card moves, screened on. */
	.mythic .turn::after {
		content: '';
		position: absolute;
		inset: 0;
		background: repeating-linear-gradient(
				60deg,
				transparent 0,
				oklch(0.95 0.08 330 / 0.8) 3%,
				oklch(0.96 0.07 200 / 0.8) 6%,
				oklch(0.97 0.08 110 / 0.7) 9%,
				transparent 12%,
				transparent 20%
			)
			0 0 / 200% 200%;
		background-position: calc(50% + var(--hx) * 50%) calc(50% + var(--hy) * 50%);
		mix-blend-mode: screen;
		transition: background-position 150ms ease-out;
	}
	.mythic .glow {
		background: radial-gradient(closest-side, oklch(0.93 0.07 320 / 0.95), oklch(0.85 0.1 300 / 0) 100%);
	}
	.star {
		position: absolute;
		width: 20%;
		aspect-ratio: 1;
		background: radial-gradient(closest-side, oklch(1 0 0), oklch(0.85 0.14 320) 35%, transparent 75%);
		clip-path: polygon(50% 0, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0 50%, 40% 40%);
		opacity: 0;
		animation: aura-twinkle 2.8s ease-in-out infinite;
	}
	.star:nth-of-type(1) { top: 10%; left: 12%; animation-delay: calc(var(--phase) + 0.2s); }
	.star:nth-of-type(2) { top: 22%; right: 10%; width: 15%; animation-delay: calc(var(--phase) + 0.9s); }
	.star:nth-of-type(3) { bottom: 16%; left: 18%; width: 13%; animation-delay: calc(var(--phase) + 1.6s); }
	.star:nth-of-type(4) { bottom: 26%; right: 16%; animation-delay: calc(var(--phase) + 2.3s); }

	@keyframes aura-turn {
		to { transform: translate(-50%, -50%) rotate(1turn); }
	}
	@keyframes aura-pulse {
		from { opacity: 0.55; transform: translate(-50%, -50%) scale(0.9); }
		to { opacity: 1; transform: translate(-50%, -50%) scale(1.05); }
	}
	@keyframes aura-twinkle {
		0%, 100% { opacity: 0; transform: scale(0.4) rotate(0); }
		45% { opacity: 1; transform: scale(1) rotate(45deg); }
		60% { opacity: 0; transform: scale(0.6) rotate(60deg); }
	}

	@media (prefers-reduced-motion: reduce) {
		.turn,
		.glow {
			animation: none;
		}
		.star {
			animation: none;
			opacity: 0.8;
		}
	}
</style>
