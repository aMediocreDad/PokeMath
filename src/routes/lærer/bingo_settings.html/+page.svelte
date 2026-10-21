<script>
	// Bingo settings, ported from static/lærer/bingo_settings.html and bingo_settings.js. The choices
	// go to sessionStorage under 'bingoSettings', where the host page reads them.
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import TeacherPage from '#lib/TeacherPage.svelte';
	import { getTeacherSession } from '#lib/teacher.js';

	const DEFAULTS = { difficulty: 'medium', minLevel: 'alle', className: '', prizeType: 'random', prizeSecret: false };

	/** null until the browser has checked for a teacher session */
	let loggedIn = $state(/** @type {boolean | null} */ (null));
	let settings = $state({ ...DEFAULTS });
	let status = $state('');
	let starting = $state(false);

	onMount(() => {
		loggedIn = !!getTeacherSession();
		if (!loggedIn) return;
		// Restore the previous choices.
		try {
			const prev = JSON.parse(sessionStorage.getItem('bingoSettings') || '{}');
			if (prev.difficulty) settings.difficulty = prev.difficulty;
			if (prev.minLevel) settings.minLevel = prev.minLevel;
			if (prev.className) settings.className = prev.className;
			if (prev.prizeType) settings.prizeType = prev.prizeType;
			if (prev.prizeSecret !== undefined) settings.prizeSecret = !!prev.prizeSecret;
		} catch {
			// A broken value is ignored, as before.
		}
	});

	function start() {
		const { difficulty, minLevel, prizeType, prizeSecret } = settings;
		sessionStorage.setItem(
			'bingoSettings',
			JSON.stringify({ difficulty, minLevel, className: settings.className.trim(), prizeType, prizeSecret })
		);
		status = 'Starter bingo…';
		starting = true;
		goto('/lærer/bingo_host.html');
	}

	function reset() {
		settings = { ...DEFAULTS };
		sessionStorage.removeItem('bingoSettings');
		status = '';
	}
</script>

<svelte:head>
	<title>PokeMath Bingo – Innstillinger</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<TeacherPage subtitle="Bingo · Innstillinger" back={{ href: '/lærer/index.html', label: 'Tilbake' }}>
	<section class="panel warn">
		<h1>Bingo er et eksperiment</h1>
		<p>Dette er en testfunksjon. Ikke del sensitiv info. Data lagres på DreamHost-servere (utenfor Norge).</p>
	</section>

	{#if loggedIn === false}
		<section class="panel" id="mustLogin">
			<h2>Du må være logget inn</h2>
			<p class="muted">Gå tilbake og logg inn før du kan starte bingo.</p>
			<div class="actions"><a class="pm-button small" href="/lærer/index.html">Gå til innlogging</a></div>
		</section>
	{:else if loggedIn}
		<section class="panel" id="settingsBox">
			<h2>Innstillinger</h2>
			<p class="muted">Velg vanskelighetsgrad. Du kan lage nytt spill senere fra host-siden.</p>
			<div class="form-grid">
				<label class="field">
					<span>Vanskelighetsgrad</span>
					<select id="difficulty" bind:value={settings.difficulty}>
						<option value="easy">Enkel</option>
						<option value="medium">Middels</option>
						<option value="hard">Vanskelig</option>
						<option value="extreme">Ekstrem</option>
						<option value="unik">Unik - kun unike pokémon-ID-er</option>
					</select>
					<small>Bestemmer hvilke typer oppgaver som kan dukke opp på brettet.</small>
				</label>
				<label class="field">
					<span>Minimum arbeidsnivå</span>
					<select id="minLevel" bind:value={settings.minLevel}>
						<option value="alle">Alle nivåer godkjent</option>
						<option value="stage1">Nivå 1 eller høyere</option>
						<option value="stage2">Nivå 2 eller høyere</option>
						<option value="stage3">Nivå 3 eller høyere</option>
						<option value="stage4">Nivå 4 eller høyere</option>
						<option value="stage5">Kun nivå 5</option>
					</select>
					<small>Pokémon fanget på lavere nivå vises i loggen, men teller ikke på brettet.</small>
				</label>
				<label class="field">
					<span>Klasse-navn (valgfritt)</span>
					<input id="className" type="text" maxlength="40" placeholder="F.eks. 7A" bind:value={settings.className} />
					<small>Kun for visning (ikke sensitiv info).</small>
				</label>
				<label class="field">
					<span>Premie ved fullføring</span>
					<select id="prizeType" bind:value={settings.prizeType}>
						<option value="random">Tilfeldig (standard)</option>
						<option value="coins">Mynter</option>
						<option value="legendary">Legendarisk Pokémon</option>
						<option value="mythic">Mytisk Pokémon</option>
						<option value="shiny">Shiny Pokémon (×3)</option>
						<option value="participation_coins">Pott: 2 000 per elev + 50 per fangst (fordeles etter deltakelse)</option>
						<option value="per_catch_coins">50 mynter per pokemon eleven fanget</option>
						<option value="stardust">Stardust (×1)</option>
					</select>
					<small>Gis til alle deltakere som fanget minst én Pokémon.</small>
				</label>
				<label class="check">
					<input type="checkbox" id="prizeSecret" bind:checked={settings.prizeSecret} />
					<span>Hemmelig premie <small>(skjul premieinfo på brett-skjermen)</small></span>
				</label>
			</div>
			<div class="actions">
				<button class="pm-button" id="startBtn" disabled={starting} onclick={start}>Start Bingo</button>
				<button class="pm-button small secondary" id="resetBtn" onclick={reset}>Nullstill</button>
			</div>
			<div class="status" id="status" role="status">{status}</div>
			<p class="small muted">Når du starter, blir du sendt til host-siden og en kode genereres der.</p>
		</section>
	{/if}
</TeacherPage>

<style>
	.check {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		font-weight: 700;
		cursor: pointer;
	}
	.check input {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
	}
	.check small {
		color: var(--pm-ink-soft);
		font-weight: 400;
	}
</style>
