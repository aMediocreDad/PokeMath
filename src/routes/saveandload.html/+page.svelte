<script>
	import { player } from '#lib/player.svelte.js';
	import { loadAchievements } from '#lib/achievements.js';
	import { toast, notify } from '#lib/toast.svelte.js';
	import { createBackup, parseOldBackup, restoreBackup } from '#lib/backup.js';

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
			restoreBackup(contents);
			player.load();
			loadAchievements();
			announceRestore();
		} catch (error) {
			console.warn('Prøver å laste inn dataen din med en gammel versjon...', error);
			try {
				restoreOldBackup(contents);
				alert('Dataen din ble lastet inn ved bruk av den gamle versjonen!');
			} catch (oldError) {
				console.error('Error restoring LocalStorage data:', oldError);
				alert('Det oppstod en feil når vi prøvde å laste inn dataen din... Kontakt PokeMorten og send inn filen din!');
			}
		}
	}

	/**
	 * handleOldFileLoad() from static/saveandload.js.
	 * @param {string} contents
	 */
	function restoreOldBackup(contents) {
		const backup = parseOldBackup(contents);
		const { state, shop } = backup;

		player.username = state.username;
		player.money = Number(state.totalScore) || 0;
		player.pkmnList = state.pkmnList.split(',');
		player.tiersSolved = [state.t1, state.t2, state.t3, state.t4, state.t5].map((n) => Number(n) || 0);
		player.customSolved = Number(state.customSolved) || 0;
		player.background = shop.background;
		player.playerIcon = shop.playerIcon;
		player.boughtBackgrounds = shop.boughtBackgrounds.split(',');
		player.boughtPlayerIcons = shop.boughtPlayerIcons.split(',');
		player.claimedSecrets = shop.claimedSecrets.split(',');
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
	}
</script>

<svelte:head>
	<title>Pokémath - Lagre</title>
	<meta name="title" content="Pokémath - Lagre" />
	<meta name="description" content="Side for å lagre og laste opp din fremdrift!" />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="main">
	<h1 class="center">Lagre og Last Opp (Beta)</h1>
	<div id="downloadSection" class="center datasection img-downloadSection">
		<h2>Lagre</h2>
		<p>
			Her kan du lagre dataen din som en fil, og laste ned til din enhet.<br />
			Denne funksjonen er under utvikling, og det kan derfor hende at den ikke alltid fungerer.<br />
			Det kan hende at filen er korrupt (altså, den kan ikke leses), eller andre feil.<br /><br />
			Hvis du møter på slike feil, vennligst rapporter de til oss via "Kontakt Oss".
		</p>
		<p>Vennligst ikke del lagringsdataen din med andre spillere.</p>
		<button onclick={download} class="button-1">Last ned</button>
	</div>
	<div id="uploadSection" class="center datasection img-uploadSection">
		<h2>Last opp</h2>
		<p>Her kan du laste opp dataen fra en fil du har lastet ned fra før, for å få tilbake pokemonene dine.</p>
		<h3>ADVARSEL:</h3>
		<p>
			Hvis du laster opp en .pkmth fil her, vil alt du har inne fra før bli overskrevet, og slettet. <br />
			Det er ingen måte å få det tilbake på, hvis du ikke har lagret en annen fil.
		</p>
		<label for="fileInput" class="button-1">
			Velg fil...
			<input id="fileInput" type="file" name="file" onchange={upload} />
		</label>
	</div>
</div>
