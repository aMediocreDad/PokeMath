<script>
	// The foil of a shiny, as on a holo trading card: a rainbow foil behind the Pokémon and a glare
	// sweeping over it. The parent is the window: position: relative and overflow: hidden. The
	// Pokémon passed in must be positioned too, or it paints under the foil. `phase` shifts the
	// sweep, so several shinies side by side do not flash in unison. With `on` false only the
	// Pokémon is rendered.
	/** @type {{ on?: boolean, phase?: string, children: import('svelte').Snippet }} */
	let { on = true, phase = '0s', children } = $props();
</script>

{#if on}<span class="foil" style:--phase={phase} aria-hidden="true"></span>{/if}
{@render children()}
{#if on}<span class="glare" style:--phase={phase} aria-hidden="true"></span>{/if}

<style>
	/* Foil and glare are wider than the window and slide with transform, which stays cheap with a
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

	@media (prefers-reduced-motion: reduce) {
		.foil {
			animation: none;
		}
		.glare {
			display: none;
		}
	}
</style>
