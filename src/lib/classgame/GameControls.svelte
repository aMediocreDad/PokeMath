<script>
	// The same buttons, in the same order, for every class game: the game's own action if it has
	// one, then a new game with the same setup, new settings, and ending the game.
	/**
	 * @type {{
	 *   primary?: { id: string, label: string, onclick: () => void, disabled?: boolean },
	 *   newLabel: string, endLabel: string,
	 *   onNew: () => void, onSettings: () => void, onEnd: () => void
	 * }}
	 */
	let { primary, newLabel, endLabel, onNew, onSettings, onEnd } = $props();
</script>

<div class="game-controls" role="group" aria-label="Spillet">
	{#if primary}
		<button id={primary.id} class="pm-button small" disabled={primary.disabled} onclick={primary.onclick}>{primary.label}</button>
	{/if}
	<button id="newGameBtn" class="pm-button small" class:secondary={!!primary} onclick={onNew}>{newLabel}</button>
	<button id="settingsBtn" class="pm-button small secondary" onclick={onSettings}>Nye innstillinger</button>
	<button id="endGameBtn" class="pm-button small secondary danger" onclick={onEnd}>{endLabel}</button>
</div>

<style>
	.game-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
</style>
