<script>
	// The game's code during play, for children who come late: the code, and the QR code on a tap.
	import JoinPanel from './JoinPanel.svelte';
	import { joinUrl } from '#lib/bingoHost.js';

	/** @type {{ code: string }} */
	let { code } = $props();

	let open = $state(false);
	let copied = $state(false);

	function copyLink() {
		const url = joinUrl(code);
		navigator.clipboard
			.writeText(url)
			.then(() => {
				copied = true;
				setTimeout(() => (copied = false), 2000);
			})
			.catch(() => prompt('Kopier lenken:', url));
	}
</script>

<div class="chip">
	<span class="label">Klassekode</span>
	<span class="code" id="code">{code}</span>
	<span class="actions">
		<button id="showQrBtn" class="pm-button small secondary" onclick={() => (open = true)}>Vis QR</button>
		<button id="copyLinkBtn" class="pm-button small secondary" onclick={copyLink}>{copied ? 'Kopiert!' : 'Kopier lenke'}</button>
	</span>
</div>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div id="qrModal" class="overlay" onclick={(e) => e.target === e.currentTarget && (open = false)}>
		<div class="box" role="dialog" aria-modal="true" aria-label="Bli med">
			<button id="qrClose" class="close" aria-label="Lukk" onclick={() => (open = false)}>×</button>
			<JoinPanel {code} qrSize={240} />
		</div>
	</div>
{/if}

<style>
	.chip {
		display: grid;
		justify-items: end;
		gap: 4px;
	}
	.label {
		color: var(--pm-ink-soft);
		font-size: 13px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	/* Big enough to read from the back of the classroom. */
	.code {
		font: 400 clamp(36px, 4.5vw, 56px)/1 var(--pm-display);
		letter-spacing: 0.12em;
	}
	.actions {
		display: flex;
		gap: 6px;
	}
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 1000;
		display: grid;
		place-items: center;
		padding: 16px;
		background: oklch(0.28 0.035 265 / 0.55);
	}
	.box {
		position: relative;
		width: min(420px, 100%);
		box-sizing: border-box;
		padding: 28px 22px 22px;
		border-radius: var(--pm-radius);
		background: var(--pm-paper);
		box-shadow: var(--pm-shadow);
	}
	.close {
		position: absolute;
		top: 6px;
		right: 6px;
		width: 44px;
		height: 44px;
		border: 0;
		background: none;
		color: var(--pm-ink-soft);
		font-size: 28px;
		cursor: pointer;
	}
</style>
