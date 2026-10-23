<script>
	// The aura of a legendary or mythic, behind the Pokémon. A legendary stands in slowly turning
	// golden rays with a warm glow, like the catch screen's burst; a mythic in a turning violet
	// swirl with stars that twinkle. Same contract as Foil: the parent is the window, with
	// position: relative and overflow: hidden, and the Pokémon passed in must be positioned. Inside
	// a Foil the layers stack foil, aura, Pokémon, glare. With no `kind` only the Pokémon is
	// rendered.
	/** @type {{ kind?: '' | 'legendary' | 'mythic', phase?: string, children: import('svelte').Snippet }} */
	let { kind = '', phase = '0s', children } = $props();
</script>

{#if kind}
	<span class="aura {kind}" style:--phase={phase} aria-hidden="true">
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

	.legendary .turn {
		background: repeating-conic-gradient(oklch(0.8 0.16 80 / 0.6) 0 9deg, transparent 9deg 22.5deg);
	}
	.legendary .glow {
		background: radial-gradient(closest-side, oklch(0.9 0.15 90 / 0.95), oklch(0.85 0.14 80 / 0) 100%);
	}

	.mythic .turn {
		background: conic-gradient(
			oklch(0.72 0.18 330 / 0.9),
			oklch(0.7 0.16 290 / 0.3),
			oklch(0.76 0.13 220 / 0.85),
			oklch(0.7 0.16 290 / 0.3),
			oklch(0.72 0.18 330 / 0.9)
		);
		animation-duration: 14s;
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
