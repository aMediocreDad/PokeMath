<script>
	// A small progress card while the Pokémon pictures download for offline play
	// (#lib/offline.svelte.js). On a phone the card would cover the page, so there it shrinks to a
	// thin bar on the header's lower edge, and the words are left for screen readers.
	import { offline } from '#lib/offline.svelte.js';
</script>

{#if offline.running}
	<div class="pm-offline" role="status">
		<span>Laster ned Pokémon til bruk uten nett</span>
		<progress max={offline.total} value={offline.done}></progress>
		<span class="count">{offline.done} / {offline.total}</span>
	</div>
{/if}

<style>
	.pm-offline {
		position: fixed;
		z-index: 50;
		right: 12px;
		bottom: calc(12px + env(safe-area-inset-bottom));
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 4px 10px;
		width: min(320px, calc(100vw - 24px));
		padding: 10px 14px;
		border-radius: 14px;
		background: var(--pm-paper);
		box-shadow: var(--pm-shadow), 0 0 0 1px var(--pm-line);
		color: var(--pm-ink-soft);
		font: 600 14px/1.3 var(--pm-body);
		pointer-events: none;
	}
	.pm-offline span:first-child {
		grid-column: 1 / -1;
	}
	progress {
		width: 100%;
		height: 8px;
		accent-color: var(--pm-red);
	}
	.count {
		font-variant-numeric: tabular-nums;
	}
	@media (max-width: 600px) {
		/* Over the header's 3px shadow, just under the bar. */
		.pm-offline {
			top: var(--pm-bar-height);
			right: 0;
			bottom: auto;
			left: 0;
			z-index: 1001;
			display: block;
			width: auto;
			height: 3px;
			padding: 0;
			border-radius: 0;
			background: var(--pm-red-deep);
			box-shadow: none;
		}
		.pm-offline span {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
		}
		progress {
			display: block;
			height: 3px;
			border: none;
			appearance: none;
			background: none;
		}
		progress::-webkit-progress-bar {
			background: none;
		}
		progress::-webkit-progress-value {
			background: var(--pm-gold);
		}
		progress::-moz-progress-bar {
			background: var(--pm-gold);
		}
	}
</style>
