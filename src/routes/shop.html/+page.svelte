<script>
	// The shop, ported from static/shop.html and shop.js: backgrounds, upgrades, stardust and
	// player icons. Buttons marked "disabled" stay clickable, as before, and explain why on a tap.
	import { player } from '#lib/player.svelte.js';
	import { toast } from '#lib/toast.svelte.js';
	import { BADGE_IDS, incrementProgress } from '#lib/achievements.js';
	import { BG_ITEMS, ICON_ITEMS } from '#lib/data/cosmetics.js';
	import { getOrCreateUUID } from '#lib/uuid.js';
	import { onMount } from 'svelte';

	/**
	 * @typedef {'shinyLevel' | 'legendLevel' | 'mythicLevel' | 'coinLevel'} UpgradeKey
	 * @typedef {{ key: UpgradeKey, id: string, title: string, image: string, max: number, help: string, done: (level: number) => string }} Upgrade
	 */

	/** @type {Upgrade[]} */
	const UPGRADES = [
		{ key: 'shinyLevel', id: 'shinyShop', title: 'Shiny Charm', image: 'images/shinycharm.png', max: 150,
			help: 'Hvert nivå vil øke sjansen din for å fange en Shiny pokèmon, bittelitt!',
			done: (level) => `Shiny Charm ble oppgradert til nivå ${level}!` },
		{ key: 'legendLevel', id: 'legendShop', title: 'Legend Lure', image: 'images/lure_legend.svg', max: 15,
			help: 'Hvert nivå vil øke sjansen din for å fange en legendarisk pokèmon! På maks nivå vil de være like vanlige som andre pokèmon',
			done: (level) => `Legend Lure ble oppgradert til nivå ${level}!` },
		{ key: 'mythicLevel', id: 'mythicShop', title: 'Mythic Lure', image: 'images/lure.svg', max: 25,
			help: 'Hvert nivå vil øke sjansen din for å fange en mytisk pokèmon! På maks nivå vil de være like vanlige som andre pokèmon',
			done: (level) => `Mythic Lure ble oppgradert til nivå ${level}!` },
		{ key: 'coinLevel', id: 'coinShop', title: 'Repeat Coins', image: 'images/coinbag.svg', max: 150,
			help: 'Øker hvor mye penger du får når du fanger en pokémon du har fra før!',
			done: (level) => `Repeat Coins ble oppgradert til nivå ${level}!` }
	];

	/**
	 * The price of the next level, from loadShopLocal().
	 * @param {UpgradeKey} key
	 * @param {number} level
	 */
	function upgradePrice(key, level) {
		/** @param {number} base @param {number} [exponent] */
		const curve = (base, exponent = 1.3) => Math.ceil((base * level ** exponent) / 100) * 100 + base;
		switch (key) {
			case 'shinyLevel': return curve(100);
			case 'legendLevel': return curve(1000);
			case 'mythicLevel': return curve(2000);
			case 'coinLevel':
				return level < 50 ? curve(200, 1.1) : Math.ceil(((200 + 20000) * (level - 49) ** 1.3) / 100) * 200 + 200;
		}
	}

	/** Stardust gets 20% dearer with every purchase. */
	const baitPrice = $derived(Math.round(25000 * Math.pow(1.2, player.shinyBaitPurchases)));

	/** "25 000" → 25000, the way shop.js reads prices back from the page. @param {string | number} price */
	const parsePrice = (price) => Number((price + ' ').replace(' ', ''));

	// Icons: free, always for sale, ten that rotate every Monday, and exclusive ones you own.
	/**
	 * @template T
	 * @param {T[]} items
	 * @param {number} seed
	 */
	function seededShuffle(items, seed) {
		const a = [...items];
		let s = seed >>> 0;
		for (let i = a.length - 1; i > 0; i--) {
			s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
			const j = s % (i + 1);
			[a[i], a[j]] = [a[j], a[i]];
		}
		return a;
	}
	const WEEK = 7 * 24 * 60 * 60 * 1000;
	// The Unix epoch was a Thursday; shifting by three days makes the week start on Monday.
	let weekSeed = $state(Math.floor((Date.now() - 3 * 24 * 60 * 60 * 1000) / WEEK));
	$effect(() => {
		// Recompute in the browser: the prerendered page would otherwise keep the build week.
		weekSeed = Math.floor((Date.now() - 3 * 24 * 60 * 60 * 1000) / WEEK);
	});
	const iconSections = $derived([
		{ id: 'exclusiveIconSection', gridId: 'exclusiveIconGrid', title: '✨ Eksklusive karakterer', note: 'Kun via koder og premier',
			items: ICON_ITEMS.filter((i) => i.price === -1 && player.boughtPlayerIcons.includes(i.id)) },
		{ id: '', gridId: 'weeklyIconGrid', title: 'Ukentlig utvalg', note: 'Bytter hver mandag',
			items: seededShuffle(ICON_ITEMS.filter((i) => i.price > 5000), weekSeed).slice(0, 10) },
		{ id: '', gridId: 'alwaysIconGrid', title: 'Alltid tilgjengelig', note: '', items: ICON_ITEMS.filter((i) => i.price === 5000) },
		{ id: '', gridId: 'freeIconGrid', title: 'Gratis', note: '', items: ICON_ITEMS.filter((i) => i.price === 0) }
	]);

	let carouselIndex = $state(0);
	// The legacy carousel has no position until an arrow is first used.
	let carouselMoved = $state(false);

	/** @param {number} direction */
	function carouselStep(direction) {
		carouselIndex = (carouselIndex + direction + BG_ITEMS.length) % BG_ITEMS.length;
		carouselMoved = true;
	}

	// Visiting the shop is where most players get their anonymous id, which the game's
	// "playing now" ping needs (getOrCreateUUID() in shop.js).
	onMount(() => {
		getOrCreateUUID();
	});

	// Free icons count as owned (live shop.js, 2026-10). Like the live shop, they join the list in
	// memory when the shop opens and are saved with the next purchase or change of icon.
	let freeAdded = false;
	$effect(() => {
		if (!player.loaded || freeAdded) return;
		freeAdded = true;
		for (const item of ICON_ITEMS) {
			if (item.price === 0 && !player.boughtPlayerIcons.includes(item.id)) player.boughtPlayerIcons.push(item.id);
		}
	});

	/** @param {number} price */
	function canAfford(price) {
		if (player.money >= price) return true;
		toast('Du har ikke nok mynter!', { bad: true });
		return false;
	}

	/** @param {number} price */
	function pay(price) {
		incrementProgress(BADGE_IDS.bigSpender, price);
		player.spendMoney(price);
	}

	/** @param {import('#lib/data/cosmetics.js').BackgroundItem} item */
	function buyBackground(item) {
		const price = parsePrice(item.price);
		if (!canAfford(price)) return;
		if (player.boughtBackgrounds.includes(item.id)) return toast('Du eier allerede denne!', { bad: true });
		pay(price);
		player.boughtBackgrounds.push(item.id);
		player.save('background');
	}

	/** @param {string} id */
	function useBackground(id) {
		if (!player.boughtBackgrounds.includes(id)) return;
		if (id === player.background) return toast('Du bruker allerede denne bakgrunnen!', { bad: true });
		player.background = id;
		localStorage.setItem('shopBackground', JSON.stringify(id));
		toast('Bakgrunnen ble endret!');
	}

	function removeBackground() {
		if (player.background === '') return;
		player.background = '';
		localStorage.setItem('shopBackground', JSON.stringify(''));
		toast('Bakgrunnen ble fjernet!');
	}

	/** @param {import('#lib/data/cosmetics.js').IconItem} item */
	function buyIcon(item) {
		// Exclusive icons (-1) only come from codes and prizes.
		if (item.price === -1) return;
		if (!canAfford(item.price)) return;
		if (player.boughtPlayerIcons.includes(item.id)) return toast('Du eier allerede denne figuren!', { bad: true });
		pay(item.price);
		player.boughtPlayerIcons.push(item.id);
		player.save('playerIcon');
	}

	/** @param {import('#lib/data/cosmetics.js').IconItem} item */
	function useIcon(item) {
		if (!player.boughtPlayerIcons.includes(item.id) && item.price !== 0) return;
		if (item.id === player.playerIcon) return toast('Du bruker allerede denne figuren!', { bad: true });
		player.playerIcon = item.id;
		player.playerIconImg = item.img;
		localStorage.setItem('playerIcon', JSON.stringify(item.id));
		localStorage.setItem('playerIconImg', item.img);
		toast('Figuren ble endret!');
	}

	/** @param {Upgrade} upgrade */
	function buyUpgrade(upgrade) {
		const level = player[upgrade.key];
		const price = upgradePrice(upgrade.key, level);
		if (level >= upgrade.max) return toast('Du har nådd maks nivå', { bad: true });
		if (!canAfford(price)) return;
		pay(price);
		player[upgrade.key]++;
		player.save('upgrades');
		toast(upgrade.done(player[upgrade.key]));
	}

	function buyStardust() {
		const price = baitPrice;
		if (!canAfford(price)) return;
		pay(price);
		player.shinyBaitCount++;
		player.shinyBaitPurchases++;
		player.save('shinyBait');
		toast('Stardust purchased! You have: ' + player.shinyBaitCount);
	}
</script>

<svelte:head>
	<title>Pokémath - Butikk</title>
	<meta name="title" content="Pokémath - Butikk" />
	<meta name="description" content="Butikken til Pokemath hvor man kan kjøpe oppgraderinger." />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<!--
	Class names such as shopObject, shopButton, pricetag, buy, use and disabled are the hooks the
	parity tests share with the legacy shop; the look comes from the pm- classes and the styles below.
-->
<div class="main pm-page shop">
	<h1 class="pm-title">Butikk</h1>

	<h2 class="pm-section-title">Oppgraderinger</h2>
	<div class="upgrades">
		{#each UPGRADES as upgrade (upgrade.key)}
			{@const level = player[upgrade.key]}
			{@const price = upgradePrice(upgrade.key, level)}
			{@const maxed = level >= upgrade.max}
			<div id={upgrade.id} class="shopObject item pm-surface" data-price="0" data-level="0">
				<img src={upgrade.image} width="64" height="64" alt="" />
				<h3>{upgrade.title}</h3>
				<p class="help">{upgrade.help}</p>
				<div class="level">
					<span class="{upgrade.key} levelIndicator" data-level={level}>Nivå {level} av {upgrade.max}</span>
					<span class="level-bar" aria-hidden="true"><span style:width="{(level / upgrade.max) * 100}%"></span></span>
				</div>
				<div class="buy-row">
					{#if maxed}
						<span class="pricetag maxed" data-price={price}>Maks nivå</span>
					{:else}
						<span class="pricetag pm-price" data-price={price}>{price.toLocaleString('no-NO')}</span>
					{/if}
					<button
						class="pm-button small shopButton upgrade"
						class:disabled={!(player.money >= price && level < upgrade.max)}
						onclick={() => buyUpgrade(upgrade)}>Oppgrader</button
					>
				</div>
			</div>
		{/each}
		<div id="shinyBaitShop" class="shopObject item pm-surface">
			<img src="images/stardust.png" width="64" height="64" alt="" />
			<h3>Stardust</h3>
			<p class="help">Den neste Pokémonen du fanger blir garantert shiny! Hvert kjøp gjelder én fangst.</p>
			<div class="level"><span class="shinyBaitStock">Du har: {player.shinyBaitCount}</span></div>
			<div class="buy-row">
				<span class="pricetag shinyBaitPrice pm-price" data-price={baitPrice.toLocaleString('no-NO')}>{baitPrice.toLocaleString('no-NO')}</span>
				<button class="pm-button small shopButton" class:disabled={player.money < baitPrice} onclick={buyStardust}>Kjøp</button>
			</div>
		</div>
	</div>

	<h2 class="pm-section-title">Bakgrunner <small>Brukes på hele nettsiden</small></h2>
	<div class="carousel-wrap" id="bgWrap">
		<button class="carousel-btn prev" onclick={() => carouselStep(-1)} aria-label="Forrige bakgrunn">‹</button>
		<div class="carousel">
			<div class="carousel-track" data-idx={carouselIndex} style:transform={carouselMoved ? `translateX(-${carouselIndex * 100}%)` : null}>
				{#each BG_ITEMS as item (item.id)}
					{@const owned = player.boughtBackgrounds.includes(item.id)}
					<div class="carousel-cell" style="background-image:url('images/backgrounds/{item.id}.png')">
						<div class="carousel-caption" id={item.id}>
							<h3>{item.name}</h3>
							{#if owned}
								<span class="owned pricetag" data-price={item.price}>{item.id === player.background ? 'I bruk' : 'Eid'}</span>
							{:else}
								<span class="pricetag pm-price" data-price={item.price}>{item.price}</span>
							{/if}
							<span class="caption-buttons">
								<button
									class="pm-button small green buy"
									class:disabled={owned || parsePrice(item.price) > player.money}
									onclick={() => buyBackground(item)}>Kjøp</button
								>
								<button class="pm-button small secondary use" class:disabled={!owned} onclick={() => useBackground(item.id)}>Bruk</button>
							</span>
						</div>
					</div>
				{/each}
			</div>
		</div>
		<button class="carousel-btn next" onclick={() => carouselStep(1)} aria-label="Neste bakgrunn">›</button>
	</div>
	<div class="remove-row">
		<button class="pm-button small secondary use centerposition" onclick={removeBackground}>Fjern bakgrunn</button>
	</div>

	<div class="icon-shop">
		<div class="icon-shop-header">
			<h2 class="pm-section-title icon-shop-title">Figurer</h2>
			<a href="/player_profile.html" class="pm-button small secondary">Min profil</a>
		</div>

		{#each iconSections as section (section.gridId)}
			{@const hidden = section.gridId === 'exclusiveIconGrid' && section.items.length === 0}
			<div class="icon-section" id={section.id || null} style:display={hidden ? 'none' : null}>
				<h3 class="sub-title">
					{section.title}
					{#if section.note}<small class="week-note">{section.note}</small>{/if}
				</h3>
				<div class="icon-grid" id={section.gridId}>
					{#each section.items as item (item.id)}
						{@const owned = player.boughtPlayerIcons.includes(item.id)}
						<!-- Free icons have no price tag, which the legacy shop treated as always usable. -->
						{@const hasPrice = item.price !== 0}
						<div class="icon-card pm-surface" class:in-use={item.id === player.playerIcon} id={item.id}>
							<img src={item.img} class="icon-card-img" alt="" loading="lazy" />
							<div class="icon-card-name">{item.name}</div>
							{#if hasPrice && !owned && item.price !== -1}
								<span class="pricetag pm-price" data-price={item.price}>{item.price.toLocaleString('no-NO')}</span>
							{:else}
								<span class="owned">{item.id === player.playerIcon ? 'I bruk' : owned || !hasPrice ? 'Din' : ''}</span>
							{/if}
							<div class="icon-card-actions">
								{#if hasPrice}
									<button
										class="pm-button small green buy"
										class:disabled={owned || item.price === -1 || item.price > player.money}
										onclick={() => buyIcon(item)}>Kjøp</button
									>
								{/if}
								<button
									class="pm-button small secondary use"
									class:disabled={!(owned || !hasPrice || item.price === -1)}
									onclick={() => useIcon(item)}>Bruk</button
								>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.upgrades {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 14px;
	}
	.item {
		display: grid;
		grid-template-columns: 64px 1fr;
		grid-template-areas: 'img title' 'img help' 'level level' 'buy buy';
		column-gap: 14px;
		row-gap: 4px;
		padding: 16px;
	}
	.item img {
		grid-area: img;
		width: 64px;
		height: 64px;
		object-fit: contain;
	}
	.item h3 {
		grid-area: title;
		margin: 0;
		font-family: var(--pm-display);
		font-weight: 400;
		font-size: 22px;
	}
	.help {
		grid-area: help;
		margin: 0;
		color: var(--pm-ink-soft);
		font-size: 15px;
		line-height: 1.35;
	}
	.level {
		grid-area: level;
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 10px;
		font-size: 14px;
		font-weight: 700;
		white-space: nowrap;
	}
	.level-bar {
		flex: 1;
		height: 8px;
		overflow: hidden;
		border-radius: 999px;
		background: var(--pm-cream);
		box-shadow: inset 0 0 0 1px var(--pm-line);
	}
	.level-bar span {
		display: block;
		min-width: 4px;
		height: 100%;
		border-radius: 999px;
		background: var(--pm-gold);
	}
	.buy-row {
		grid-area: buy;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		margin-top: 12px;
	}
	.maxed,
	.owned {
		color: var(--pm-green-deep);
		font-family: var(--pm-display);
		font-size: 18px;
	}

	/* Backgrounds: one big preview at a time, with round arrows on each side. */
	.carousel-wrap {
		position: relative;
	}
	.carousel {
		overflow: hidden;
		border-radius: var(--pm-radius);
		box-shadow: var(--pm-shadow), 0 0 0 1px var(--pm-line);
	}
	.carousel-track {
		display: flex;
		transition: transform 300ms cubic-bezier(0.25, 1, 0.5, 1);
	}
	.carousel-cell {
		position: relative;
		flex: 0 0 100%;
		aspect-ratio: 16 / 7;
		min-height: 220px;
		background-size: cover;
		background-position: center;
	}
	.carousel-caption {
		position: absolute;
		left: 12px;
		right: 12px;
		bottom: 12px;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 14px;
		padding: 10px 14px;
		border-radius: 14px;
		background: oklch(0.995 0.004 85 / 0.92);
		box-shadow: var(--pm-shadow);
	}
	.carousel-caption h3 {
		margin: 0;
		font-family: var(--pm-display);
		font-weight: 400;
		font-size: 20px;
	}
	.caption-buttons {
		display: flex;
		gap: 8px;
		margin-left: auto;
	}
	.carousel-btn {
		position: absolute;
		top: 50%;
		z-index: 2;
		width: 48px;
		height: 48px;
		margin-top: -24px;
		border: none;
		border-radius: 50%;
		background: var(--pm-paper);
		box-shadow: var(--pm-shadow), 0 0 0 1px var(--pm-line);
		color: var(--pm-ink);
		font-size: 30px;
		line-height: 1;
		cursor: pointer;
	}
	.carousel-btn.prev {
		left: -12px;
	}
	.carousel-btn.next {
		right: -12px;
	}
	.remove-row {
		margin-top: 14px;
		text-align: center;
	}

	/* Player icons */
	.icon-shop-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
	}
	.sub-title {
		display: flex;
		align-items: baseline;
		gap: 10px;
		margin: 18px 0 10px;
		font-size: 18px;
	}
	.sub-title small {
		color: var(--pm-ink-soft);
		font-size: 14px;
		font-weight: 400;
	}
	.icon-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 12px;
	}
	.icon-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 12px 10px;
		text-align: center;
	}
	.icon-card.in-use {
		box-shadow: var(--pm-shadow), 0 0 0 3px var(--pm-green);
	}
	.icon-card-img {
		width: 100%;
		max-width: 120px;
		aspect-ratio: 1;
		object-fit: contain;
		border-radius: 12px;
		background: var(--pm-cream);
	}
	.icon-card-name {
		font-family: var(--pm-display);
		font-size: 18px;
	}
	.icon-card .owned {
		min-height: 22px;
		font-size: 16px;
	}
	.icon-card-actions {
		display: flex;
		gap: 6px;
		margin-top: auto;
	}

	@media (max-width: 480px) {
		.upgrades {
			grid-template-columns: 1fr;
		}
		.carousel-cell {
			aspect-ratio: auto;
			min-height: 260px;
		}
		.carousel-btn {
			top: 70px;
		}
		.carousel-btn.prev {
			left: 6px;
		}
		.carousel-btn.next {
			right: 6px;
		}
		.caption-buttons {
			width: 100%;
			margin-left: 0;
		}
		.caption-buttons .pm-button {
			flex: 1;
		}
		.icon-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (pointer: coarse) {
		.pm-button.small {
			min-height: 44px;
		}
	}
</style>
