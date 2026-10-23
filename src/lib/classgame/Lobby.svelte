<script>
	// The waiting room every class game starts in, made for the projector: what the class is about
	// to play on the left, and on the right the code and QR code, who has joined, and Start.
	import JoinPanel from './JoinPanel.svelte';

	/** @typedef {{ uuid?: string, name?: string, connected?: boolean }} Player */
	/**
	 * @type {{
	 *   code: string,
	 *   players: Player[],
	 *   startLabel: string,
	 *   onStart: () => void,
	 *   onCancel: () => void,
	 *   onPlayer?: (player: Player, event: MouseEvent) => void,
	 *   stage: import('svelte').Snippet
	 * }}
	 */
	let { code, players, startLabel, onStart, onCancel, onPlayer, stage } = $props();
</script>

<section class="lobby" id="lobby">
	<div class="stage">{@render stage()}</div>
	<div class="side">
		<div class="panel join-panel"><JoinPanel {code} /></div>
		<div class="panel">
			<h3>{players.length} {players.length === 1 ? 'spiller' : 'spillere'}</h3>
			{#if players.length}
				<ul id="lobbyPlayers">
					{#each players as p, i (p.uuid ?? i)}
						<li class:offline={!p.connected}>
							{#if onPlayer}
								<button class="name" title="Trykk for alternativer" onclick={(e) => (e.stopPropagation(), onPlayer(p, e))}>{p.name || 'Ash'}</button>
							{:else}
								<span class="name">{p.name || 'Ash'}</span>
							{/if}
						</li>
					{/each}
				</ul>
			{:else}
				<p class="muted small">Ingen har blitt med ennå.</p>
			{/if}
		</div>
		<div class="actions">
			<button class="pm-button" id="startGameBtn" disabled={!players.length} onclick={onStart}>{startLabel}</button>
			<button class="pm-button secondary" id="cancelGameBtn" onclick={onCancel}>Avbryt</button>
		</div>
	</div>
</section>

<style>
	/* The stage on the left, everything else beside it; stacked on narrow screens. */
	.lobby {
		display: grid;
		grid-template-columns: minmax(0, 3fr) minmax(260px, 2fr);
		gap: 20px;
		align-items: start;
	}
	@media (max-width: 760px) {
		.lobby {
			grid-template-columns: 1fr;
		}
	}
	.side {
		display: grid;
		gap: 14px;
	}
	.side .panel {
		margin: 0;
	}
	h3 {
		margin: 0 0 8px;
		font-size: 17px;
	}
	ul {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li .name {
		display: inline-flex;
		align-items: center;
		min-height: 36px;
		padding: 0 12px;
		border: 1px solid var(--pm-line);
		border-radius: 999px;
		background: var(--pm-cream);
		color: var(--pm-ink);
		font: 700 15px/1 var(--pm-body);
	}
	button.name {
		cursor: pointer;
	}
	li.offline .name {
		color: var(--pm-ink-soft);
		font-weight: 400;
	}
	.actions {
		margin: 0;
	}
</style>
