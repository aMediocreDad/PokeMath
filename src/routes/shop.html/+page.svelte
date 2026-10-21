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
		if (!player.boughtPlayerIcons.includes(item.id)) return;
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
	<link rel="stylesheet" href="/menustyle.css?v=100" />
	<link rel="stylesheet" href="/shop.css?v=102" />
</svelte:head>

{#snippet hover(/** @type {string} */ text)}
	<!-- Focusable, so a tap opens the explanation on touch screens (it opened on hover only). -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<span class="hovertext" data-hover={text} tabindex="0" role="note" aria-label={text}>?</span>
{/snippet}

<div class="main">
	<div class="carousel-wrap" id="bgWrap">
		<button class="carousel-btn" onclick={() => carouselStep(-1)}>&#8249;</button>
		<div class="carousel">
			<div class="carousel-track" data-idx={carouselIndex} style:transform={carouselMoved ? `translateX(-${carouselIndex * 100}%)` : null}>
				{#each BG_ITEMS as item (item.id)}
					{@const owned = player.boughtBackgrounds.includes(item.id)}
					<div class="carousel-cell" style="background-image:url('images/backgrounds/{item.id}.png')">
						<div class="carousel-caption" id={item.id}>
							<h3>{item.name}</h3>
							<!-- svelte-ignore a11y_missing_attribute, a11y_consider_explicit_label -->
							<a class="pricetag" data-price={item.price}></a>
							<br /><br />
							<button
								class="button-1 buy"
								class:disabled={owned || parsePrice(item.price) > player.money}
								onclick={() => buyBackground(item)}>Kjøp</button
							>
							<button class="button-1 use" class:disabled={!owned} onclick={() => useBackground(item.id)}>Bruk</button>
							<br />
							{@render hover('Denne bakgrunnen kan du bruke på hele nettsiden!')}
						</div>
					</div>
				{/each}
			</div>
		</div>
		<button class="carousel-btn" onclick={() => carouselStep(1)}>&#8250;</button>
	</div>
	<button class="button-1 use centerposition" onclick={removeBackground}>Fjern Bakgrunn</button>
	<br />

	<div class="shopButtons columns is-multiline is-mobile">
		<br />
		{#each UPGRADES as upgrade (upgrade.key)}
			{@const level = player[upgrade.key]}
			{@const price = upgradePrice(upgrade.key, level)}
			<div id={upgrade.id} class="shopObject card" data-price="0" data-level="0">
				<img src={upgrade.image} width="75" height="75" alt="" />
				<h3>{upgrade.title}</h3>
				<!-- svelte-ignore a11y_missing_attribute -->
				<a class="{upgrade.key} levelIndicator" data-level={level}>Nivå: </a>
				<br />
				<!-- svelte-ignore a11y_missing_attribute, a11y_consider_explicit_label -->
				<a class="pricetag" data-price={price}></a>
				<br />
				<br />
				<button
					class="button-1 shopButton upgrade"
					class:disabled={!(player.money >= price && level < upgrade.max)}
					onclick={() => buyUpgrade(upgrade)}>Oppgrader</button
				>
				{@render hover(upgrade.help)}
			</div>
		{/each}
		<div id="shinyBaitShop" class="shopObject card">
			<img src="images/stardust.png" width="75" height="75" alt="" />
			<h3>Stardust</h3>
			<!-- svelte-ignore a11y_missing_attribute -->
			<a class="shinyBaitStock">Du Har: {player.shinyBaitCount}</a>
			<br />
			<!-- svelte-ignore a11y_missing_attribute, a11y_consider_explicit_label -->
			<a class="pricetag shinyBaitPrice" data-price={baitPrice.toLocaleString('no-NO')}></a>
			<br />
			<br />
			<button class="button-1 shopButton" class:disabled={player.money < baitPrice} onclick={buyStardust} style="min-width:88px"
				>Kjøp</button
			>
			{@render hover('Den neste pokemonen du fanger vil garantert være shiny! Hvert kjøp gjelder bare for 1 fangst. Du kan kjøpe flere av denne.')}
		</div>
	</div>

	<div class="icon-shop">
		<div class="icon-shop-header">
			<h2 class="icon-shop-title">Figurer</h2>
			<a href="/player_profile.html" class="button-1" style="text-decoration:none;">Min profil</a>
		</div>

		<div class="icon-shop-box">
			{#each iconSections as section (section.gridId)}
				{@const hidden = section.gridId === 'exclusiveIconGrid' && section.items.length === 0}
				<div class="icon-section" id={section.id || null} style:display={hidden ? 'none' : null}>
						<h3>
							{section.title}
							{#if section.note}<small class="week-note">{section.note}</small>{/if}
						</h3>
						<div class="icon-grid" id={section.gridId}>
							{#each section.items as item (item.id)}
								{@const owned = player.boughtPlayerIcons.includes(item.id)}
								<!-- Free icons have no price tag, which the legacy shop treated as always usable. -->
								{@const hasPrice = item.price !== 0}
								<div class="icon-card" id={item.id}>
									<img src={item.img} class="icon-card-img" alt={item.name} loading="lazy" />
									<div class="icon-card-name">{item.name}</div>
									{#if hasPrice}
										<!-- svelte-ignore a11y_missing_attribute, a11y_consider_explicit_label -->
										<a class="pricetag" data-price={item.price}>{item.price.toLocaleString('no-NO')}</a>
									{/if}
									<div class="icon-card-actions">
										{#if hasPrice}
											<button
												class="button-1 buy"
												class:disabled={owned || item.price === -1 || item.price > player.money}
												onclick={() => buyIcon(item)}>Kjøp</button
											>
										{/if}
										<button
											class="button-1 use"
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

	<div style="height:60px"></div>
</div>

<style>
	.hovertext:focus::before {
		opacity: 1;
		visibility: visible;
	}

	@media (max-width: 720px) {
		/* Tall enough for the name, price and buttons, which spilled over the next button before. */
		.carousel {
			width: calc(100vw - 112px);
			height: max(56vw, 230px);
		}
		.shopButtons {
			padding: 12px;
		}
	}

	@media (pointer: coarse) {
		.icon-card-actions .button-1 {
			min-height: 44px;
		}
	}
</style>
