<script>
	// One setting in a class game's setup, picked by tapping a card, so the setups of every game
	// look and work alike.
	/**
	 * @template {string} T
	 * @typedef {{ value: T, title: string, sub?: string }} Choice
	 */
	/**
	 * @type {{
	 *   id: string, label: string, hint?: string,
	 *   options: Choice<string>[],
	 *   value: string,
	 *   min?: number
	 * }}
	 */
	let { id, label, hint, options, value = $bindable(), min = 110 } = $props();
</script>

<div class="choice">
	<h3 id="{id}-label">{label}</h3>
	<div class="options" {id} role="radiogroup" aria-labelledby="{id}-label" style:--min="{min}px">
		{#each options as option (option.value)}
			<button
				type="button"
				class="option"
				class:picked={value === option.value}
				role="radio"
				aria-checked={value === option.value}
				data-value={option.value}
				onclick={() => (value = option.value)}
			>
				<strong>{option.title}</strong>
				{#if option.sub}<span>{option.sub}</span>{/if}
			</button>
		{/each}
	</div>
	{#if hint}<p class="hint">{hint}</p>{/if}
</div>

<style>
	.choice {
		margin-bottom: 14px;
	}
	h3 {
		margin: 0 0 8px;
		font-size: 17px;
	}
	.options {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(var(--min), 1fr));
		gap: 8px;
	}
	.option {
		display: grid;
		align-content: center;
		justify-items: center;
		gap: 2px;
		min-height: 52px;
		padding: 8px 6px;
		border: 2px solid var(--pm-line);
		border-radius: 14px;
		background: var(--pm-paper);
		color: var(--pm-ink);
		font: 600 14px/1.2 var(--pm-body);
		text-align: center;
		cursor: pointer;
	}
	.option strong {
		font: 400 18px/1.1 var(--pm-display);
	}
	.option span {
		color: var(--pm-ink-soft);
	}
	.picked {
		border-color: var(--pm-red);
		background: var(--pm-red-soft);
	}
	.hint {
		margin: 6px 0 0;
		color: var(--pm-ink-soft);
		font-size: 13px;
	}
</style>
