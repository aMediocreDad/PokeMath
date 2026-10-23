<script>
	// The class game the child is in (bingo, raid or memory), above the problem on the game page.
	// One look for all of them: the game and its code or boss, then what happens now. Tapping it
	// leads to the join page, to leave or switch.

	/**
	 * @type {{
	 *   code: string,
	 *   game: import('#lib/bingo.js').ClassGame | null,
	 *   bossName: string,
	 *   lastHit?: { damage: number, id: number } | null
	 * }}
	 */
	let { code, game, bossName, lastHit = null } = $props();

	const TITLES = { raid: () => `Raid · ${bossName}`, memory: () => `Memory · ${code}`, bingo: () => `Bingo · ${code}` };
	const title = $derived(game ? TITLES[game.kind]() : `Klassespill · ${code}`);
	/** How full the bar under the title is, 0–1, or null for no bar. */
	const bar = $derived.by(() => {
		if (!game || game.state.phase === 'lobby') return null;
		if (game.kind === 'raid') return game.state.hp / Math.max(1, game.state.maxHp);
		if (game.kind === 'memory') return game.state.found / Math.max(1, game.state.pairs);
		return null;
	});
	const note = $derived.by(() => {
		if (!game) return 'Kobler til…';
		if (game.state.phase === 'lobby') return 'Venter på at læreren starter';
		if (game.kind === 'bingo') return 'Fangstene dine teller på brettet';
		if (game.kind === 'memory') {
			const { phase, found, pairs, turns } = game.state;
			if (phase === 'won') return 'Alle parene er funnet! Premien kommer.';
			return `${found} av ${pairs} par funnet · ${turns ? 'Klassen har et trekk!' : 'Svar riktig for å få et trekk'}`;
		}
		const { phase, hp, maxHp } = game.state;
		if (phase === 'won') return 'Beseiret! Premien kommer.';
		return `${lastHit ? `Du traff for ${lastHit.damage}! · ` : ''}${hp} / ${maxHp} liv igjen`;
	});
</script>

<a class="banner" id={game?.kind === 'raid' ? 'raidIndicator' : game?.kind === 'memory' ? 'memoryIndicator' : 'bingoIndicator'} href="/bingo_join.html">
	<span class="title">{title}</span>
	{#if lastHit && game?.kind === 'raid' && game.state.phase === 'fight'}
		{#key lastHit.id}<span class="pop" aria-hidden="true">−{lastHit.damage}</span>{/key}
	{/if}
	{#if bar !== null}
		<span class="bar" class:found={game?.kind === 'memory'} aria-hidden="true"><span style:width="{100 * bar}%"></span></span>
	{/if}
	<span class="note">{note}</span>
</a>

<style>
	.banner {
		position: relative;
		display: grid;
		gap: 4px;
		box-sizing: border-box;
		width: min(360px, 100%);
		margin: 0 auto 10px;
		padding: 8px 16px 10px;
		border-radius: 16px;
		background: var(--pm-ink);
		color: var(--pm-paper);
		text-align: center;
		text-decoration: none;
	}
	.title {
		min-width: 0;
		overflow-wrap: anywhere;
		font-family: var(--pm-display);
		font-size: 18px;
	}
	.bar {
		height: 10px;
		border-radius: 999px;
		background: oklch(1 0 0 / 0.2);
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--pm-red);
		transition: width 300ms ease;
	}
	.bar.found span {
		background: var(--pm-gold);
	}
	/* The child's hit rises off the banner, as damage numbers do in games. */
	.pop {
		position: absolute;
		top: 4px;
		right: 16px;
		font: 400 22px/1 var(--pm-display);
		color: var(--pm-gold);
		animation: rise 900ms ease-out forwards;
		pointer-events: none;
	}
	@keyframes rise {
		from { transform: translateY(8px) scale(1.3); opacity: 1; }
		to { transform: translateY(-10px); opacity: 0; }
	}
	@media (prefers-reduced-motion: reduce) {
		.pop {
			animation: none;
			opacity: 0;
		}
	}
	.note {
		font-size: 14px;
		opacity: 0.85;
	}
</style>
