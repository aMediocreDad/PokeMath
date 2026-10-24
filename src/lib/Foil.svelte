<script>
	// The foil of a shiny, as on a holo trading card: a rainbow foil behind the Pokémon, a shine over
	// both where the light catches the card, and a glare at the light. The parent is the window:
	// position: relative and overflow: hidden. The Pokémon passed in must be positioned too, or it
	// paints under the foil. `phase` shifts the drift, so several drifting shinies side by side do
	// not flash in unison. With `on` false only the Pokémon is rendered.
	// The foil follows the card instead of drifting on its own: as the page scrolls it up the screen,
	// where the browser can tie an animation to scrolling, and under a mouse or a finger dragged
	// sideways across it. A finger on a Pokédex card is left alone, as the card is a link. With the
	// tilt switched on in the profile (tilt.js), tilting the iPad or phone moves it instead. A foil
	// in a fixed overlay, like a bingo prize, never scrolls, so it keeps drifting.
	import { followTilt } from '#lib/tilt.js';

	/** @type {{ on?: boolean, phase?: string, children: import('svelte').Snippet }} */
	let { on = true, phase = '0s', children } = $props();

	/** @type {HTMLElement | undefined} */
	let foil = $state();
	/** @type {HTMLElement | undefined} */
	let shine = $state();
	/** @type {HTMLElement | undefined} */
	let glare = $state();
	/** Where the mouse or finger is on the window, -1 to 1 each way, or null when it is not on it. */
	let pointer = $state(/** @type {{ x: number, y: number } | null} */ (null));
	let scrolls = $state(false);

	/** Whether the element sits in a fixed overlay, which never scrolls. @param {Element | null} el */
	const fixed = (el) => {
		for (; el; el = el.parentElement) if (getComputedStyle(el).position === 'fixed') return true;
		return false;
	};

	$effect(() => {
		if (!foil || !shine || !glare) return;
		const windowEl = /** @type {HTMLElement} */ (foil.parentElement);
		const link = !!windowEl.closest('a');
		// The window is a scroll container of its own (overflow: hidden), so the layers inside
		// follow the window's timeline through the page, not their own.
		scrolls = CSS.supports('animation-timeline: view()') && !fixed(windowEl);
		if (scrolls) windowEl.style.setProperty('view-timeline', '--foil-window');
		if (!link) windowEl.style.touchAction = 'pan-y';
		// The shine lights up what is under it in the window, not the page behind the card. Safari
		// on iPhone and iPad lets blended layers out past the window's rounded corners, despite
		// overflow: hidden, so the window is clipped to its own corners as well.
		windowEl.style.isolation = 'isolate';
		windowEl.style.clipPath = `inset(0 round ${getComputedStyle(windowEl).borderRadius})`;
		const unfollow = [followTilt(foil), followTilt(shine), followTilt(glare)];
		/** @param {PointerEvent} e */
		const move = (e) => {
			if (e.pointerType === 'touch' && link) return;
			const box = windowEl.getBoundingClientRect();
			const across = (/** @type {number} */ at, /** @type {number} */ from, /** @type {number} */ size) => Math.max(-1, Math.min(1, ((at - from) / size) * 2 - 1));
			pointer = { x: across(e.clientX, box.left, box.width), y: across(e.clientY, box.top, box.height) };
		};
		const leave = () => (pointer = null);
		const events = /** @type {const} */ ([['pointermove', move], ['pointerleave', leave], ['pointercancel', leave]]);
		for (const [type, f] of events) windowEl.addEventListener(type, /** @type {EventListener} */ (f));
		return () => {
			unfollow.forEach((f) => f());
			for (const [type, f] of events) windowEl.removeEventListener(type, /** @type {EventListener} */ (f));
		};
	});
</script>

{#if on}<span bind:this={foil} class="layer foil" class:scrolls class:live={pointer !== null} style:--phase={phase} style:--pointer={pointer?.x} style:--pointer-y={pointer?.y} aria-hidden="true"></span>{/if}
{@render children()}
{#if on}
	<span bind:this={shine} class="shine" class:scrolls class:live={pointer !== null} style:--phase={phase} style:--pointer={pointer?.x} style:--pointer-y={pointer?.y} aria-hidden="true">
		<span class="layer rainbow"></span>
		<span class="grain"></span>
		<span class="layer pillars"></span>
		<span class="layer falloff"></span>
	</span>
	<span bind:this={glare} class="layer glare" class:scrolls class:live={pointer !== null} style:--phase={phase} style:--pointer={pointer?.x} style:--pointer-y={pointer?.y} aria-hidden="true"></span>
{/if}

<style>
	/* Every moving layer is larger than the window and slides with transform, which stays cheap with
	   a full Pokédex of shinies; moving background-position, as most holo effects do, would repaint
	   every card. Each layer slides --ax and --ay at the ends of its travel, so one set of keyframes
	   serves them all; --fx and --fy are where the light is, -1 to 1. The light rests up and left. */
	.layer,
	.shine,
	.grain {
		position: absolute;
		pointer-events: none;
	}
	.layer {
		--fx: -0.35;
		--fy: -0.25;
		transform: translate(calc(var(--fx) * var(--ax)), calc(var(--fy) * var(--ay)));
		animation: sweep 7s ease-in-out var(--phase) infinite alternate;
	}

	/* The foil behind the Pokémon: soft spectral colour, which gives the shine something to light. */
	.foil {
		--ax: 20%;
		--ay: 5%;
		inset: -50% auto -50% -100%;
		width: 300%;
		opacity: 0.8;
		background: linear-gradient(
			115deg,
			oklch(0.78 0.14 25),
			oklch(0.84 0.14 90),
			oklch(0.8 0.14 150),
			oklch(0.76 0.12 230),
			oklch(0.7 0.14 300),
			oklch(0.78 0.14 25),
			oklch(0.84 0.14 90),
			oklch(0.8 0.14 150)
		);
	}

	/* The shine, over foil and Pokémon alike: dark spectral bands in color-dodge, so black leaves
	   the card as it is and colour lights it up. Inside it, a grain of scanlines and glitter, sun
	   pillars sliding at their own pace, and a falloff that keeps it brightest near the light. */
	.shine {
		inset: 0;
		mix-blend-mode: color-dodge;
		isolation: isolate;
	}
	.rainbow {
		--ax: -30%;
		--ay: -12%;
		inset: -100%;
		background: repeating-linear-gradient(
			110deg,
			hsl(283 70% 30%) 0%,
			hsl(228 70% 32%) 3.3%,
			hsl(176 70% 30%) 6.6%,
			hsl(93 70% 30%) 10%,
			hsl(53 70% 34%) 13.3%,
			hsl(2 70% 32%) 16.6%,
			hsl(283 70% 30%) 20%
		);
	}
	.grain {
		inset: 0;
		mix-blend-mode: multiply;
		background:
			radial-gradient(circle, #fff 0 1px, transparent 1.7px) 0 0 / 9px 8px,
			radial-gradient(circle, #fff 0 1.3px, transparent 2.1px) 4px 5px / 17px 15px,
			repeating-linear-gradient(90deg, #000 0 1px, #999 1px 2px);
	}
	.pillars {
		--ax: 12%;
		--ay: 0%;
		inset: 0 -100%;
		mix-blend-mode: screen;
		opacity: 0.45;
		background: repeating-linear-gradient(90deg, #000 0 2%, #555 3%, #000 3.5%, #555 4%, #000 5%, #000 13%);
	}
	.falloff {
		--ax: -16%;
		--ay: -16%;
		inset: -100%;
		mix-blend-mode: multiply;
		background: radial-gradient(circle at 50% 50%, #fff 0, #bbb 10%, #222 32%);
	}

	/* The glare: a round light where the light falls. */
	.glare {
		--ax: -22%;
		--ay: -22%;
		inset: -100%;
		mix-blend-mode: overlay;
		background: radial-gradient(
			circle at 50% 50%,
			hsl(0 0% 100% / 0.85) 0,
			hsl(0 0% 100% / 0.45) 6%,
			hsl(0 0% 0% / 0.2) 24%
		);
	}

	@keyframes sweep {
		from { transform: translate(calc(-1 * var(--ax)), calc(-0.6 * var(--ay))); }
		to { transform: translate(var(--ax), calc(0.6 * var(--ay))); }
	}

	/* Following the card: scrolling, then a mouse or finger on it, then the tilt, each winning over
	   the one before. Scrolling sweeps the light across and back twice while the card crosses the
	   screen, so a short scroll is enough to see it move. None of it with reduced motion. */
	@media (prefers-reduced-motion: no-preference) {
		.layer.scrolls,
		.scrolls .layer {
			animation: sweep linear both 2 alternate;
			animation-timeline: --foil-window;
			animation-range: cover 10% cover 90%;
		}
		.layer.live,
		.live .layer,
		:global(html[data-tilt]) .layer {
			--fx: var(--pointer, var(--tilt, 0));
			--fy: var(--pointer-y, var(--tilt-y, 0));
			animation: none;
			transition: transform 120ms ease-out;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.layer {
			animation: none;
		}
	}
</style>
