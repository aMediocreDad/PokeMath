<script>
	// How the class joins: the code, big enough for the back row, and the QR code to scan inside
	// Pokémath (bingo_join.html). The waiting room shows it large; the code chip opens it later.
	import { qrDataUrl } from '#lib/qr.js';
	import { joinUrl } from '#lib/bingoHost.js';

	/** @type {{ code: string, qrSize?: number }} */
	let { code, qrSize = 200 } = $props();
</script>

<div class="join">
	<p class="how">Gå til <strong>Bli med i klassespill</strong> og skann QR-koden, eller skriv</p>
	<p class="code" id="lobbyCode">{code}</p>
	{#await qrDataUrl(joinUrl(code), qrSize * 2) then src}<img class="qr" id="qrImage" {src} alt="QR-kode for å bli med" width={qrSize} height={qrSize} />{/await}
	<p class="url" id="qrUrl">{joinUrl(code)}</p>
</div>

<style>
	.join {
		display: grid;
		justify-items: center;
		gap: 6px;
		text-align: center;
	}
	.join p {
		margin: 0;
	}
	.how {
		color: var(--pm-ink-soft);
	}
	.code {
		font: 400 clamp(44px, 6vw, 72px)/1 var(--pm-display);
		letter-spacing: 0.12em;
	}
	.url {
		max-width: 260px;
		color: var(--pm-ink-soft);
		font-size: 13px;
		overflow-wrap: anywhere;
	}
</style>
