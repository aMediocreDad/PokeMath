<script module>
	// The app's interface icons: Phosphor, bold weight, which suits the chunky Lilita One headings.
	// Only icons that tell the user something belong here; game art (coins, balls) stays as images,
	// and ✨ keeps marking a shiny Pokémon. Each icon is bundled only because it is listed.
	import camera from '@phosphor-icons/core/assets/bold/camera-bold.svg?raw';
	import checkCircle from '@phosphor-icons/core/assets/bold/check-circle-bold.svg?raw';
	import clock from '@phosphor-icons/core/assets/bold/clock-bold.svg?raw';
	import eye from '@phosphor-icons/core/assets/bold/eye-bold.svg?raw';
	import eyeSlash from '@phosphor-icons/core/assets/bold/eye-slash-bold.svg?raw';
	import lock from '@phosphor-icons/core/assets/bold/lock-bold.svg?raw';
	import plus from '@phosphor-icons/core/assets/bold/plus-bold.svg?raw';
	import ranking from '@phosphor-icons/core/assets/bold/ranking-bold.svg?raw';
	import speakerHigh from '@phosphor-icons/core/assets/bold/speaker-high-bold.svg?raw';
	import speakerSlash from '@phosphor-icons/core/assets/bold/speaker-slash-bold.svg?raw';
	import warningCircle from '@phosphor-icons/core/assets/bold/warning-circle-bold.svg?raw';

	const ICONS = { camera, checkCircle, clock, eye, eyeSlash, lock, plus, ranking, speakerHigh, speakerSlash, warningCircle };
	/** @typedef {keyof typeof ICONS} IconName */
</script>

<script>
	/** @type {{ name: IconName, size?: string, label?: string }} */
	let { name, size = '1.15em', label } = $props();
</script>

<!-- The SVGs are files from the package, not user input. -->
<span class="icon" style:--size={size} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}>{@html ICONS[name]}</span>

<style>
	.icon {
		display: inline-flex;
		flex-shrink: 0;
		width: var(--size);
		height: var(--size);
		vertical-align: -0.18em;
	}
	.icon :global(svg) {
		width: 100%;
		height: 100%;
	}
</style>
