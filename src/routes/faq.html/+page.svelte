<script>
	import { onMount } from 'svelte';

	// PokéMath has cost about 300 kr a month since January 2021.
	const MONTHLY_COST = 300;
	const START = new Date(2021, 0, 1);

	// The page is prerendered at build time, so read the date again in the browser.
	let now = $state(new Date());
	onMount(() => (now = new Date()));

	const totalCost = $derived(
		((now.getFullYear() - START.getFullYear()) * 12 + (now.getMonth() - START.getMonth())) * MONTHLY_COST
	);
	const today = $derived(now.toDateString());

	let cacheMessage = $state('');

	async function clearCache() {
		const reload = () => (location.href = location.pathname + '?_=' + Date.now());
		if (!('caches' in window)) {
			cacheMessage = 'Laster inn siden på nytt...';
			setTimeout(reload, 800);
			return;
		}
		try {
			await Promise.all((await caches.keys()).map((name) => caches.delete(name)));
			cacheMessage = 'Cache tømt! Siden lastes inn på nytt...';
		} catch {
			cacheMessage = 'Tømte det som var mulig. Siden lastes inn på nytt...';
		}
		setTimeout(reload, 1200);
	}
</script>

<svelte:head>
	<title>Pokémath - FAQ</title>
	<meta name="title" content="Pokémath - FAQ" />
	<meta name="description" content="Ofte stilte spørsmål!" />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="main pm-page faq">
 <div class="container">
	<h1 class="pm-title faq-header">Ofte stilte spørsmål</h1>

	<div class="faq-content">
	  <div class="faq-question">
		<input id="q1" type="checkbox" class="panel">
		<div class="plus" aria-hidden="true">+</div>
		<label for="q1" class="panel-title">Hvorfor sletter dere pokemonene mine?</label>
		<div class="panel-content">
			<p>Kort forklart: Det gjør vi ikke.</p>
			<p>Det du har fanget, mynter og nivåer lagres i nettleseren din, og en kopi lagres i skyen sammen med innloggingen din. Logger du inn på en annen enhet, henter spillet kopien derfra.</p>
			<p><b>Noen mulige årsaker til at dataen din forsvinner er:</b></p>
			<p>- Du er logget inn med en annen kode eller e-post enn sist.<br>
			- Du spiller i et privat vindu i nettleseren. (Da blir ikke ting lagret)<br>
			- Du har et program som sletter nettleserdata.<br>
			- Det har skjedd en feil etter en oppdatering. </p>
			<p> En ting du kan gjøre, om du opplever at du hele tiden mister alt du har, er å ta i bruk <ins><a href="./saveandload.html">lagre og last opp</a></ins> funksjonen.</p>
		</div>
	</div>

	  <div class="faq-question">
		<input id="q2" type="checkbox" class="panel">
		<div class="plus" aria-hidden="true">+</div>
		<label for="q2" class="panel-title">Kan dere legge til trading / pokemon battles?</label>
		<div class="panel-content">
			<p>Foreløbig kan vi ikke det.<br>
				Vi er like glad i nye funksjoner som det dere er, men trading og battles vil kreve at vi kobler sammen to enheter på en eller annen måte. Dette krever servere som kan behandle den informasjonen, og i tillegg vil det gi oss nye GDPR utfordringer.
			</p>
		</div>
	  </div>

	  <div class="faq-question">
		<input id="q3" type="checkbox" class="panel">
		<div class="plus" aria-hidden="true">+</div>
		<label for="q3" class="panel-title">Hvordan tjener Pokémath penger?</label>
		<div class="panel-content">
			<p>Pokémath tjener ikke penger, med unntak av donasjoner fra lærere og foreldre som setter pris på arbeidet.<br>
			Faktisk så taper vi penger på å ha siden oppe, men det er heldigvis ikke mye.</p>
			<p>Vi betaler ca. 350kr i måneden for å holde siden oppe.<br>
			Ettersom vi ikke vil ha reklame på nettsiden, og nettsiden ikke koster penger å ta i bruk, så tjener vi ingenting på nettsiden.</p>
			<p class="cost-display">Totalt har pokemath så langt kostet ca. <span id="total-cost">{totalCost}</span> kr.</p>
			Dette er ikke medregnet arbeidstimene som er lagt inn, eller betalingen for kunsten på f.eks julekalenderen.<br>

			<br>
			Vi tar i mot donasjoner på <a href="about.html#contact">Kontakt oss</a> siden vår!
		</div>
	  </div>

	  <div class="faq-question">
		<input id="q4" type="checkbox" class="panel">
		<div class="plus" aria-hidden="true">+</div>
		<label for="q4" class="panel-title">Jeg har mistet alle mine pokemon. Kan jeg få de tilbake?</label>
		<div class="panel-content">
			<p>Hvis du er uheldig og har slettet alle dine pokemon, så er det dessverre ingenting vi kan gjøre.<br>
			All brukerdata er lagret på din egen enhet, og blir ikke sendt inn til oss. På denne måten unngår vi store GDPR problemer.<br>
		<br>Det eneste håpet du har, er om du har en gammel nedlastet lagringsfil fra <ins><a href="./saveandload.html">lagre og last opp</a></ins> funksjonen.</p>
		</div>
	  </div>
	  <div class="faq-question">
		<input id="q5" type="checkbox" class="panel">
		<div class="plus" aria-hidden="true">+</div>
		<label for="q5" class="panel-title">Vennene mine har funksjoner som ikke jeg har. Hvordan kan jeg få de?</label>
		<div class="panel-content">
			<p>Det kan hende at nettleseren "husker" en gammel versjon av nettsiden, og for å spare data, så bruker nettleseren den versjonen, istedet for å laste inn den nye.<br><br>
			På PC kan man tvinge nettleseren til å laste inn ny informasjon, ved å holde nede CTRL knappen og trykke F5. (Refresh).<br>
			På Mac kan man gjøre det samme med Command og F5.<br>
			På iPad eller mobil kan du prøve å lukke nettleseren helt (kast den ut), starte enheten på nytt, og så prøve å laste inn siden på nytt. Det er ikke alltid det fungerer.<br><br>
			Man kan også prøve å koble fra alt av internett (sett enheten i flymodus) -> Prøv å koble til pokemath. (Det vil ikke fungere, men nettsiden laster da inn ny informasjon) -> så koble til internett (skru av flymodus) og prøv å koble til på nytt.</p>
		</div>
	  </div>
	  <div class="faq-question">
		<input id="q6" type="checkbox" class="panel">
		<div class="plus" aria-hidden="true">+</div>
		<label for="q6" class="panel-title">Når jeg bruker QR-Kode så har jeg ingen av pokemonene mine! Hvorfor?</label>
		<div class="panel-content">
			<p>Dette skjer om man bruker en QR-Kode app som har en egen nettleser.<br>
			Ofte så lar disse appene deg kopiere en lenke istedet for å gå til siden. Om du kopierer lenken, og bruker den i nettleseren du vanligvis bruker, så vil du ha alle pokemonene dine.<br>
		<br>Det fungerer også ofte å bare bruke den vanlige kamera-appen på enheten for å scanne QR-Koden. Disse vil ofte åpne lenkene i den nettleseren du bruker oftest.</p>
		</div>
	  </div>
	<div class="faq-question">
		<input id="q7" type="checkbox" class="panel">
		<div class="plus" aria-hidden="true">+</div>
		<label for="q7" class="panel-title">Hei PokeMorten - Hva er din favoritt pokemon?</label>
		<div class="panel-content">
			<p><img src="/images/pokemon/normal/258.webp" alt="Mudkip"></p>
		</div>
	  </div>
	<div class="faq-question">
		<input id="q8" type="checkbox" class="panel">
		<div class="plus" aria-hidden="true">+</div>
		<label for="q8" class="panel-title">Hvorfor starter ikke sesong-eventet på min enhet? (Halloween, Jul, Påske, osv.)</label>
		<div class="panel-content">
			<p>Noen av disse er avhengige av datoen på din enhet for å fungere. Akkuratt nå leses den datoen som:</p>
			<p>{today}</p>
			<p>Hvis dette ikke stemmer med riktig dato, så kan det være årsaken. Hvis datoen er riktig, se spørsmålet ovenfor om "Vennene mine har funksjoner som ikke jeg har."</p>
		</div>
	  </div>
	</div>
	<div class="faq-question">
		<input id="q9" type="checkbox" class="panel">
		<div class="plus" aria-hidden="true">+</div>
		<label for="q9" class="panel-title">Jeg ønsker å få nyeste oppdatering</label>
		<div class="panel-content">
			<p><strong>OBS: Ta backup av dataen din før du tømmer nettlesercachen!</strong><br>
			Gå til <a href="./saveandload.html">Lagre / Last inn</a> og last ned en lagringsfil først.</p>
			<p>Klikk knappen under for å forsøke å tømme nettlesercachen for Pokémath automatisk:</p>
			<button class="pm-button small secondary" id="clearCacheBtn" onclick={clearCache}>Tøm cache</button>
			<p id="clearCacheMsg" style="font-style:italic;">{cacheMessage}</p>

			<p><strong>Manuell hurtigoppdatering per enhet:</strong></p>
			<ul>
				<li><strong>PC (Windows/Linux):</strong> Hold inne <kbd>Ctrl</kbd> og trykk <kbd>F5</kbd>, eller <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd></li>
				<li><strong>Mac:</strong> Hold inne <kbd>Cmd</kbd>+<kbd>Shift</kbd> og trykk <kbd>R</kbd></li>
				<li><strong>iPhone / iPad (Safari):</strong> Gå til Innstillinger → Safari → Tøm historikk og nettstedsdata</li>
				<li><strong>Android (Chrome):</strong> Trykk på de tre prikkene øverst til høyre → Innstillinger → Personvern → Tøm nettleserdata → velg «Bufrede bilder og filer»</li>
				<li><strong>Alternativ (alle enheter):</strong> Sett enheten i flymodus → prøv å åpne Pokémath (siden feiler) → slå av flymodus → prøv igjen</li>
			</ul>
		</div>
	</div>
	<div class="faq-question">
		<input id="q99" type="checkbox" class="panel">
		<div class="plus" aria-hidden="true">+</div>
		<label for="q99" class="panel-title">Jeg har et spørsmål som ikke står her!</label>
		<div class="panel-content">
			<p>Ta kontakt med oss! Bruk siden <a href="about.html#contact">Kontakt oss</a>!</p>
		</div>
	  </div>
	</div>
</div>

<style>
	.container {
		max-width: 780px;
		margin: 0 auto;
	}
	/* Each question is a card; the hidden checkbox opens it and the + turns into a ×. */
	.faq-question {
		position: relative;
		margin-bottom: 10px;
		border-radius: var(--pm-radius);
		background: var(--pm-paper);
		box-shadow: var(--pm-shadow), 0 0 0 1px var(--pm-line);
	}
	.panel {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
	.panel-title {
		display: block;
		box-sizing: border-box;
		min-height: 56px;
		padding: 16px 56px 16px 18px;
		font-family: var(--pm-display);
		font-size: 20px;
		line-height: 1.25;
		overflow-wrap: break-word;
		cursor: pointer;
	}
	.panel:focus-visible ~ .panel-title {
		outline: 3px solid var(--pm-ink);
		outline-offset: -3px;
		border-radius: var(--pm-radius);
	}
	.plus {
		position: absolute;
		top: 12px;
		right: 14px;
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--pm-cream);
		font-family: var(--pm-display);
		font-size: 24px;
		line-height: 1;
		pointer-events: none;
		transition: transform 200ms ease-out;
	}
	.panel:checked ~ .plus {
		transform: rotate(45deg);
		background: var(--pm-red);
		color: var(--pm-paper);
	}
	.panel-content {
		display: none;
		padding: 0 18px 16px;
		font-size: 17px;
		line-height: 1.5;
	}
	.panel:checked ~ .panel-content {
		display: block;
	}
	.panel-content p {
		margin: 0 0 10px;
	}
	.panel-content a {
		color: var(--pm-red-deep);
		font-weight: 700;
	}
	.panel-content ul {
		padding-left: 20px;
	}
	.panel-content li {
		margin-bottom: 6px;
	}
	.panel-content img {
		width: 160px;
	}
	kbd {
		padding: 1px 6px;
		border-radius: 6px;
		background: var(--pm-cream);
		box-shadow: inset 0 -2px 0 var(--pm-line);
		font-family: inherit;
		font-weight: 700;
	}
	.cost-display {
		font-weight: 700;
	}

	@media (max-width: 480px) {
		.panel-title {
			font-size: 18px;
		}
	}
</style>
