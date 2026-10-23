<script>
	// A type's symbol in a circle of the type's colour, like the energy on a trading card. The
	// icons are bundled from src/lib/assets/types (see the README there). Size it with font-size:
	// the circle is 1.25em across.
	/** @type {Record<string, string>} */
	const ICONS = Object.fromEntries(
		Object.entries(import.meta.glob('./assets/types/*.svg', { eager: true, query: '?url', import: 'default' })).map(([path, url]) => [
			path.slice(path.lastIndexOf('/') + 1, -4),
			/** @type {string} */ (url)
		])
	);

	/** @type {{ type: string, label?: boolean }} */
	let { type, label = false } = $props();
	const key = $derived(type.toLowerCase());
</script>

<span class="type-icon t-{key}" role={label ? 'img' : undefined} aria-label={label ? type : undefined} aria-hidden={label ? undefined : 'true'}>
	{#if ICONS[key]}<img src={ICONS[key]} alt="" />{/if}
</span>

<style>
	.type-icon {
		display: inline-grid;
		place-items: center;
		flex: 0 0 auto;
		width: 1.25em;
		height: 1.25em;
		border-radius: 50%;
		background: var(--type, oklch(0.6 0.02 265));
		box-shadow: 0 0 0 0.1em oklch(1 0 0 / 0.85), 0 0.08em 0.2em oklch(0 0 0 / 0.3);
		vertical-align: middle;
	}
	img {
		width: 62%;
		height: 62%;
	}
</style>
