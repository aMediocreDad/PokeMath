<script>
	import { player } from '#lib/player.svelte.js';
	import { loadAchievements } from '#lib/achievements.js';
	import { toast, notify } from '#lib/toast.svelte.js';
	import { createBackup, parseOldBackup, restoreBackup } from '#lib/backup.js';
	import { syncNow } from '#lib/cloudSave.svelte.js';

	function snoozeReminderThreeDays() {
		const until = new Date();
		until.setDate(until.getDate() + 3);
		localStorage.setItem('backupReminder', until.toISOString());
	}

	function announceRestore() {
		notify(
			'/images/up-arrow.png',
			`Dataen har blitt lastet inn! Bruker: ${player.username} med ${player.caught} Pokémon`
		);
	}

	function download() {
		try {
			const { filename, contents } = createBackup(player.username);
			const link = document.createElement('a');
			link.href = URL.createObjectURL(new Blob([contents], { type: 'application/octet-stream' }));
			link.download = filename;
			link.click();
			URL.revokeObjectURL(link.href);
			snoozeReminderThreeDays();
		} catch (error) {
			toast(String(error), { bad: true });
		}
	}

	/** @param {Event & { currentTarget: HTMLInputElement }} event */
	async function upload(event) {
		const file = event.currentTarget.files?.[0];
		if (!file) return;
		const contents = await file.text();
		try {
			const result = restoreBackup(contents);
			if (result.refused) {
				alert(`Filen har ${result.incoming} Pokémon, men du har allerede ${result.current} her. Ingen data ble overskrevet – du beholder versjonen med flest Pokémon.`);
				return;
			}
			player.load();
			loadAchievements();
			announceRestore();
			syncNow();
		} catch (error) {
			console.warn('Prøver å laste inn dataen din med en gammel versjon...', error);
			try {
				if (restoreOldBackup(contents)) alert('Dataen din ble lastet inn ved bruk av den gamle versjonen!');
			} catch (oldError) {
				console.error('Error restoring LocalStorage data:', oldError);
				alert('Det oppstod en feil når vi prøvde å laste inn dataen din... Kontakt PokeMorten og send inn filen din!');
			}
		}
	}

	/** An old file's comma list, without the empty entry that splitting '' gives. */
	const list = (/** @type {string} */ text) => (text || '').split(',').filter((item) => item.trim() !== '');

	/**
	 * handleOldFileLoad() from static/saveandload.js, with the same "most Pokémon wins" rule as the
	 * current format.
	 * @param {string} contents
	 * @returns {boolean} whether it was loaded
	 */
	function restoreOldBackup(contents) {
		const backup = parseOldBackup(contents);
		const { state, shop } = backup;
		const incoming = list(state.pkmnList).length;
		if (incoming < player.pkmnList.length) {
			alert(`Filen har ${incoming} Pokémon, men du har allerede ${player.pkmnList.length} her. Ingen data ble overskrevet – du beholder versjonen med flest Pokémon.`);
			return false;
		}

		player.username = state.username;
		player.money = Number(state.totalScore) || 0;
		player.pkmnList = list(state.pkmnList);
		player.tiersSolved = [state.t1, state.t2, state.t3, state.t4, state.t5].map((n) => Number(n) || 0);
		player.customSolved = Number(state.customSolved) || 0;
		player.background = shop.background;
		player.playerIcon = shop.playerIcon;
		player.boughtBackgrounds = list(shop.boughtBackgrounds);
		player.boughtPlayerIcons = list(shop.boughtPlayerIcons);
		player.claimedSecrets = list(shop.claimedSecrets);
		player.shinyLevel = Number(shop.shinyLevel) || 1;
		player.mythicLevel = Number(shop.mythicLevel) || 0;
		player.legendLevel = Number(shop.legendLevel) || 0;
		player.specialLevel = Number(shop.specialLevel) || 0;
		player.coinLevel = Number(shop.coinLevel) || 0;
		localStorage.setItem('visitCounted', 'true');

		if (backup.xmas) {
			localStorage.setItem('xmasYear', JSON.stringify(backup.xmas.year));
			localStorage.setItem('xmasOpened', JSON.stringify(backup.xmas.opened));
		}
		if (backup.badges) localStorage.setItem('badges', JSON.stringify(backup.badges));
		if (backup.redeemedCodes) localStorage.setItem('redeemedCodes', JSON.stringify(backup.redeemedCodes));

		player.saveAll();
		player.load();
		loadAchievements();
		toast('Dataen din har blitt lastet inn!');
		announceRestore();
		snoozeReminderThreeDays();
		syncNow();
		return true;
	}
</script>

<svelte:head>
	<title>Pokémath - Lagre</title>
	<meta name="title" content="Pokémath - Lagre" />
	<meta name="description" content="Side for å lagre og laste opp din fremdrift!" />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="main pm-page backup">
	<h1 class="pm-title">Lagre og hent</h1>
	<p class="lead">Ta vare på Pokémonene dine. Lagre en kopi som en fil, og hent den tilbake på en annen enhet eller hvis noe forsvinner.</p>

	<div class="cards">
		<section id="downloadSection" class="panel pm-surface">
			<img src="/images/down-arrow.png" width="56" height="56" alt="" />
			<h2>Lagre en kopi</h2>
			<p>Last ned fremdriften din som en <code>.pkmth</code>-fil. Ikke del filen med andre spillere.</p>
			<button onclick={download} class="pm-button">Last ned</button>
		</section>

		<section id="uploadSection" class="panel pm-surface">
			<img src="/images/up-arrow.png" width="56" height="56" alt="" />
			<h2>Hent fra fil</h2>
			<p>Velg en fil du har lagret før for å få tilbake Pokémonene dine.</p>
			<p class="warning"><strong>Obs!</strong> Alt du har nå blir erstattet av det som er i filen. Det kan ikke angres.</p>
			<label for="fileInput" class="pm-button secondary">
				Velg fil …
				<input id="fileInput" type="file" name="file" onchange={upload} />
			</label>
		</section>
	</div>

	<p class="beta">Dette er en ny funksjon. Hvis noe går galt, kontakt oss og send med filen.</p>
</div>

<style>
	.lead {
		max-width: 60ch;
		margin: -6px 0 20px;
		color: var(--pm-ink-soft);
		font-size: 18px;
		line-height: 1.45;
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 16px;
		align-items: start;
	}
	.panel {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 10px;
		padding: 20px;
	}
	.panel img {
		width: 56px;
		height: 56px;
		object-fit: contain;
	}
	h2 {
		margin: 0;
		font-family: var(--pm-display);
		font-weight: 400;
		font-size: 26px;
	}
	p {
		margin: 0;
		line-height: 1.45;
	}
	.warning {
		padding: 10px 12px;
		border-radius: 12px;
		background: var(--pm-red-soft);
		color: var(--pm-red-deep);
	}
	.pm-button {
		margin-top: 6px;
	}
	/* The file picker stays in the page for screen readers and tests, but the label is the button. */
	#fileInput {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	.beta {
		margin-top: 20px;
		color: var(--pm-ink-soft);
		font-size: 14px;
	}
</style>
