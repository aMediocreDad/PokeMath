<script>
	// The class game the child is in (bingo or raid), above the problem on the game page. One look
	// for both games: the game and its code or boss, then what happens now. Tapping it leads to the
	// join page, to leave or switch.

	/**
	 * @type {{
	 *   code: string,
	 *   game: { kind: 'bingo', state: import('#lib/bingo.js').BingoState } | { kind: 'raid', state: import('#lib/bingo.js').RaidState } | null,
	 *   bossName: string
	 * }}
	 */
	let { code, game, bossName } = $props();

	const raid = $derived(game?.kind === 'raid' ? game.state : null);
	const title = $derived(game?.kind === 'raid' ? `Raid · ${bossName}` : game?.kind === 'bingo' ? `Bingo · ${code}` : `Klassespill · ${code}`);
	const note = $derived.by(() => {
		if (!game) return 'Kobler til…';
		if (game.state.phase === 'lobby') return 'Venter på at læreren starter';
		if (game.kind === 'bingo') return 'Fangstene dine teller på brettet';
		const { phase, hp, maxHp } = game.state;
		return phase === 'won' ? 'Beseiret! Premien kommer.' : `${hp} / ${maxHp} liv igjen`;
	});
</script>

<a class="banner" id={game?.kind === 'raid' ? 'raidIndicator' : 'bingoIndicator'} href="/bingo_join.html">
	<span class="title">{title}</span>
	{#if raid && raid.phase !== 'lobby'}
		<span class="bar" aria-hidden="true"><span style:width="{(100 * raid.hp) / Math.max(1, raid.maxHp)}%"></span></span>
	{/if}
	<span class="note">{note}</span>
</a>

<style>
	.banner {
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
	.note {
		font-size: 14px;
		opacity: 0.85;
	}
</style>
