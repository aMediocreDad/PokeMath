<script>
	// The bingo's setup, on the bingo screen itself as the raid's is. The choices are kept in
	// localStorage (teacherBingoSettings), so "Nytt brett" and the next lesson start from them.
	import { onMount } from 'svelte';
	import ChoiceGroup from './ChoiceGroup.svelte';

	/** @typedef {{ difficulty: string, minLevel: string, allowAdaptive: boolean, gridSize: number, className: string, prizeType: string, prizeSecret: boolean }} BingoSettings */

	/** @type {{ onCreate: (settings: BingoSettings) => void }} */
	let { onCreate } = $props();

	const KEY = 'teacherBingoSettings';
	const DEFAULTS = { difficulty: 'medium', minLevel: 'alle', allowAdaptive: false, gridSize: '5', className: '', prizeType: 'random', prizeSecret: false };
	let form = $state({ ...DEFAULTS });

	// Catches on the adaptive level can count too, unless every level or only that one already does.
	const showAdaptive = $derived(form.minLevel !== 'alle' && form.minLevel !== 'tilpasset');

	onMount(() => {
		try {
			// The settings page before this one kept them per tab, under bingoSettings.
			const saved = JSON.parse(localStorage.getItem(KEY) || sessionStorage.getItem('bingoSettings') || '{}');
			for (const key of /** @type {(keyof typeof DEFAULTS)[]} */ (Object.keys(DEFAULTS))) {
				if (saved[key] !== undefined) /** @type {any} */ (form)[key] = typeof DEFAULTS[key] === 'string' ? String(saved[key]) : !!saved[key];
			}
		} catch {
			// A broken value: the defaults do.
		}
	});

	function create() {
		/** @type {BingoSettings} */
		const settings = {
			...form,
			allowAdaptive: showAdaptive && form.allowAdaptive,
			gridSize: parseInt(form.gridSize) || 5,
			className: form.className.trim()
		};
		localStorage.setItem(KEY, JSON.stringify(settings));
		onCreate(settings);
	}
</script>

<section class="panel" id="bingoSetup">
	<h2>Ny bingo</h2>
	<ChoiceGroup
		id="difficulty"
		label="Vanskelighetsgrad"
		hint="Bestemmer hvilke oppgaver som kan dukke opp på brettet."
		bind:value={form.difficulty}
		options={[
			{ value: 'easy', title: 'Enkel' },
			{ value: 'medium', title: 'Middels' },
			{ value: 'hard', title: 'Vanskelig' },
			{ value: 'extreme', title: 'Ekstrem' },
			{ value: 'unik', title: 'Unik', sub: 'bare Pokédex-nummer' }
		]}
	/>
	<ChoiceGroup
		id="gridSize"
		label="Brettstørrelse"
		hint="Større brett gir flere ruter og lengre spill."
		min={84}
		bind:value={form.gridSize}
		options={['5', '7', '9', '11', '13', '15'].map((n) => ({ value: n, title: `${n}×${n}`, sub: n === '5' ? 'vanlig' : undefined }))}
	/>
	<ChoiceGroup
		id="minLevel"
		label="Laveste nivå som teller"
		hint="Pokémon fanget på lavere nivå vises i loggen, men teller ikke på brettet."
		min={96}
		bind:value={form.minLevel}
		options={[
			{ value: 'alle', title: 'Alle' },
			{ value: 'stage1', title: 'Nivå 1+' },
			{ value: 'stage2', title: 'Nivå 2+' },
			{ value: 'stage3', title: 'Nivå 3+' },
			{ value: 'stage4', title: 'Nivå 4+' },
			{ value: 'stage5', title: 'Nivå 5' },
			{ value: 'tilpasset', title: 'Tilpasset', sub: 'bare det' }
		]}
	/>
	{#if showAdaptive}
		<label class="check" id="allowAdaptiveRow">
			<input type="checkbox" id="allowAdaptive" bind:checked={form.allowAdaptive} />
			<span>Tilpasset nivå teller også</span>
		</label>
	{/if}
	<ChoiceGroup
		id="prizeType"
		label="Premie når brettet er fullt"
		hint="Alle som fanget minst én Pokémon får premien. Hver hele rad eller kolonne gir i tillegg 500 mynter."
		min={130}
		bind:value={form.prizeType}
		options={[
			{ value: 'random', title: 'Tilfeldig' },
			{ value: 'coins', title: 'Mynter' },
			{ value: 'legendary', title: 'Legendarisk' },
			{ value: 'mythic', title: 'Mytisk' },
			{ value: 'shiny', title: 'Shiny ×3' },
			{ value: 'stardust', title: 'Stardust' },
			{ value: 'participation_coins', title: 'Pott', sub: '2 000 per elev + 50 per fangst' },
			{ value: 'per_catch_coins', title: 'Per fangst', sub: '50 mynter per Pokémon' }
		]}
	/>
	<label class="check">
		<input type="checkbox" id="prizeSecret" bind:checked={form.prizeSecret} />
		<span>Hemmelig premie <small>(vises ikke på tavla)</small></span>
	</label>
	<label class="field class-name">
		<span>Klassenavn (valgfritt)</span>
		<input id="className" type="text" maxlength="40" placeholder="F.eks. 7A" bind:value={form.className} />
	</label>
	<div class="actions">
		<button class="pm-button" id="startBtn" onclick={create}>Lag bingo</button>
	</div>
</section>

<style>
	.check {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		margin-bottom: 8px;
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
	.class-name {
		max-width: 320px;
	}
</style>
