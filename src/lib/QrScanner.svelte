<script>
	// Reads the teacher's join QR code with the camera, inside Pokémath. The iOS Camera app opens
	// the link in a tab that cannot see the save (see bingo_join.html), so scanning here is the way
	// that keeps the child's name and progress. The camera is asked for by the page, inside the tap.

	import { onMount } from 'svelte';
	import { scannedCode } from '#lib/bingo.js';

	/** @type {{ stream: MediaStream, onCode: (code: string) => void, onClose: () => void }} */
	let { stream, onCode, onClose } = $props();

	/** @type {HTMLVideoElement | undefined} */
	let video = $state();
	let notOurs = $state(false);

	/** Frames are decoded at most this wide: enough for a code on a projector, light on old iPads. */
	const MAX_SIDE = 640;
	const EVERY_MS = 250;

	onMount(() => {
		if (video) video.srcObject = stream;
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		/** @type {typeof import('jsqr').default | undefined} */
		let jsQR;
		let stopped = false;
		/** @type {ReturnType<typeof setTimeout> | undefined} */
		let notOursTimer;
		// The decoder is only needed here, so it loads on the first scan.
		import('jsqr').then((m) => (jsQR = m.default));

		const timer = setInterval(() => {
			if (stopped || !jsQR || !ctx || !video || video.readyState < 2 || !video.videoWidth) return;
			const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
			canvas.width = Math.round(video.videoWidth * scale);
			canvas.height = Math.round(video.videoHeight * scale);
			ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
			const found = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
			if (!found?.data) return;
			const code = scannedCode(found.data);
			if (code) {
				stopped = true;
				onCode(code);
			} else {
				notOurs = true;
				clearTimeout(notOursTimer);
				notOursTimer = setTimeout(() => (notOurs = false), 2000);
			}
		}, EVERY_MS);

		// A camera left on in a background tab keeps the camera light on.
		const onHidden = () => document.hidden && onClose();
		document.addEventListener('visibilitychange', onHidden);

		return () => {
			stopped = true;
			clearInterval(timer);
			clearTimeout(notOursTimer);
			document.removeEventListener('visibilitychange', onHidden);
			for (const track of stream.getTracks()) track.stop();
		};
	});
</script>

<div class="scanner" id="qrScanner" role="dialog" aria-modal="true" aria-label="Skann QR-kode">
	<div class="view">
		<!-- playsinline, or iOS opens the camera full screen in its own player. -->
		<video bind:this={video} autoplay muted playsinline></video>
		<div class="frame" aria-hidden="true"></div>
	</div>
	<p class="help" role="status">{notOurs ? 'Det er ikke en kode fra Pokémath. Prøv QR-koden på tavla.' : 'Hold QR-koden fra læreren inne i firkanten.'}</p>
	<button class="pm-button secondary" id="scanCancel" type="button" onclick={onClose}>Avbryt</button>
</div>

<style>
	.scanner {
		position: fixed;
		inset: 0;
		z-index: 1300;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 18px;
		padding: 16px;
		background: oklch(0.2 0.03 265 / 0.94);
	}
	.view {
		position: relative;
		width: min(420px, 100%, 62vh);
		aspect-ratio: 1;
		border-radius: 20px;
		overflow: hidden;
		background: #000;
	}
	video {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.frame {
		position: absolute;
		inset: 14%;
		border: 4px solid var(--pm-paper);
		border-radius: 16px;
		box-shadow: 0 0 0 999px oklch(0 0 0 / 0.35);
	}
	.help {
		max-width: 420px;
		margin: 0;
		color: var(--pm-paper);
		font-weight: 700;
		text-align: center;
	}
</style>
