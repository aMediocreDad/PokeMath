<script>
	// The bottom bar from static/botbar.html: the connection light (yellow until the server has
	// answered, as on the legacy pages) and the bingo code while playing bingo.
	import { layout } from '#lib/layoutState.svelte.js';

	const STATUS = { good: 'status-green', okay: 'status-yellow', disconnected: 'status-red' };
	const LABEL = { good: 'Tilkoblet', okay: 'Kobler til', disconnected: 'Frakoblet' };
</script>

<span id="connection-indicator" class="connection" title={LABEL[layout.connection]}>
	<span id="connection-status" class="dot {STATUS[layout.connection]}"></span>
</span>
{#if layout.bingoCode}
	<span id="bingoIndicator" class="bingo">🎲 Bingo: {layout.bingoCode}</span>
{/if}

<style>
	.connection {
		display: inline-flex;
		align-items: center;
	}
	.dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--pm-gold);
	}
	.dot.status-green {
		background: var(--pm-green);
	}
	.dot.status-red {
		background: var(--pm-red);
	}
	.bingo {
		padding: 4px 12px;
		border-radius: 999px;
		background: var(--pm-green-deep);
		color: var(--pm-paper);
		font-family: var(--pm-display);
		font-size: 16px;
	}
</style>
