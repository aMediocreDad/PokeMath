<script>
	// The frame of every teacher page: a slim header with the logo and a way back, then the panels.
	// The shared form, button and status styles for those pages live here too.
	/** @type {{ subtitle: string, back?: { href: string, label: string }, narrow?: boolean, children: import('svelte').Snippet }} */
	let { subtitle, back, narrow = false, children } = $props();
</script>

<main class="pm-bare teacher" class:narrow>
	<header class="teacher-header">
		<a class="brand" href="/lærer/index.html">
			<img src="/images/logo.png" alt="" />
			<span>
				<span class="title">PokeMath – Lærer</span>
				<span class="subtitle">{subtitle}</span>
			</span>
		</a>
		{#if back}<a class="back" href={back.href}>← {back.label}</a>{/if}
	</header>
	{@render children()}
</main>

<style>
	.teacher {
		max-width: 860px;
		margin: 0 auto;
		padding: 18px 16px 48px;
		line-height: 1.45;
	}
	.teacher.narrow {
		max-width: 540px;
	}
	.teacher-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 18px;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 12px;
		color: var(--pm-ink);
	}
	.brand img {
		width: 72px;
		height: 40px;
		object-fit: contain;
	}
	.title {
		display: block;
		font-family: var(--pm-display);
		font-size: 22px;
	}
	.subtitle {
		display: block;
		color: var(--pm-ink-soft);
		font-size: 14px;
	}
	.back {
		color: var(--pm-ink-soft);
		font-weight: 700;
		white-space: nowrap;
	}

	/* Shared by the pages inside the frame. */
	.teacher :global(.panel) {
		margin-bottom: 14px;
		padding: 18px 20px;
		border-radius: var(--pm-radius);
		background: var(--pm-paper);
		box-shadow: var(--pm-shadow), 0 0 0 1px var(--pm-line);
	}
	.teacher :global(.panel.warn) {
		background: oklch(0.96 0.05 85);
		box-shadow: 0 0 0 1px oklch(0.85 0.1 85);
	}
	.teacher :global(.panel.subtle) {
		padding: 10px 14px;
		background: none;
		box-shadow: none;
	}
	.teacher :global(h1),
	.teacher :global(h2) {
		margin: 0 0 8px;
		font-family: var(--pm-display);
		font-weight: 400;
		font-size: 24px;
	}
	.teacher :global(p) {
		margin: 0 0 8px;
	}
	.teacher :global(.muted) {
		color: var(--pm-ink-soft);
	}
	.teacher :global(.small) {
		font-size: 13px;
	}
	.teacher :global(.form-grid) {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 12px;
		margin-top: 12px;
	}
	.teacher :global(.field) {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-weight: 700;
		font-size: 14px;
	}
	.teacher :global(.field small) {
		color: var(--pm-ink-soft);
		font-weight: 400;
	}
	.teacher :global(input:not([type='checkbox'])),
	.teacher :global(select) {
		min-height: 44px;
		padding: 0 12px;
		border: 2px solid var(--pm-line);
		border-radius: 10px;
		background: var(--pm-paper);
		color: var(--pm-ink);
		font: inherit;
		/* 16px or larger, or iOS zooms the page when the field is focused. */
		font-size: 16px;
		font-weight: 400;
	}
	.teacher :global(input:focus),
	.teacher :global(select:focus) {
		border-color: var(--pm-ink);
		outline: none;
	}
	.teacher :global(.actions) {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 14px;
	}
	.teacher :global(.pm-button.danger) {
		background: var(--pm-paper);
		color: var(--pm-red-deep);
		box-shadow: 0 0 0 2px var(--pm-red) inset, 0 4px 0 var(--pm-red-soft);
	}
	.teacher :global(.status) {
		min-height: 1.4em;
		margin-top: 10px;
		font-weight: 700;
	}
	.teacher :global(.status.good) {
		color: var(--pm-green-deep);
	}
	.teacher :global(.status.bad) {
		color: var(--pm-red-deep);
	}

	@media (max-width: 520px) {
		.back {
			display: none;
		}
	}
</style>
