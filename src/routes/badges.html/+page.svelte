<script>
	// Badges ("Merker"), ported from the badge grid in static/global.js. Every badge shows its
	// progress; the ones you have earned are in colour.
	import { onMount } from 'svelte';
	import { loadAchievements } from '#lib/achievements.js';

	/** @type {import('#lib/achievements.js').Achievements['badges']} */
	let badges = $state([]);
	onMount(() => (badges = loadAchievements().badges));

	const earned = $derived(badges.filter((b) => b.achieved).length);
	/** @param {number} n */
	const format = (n) => n.toLocaleString('no-NO');
</script>

<svelte:head>
	<title>Pokémath - Merker</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="main pm-page badges-page">
	<h1 class="pm-title">Merker</h1>
	{#if badges.length}
		<p class="lead">Du har {earned} av {badges.length} merker.</p>
	{/if}
	<div class="achievement-grid">
		{#each badges as badge (badge.id)}
			<div class="achievement pm-surface" class:achieved={badge.achieved}>
				<img src="/images/badges/{badge.id}.png" alt="" width="88" height="88" />
				<div class="badge-body">
					<h2>{badge.name}</h2>
					<p>{badge.description}</p>
					<div class="progress" aria-label="Fremgang {badge.progress} av {badge.goal}">
						<span style:width="{Math.min(100, (badge.progress / badge.goal) * 100)}%"></span>
					</div>
					<p class="count">
						{#if badge.achieved}Fullført!{:else}{format(badge.progress)} / {format(badge.goal)}{/if}
					</p>
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.lead {
		margin: -6px 0 18px;
		color: var(--pm-ink-soft);
		font-size: 18px;
	}
	.achievement-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 12px;
	}
	.achievement {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px;
	}
	.achievement.achieved {
		box-shadow: var(--pm-shadow), 0 0 0 3px var(--pm-gold);
	}
	img {
		flex-shrink: 0;
		width: 72px;
		height: 72px;
		object-fit: contain;
		filter: grayscale(1);
		opacity: 0.45;
	}
	.achieved img {
		filter: none;
		opacity: 1;
	}
	.badge-body {
		flex: 1;
		min-width: 0;
	}
	h2 {
		margin: 0;
		font-family: var(--pm-display);
		font-weight: 400;
		font-size: 19px;
	}
	p {
		margin: 2px 0 0;
		color: var(--pm-ink-soft);
		font-size: 14px;
	}
	.progress {
		height: 8px;
		margin-top: 8px;
		overflow: hidden;
		border-radius: 999px;
		background: var(--pm-cream);
		box-shadow: inset 0 0 0 1px var(--pm-line);
	}
	.progress span {
		display: block;
		height: 100%;
		border-radius: 999px;
		background: var(--pm-green);
	}
	.achieved .progress span {
		background: var(--pm-gold);
	}
	.count {
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.achieved .count {
		color: var(--pm-green-deep);
	}
</style>
