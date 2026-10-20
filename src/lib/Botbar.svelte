<script>
	// The bottom bar from static/botbar.html. The connection light starts yellow ("okay"),
	// as on the legacy pages.
	import { layout } from '#lib/layoutState.svelte.js';

	const STATUS = { good: 'status-green', okay: 'status-yellow', disconnected: 'status-red' };
</script>

<!-- svelte-ignore a11y_missing_attribute, a11y_consider_explicit_label -->
<a id="connection-indicator" class="align-left">
	<span id="connection-status" class={STATUS[layout.connection]}>&nbsp;</span>
</a>
{#if layout.bingoCode}
	<div
		id="bingoIndicator"
		style="float:right; margin:9px 14px 0 0; padding:5px 12px; border-radius:20px; background:#00C957; color:#fff; font-weight:700; font-size:14px; line-height:1.4;"
	>
		🎲 Bingo: {layout.bingoCode}
	</div>
{/if}
