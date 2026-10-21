<script>
	// The about page, ported from static/about.html: about the site, contact, the update log and the
	// privacy notice. The PayPal button is a plain link, so no PayPal script loads for every visitor.
	import { NEWS } from '#lib/data/news.js';

	const SHOWN = 3;
	let allNews = $state(false);
	const news = $derived(allNews ? NEWS : NEWS.slice(0, SHOWN));
</script>

<svelte:head>
	<title>Pokémath - Om oss</title>
	<meta name="title" content="Pokémath - Om oss" />
	<meta name="description" content="Om siden til Pokémath, med kontaktinformasjon og lignende." />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="main pm-page about">
	<h1 class="pm-title">Om PokéMath</h1>
	<nav class="jump" aria-label="Innhold">
		<a href="#about">Om siden</a>
		<a href="#contact">Kontakt</a>
		<a href="#news">Nyheter</a>
		<a href="#privacy">Personvern</a>
	</nav>

	<section id="about" class="panel pm-surface">
		<h2>Om siden</h2>
		<p><strong>Denne siden er under utvikling og vil gjennomgå store endringer underveis.</strong></p>
		<p>
			Pokemath.online er en læringsrik side hvor man kan få mengdetrening i addisjon, subtraksjon, multiplikasjon og
			divisjon. Nettsiden prøver på ingen måte å tjene penger, verken ved bruk av reklame eller salg. Formålet med siden
			er å skape en motiverende læringsarena for barn (og voksne) som er interessert i pokemon. Den originale idèen om å
			få pokemon for å gjøre matte kommer fra <a href="http://www.lesekloden.no">Lesekloden.no</a>.
		</p>
		<p>
			Data om pokémonene (navn, typer, evolusjonrekker osv.) er hentet fra <a href="https://pokeapi.co/">PokéAPI</a> og
			lagret lokalt – det gjøres ingen live-forespørsler til PokéAPI når du bruker siden.
		</p>
		<p>Pokémon-bildene er hentet fra flere åpne kilder:</p>
		<ul>
			<li><a href="https://github.com/poketwo/poketwo">Pokétwo</a> - hoveddelen av sprite-databasen</li>
			<li><a href="https://nintendo.fandom.com/">Nintendo Fandom Wiki</a> - enkelte bilder</li>
			<li><a href="https://pokemondb.net/">PokémonDB</a> - enkelte bilder</li>
		</ul>
		<p>
			Hvis du ønsker å bidra til utviklingen av siden, kan du ta en titt på GitHub siden:
			<a href="https://github.com/Tirco/PokeMath">https://github.com/Tirco/PokeMath</a>
		</p>
		<p class="credits">
			Flere av ikonene er hentet fra <a href="https://www.flaticon.com/search?word=pokemon&amp;type=icon">Roundicons Freebies - Flaticon</a>.
			Noen av bakgrunnene er laget av
			<a href="https://pixabay.com/users/tmstbch-3040875/?utm_source=link-attribution&amp;utm_medium=referral&amp;utm_campaign=image&amp;utm_content=1572475">Tommaso Tabacchi</a>
			fra <a href="https://pixabay.com/?utm_source=link-attribution&amp;utm_medium=referral&amp;utm_campaign=image&amp;utm_content=1572475">Pixabay</a>.
			Noen av bakgrunnene er laget av
			<a href="https://pixabay.com/users/incantabiless-17625387/?utm_source=link-attribution&amp;utm_medium=referral&amp;utm_campaign=image&amp;utm_content=5432819">Incantabiless</a>
			fra <a href="https://pixabay.com/?utm_source=link-attribution&amp;utm_medium=referral&amp;utm_campaign=image&amp;utm_content=5432819">Pixabay</a>.
		</p>
		<p class="credits">Pokémon and all elements of the Pokémon franchise are © 1995-2022 Nintendo, GAME FREAK inc. TM © and Creatures Inc.</p>
	</section>

	<section id="contact" class="panel pm-surface">
		<h2>Kontakt</h2>
		<p>
			Mail: <a href="mailto:contact@pokemath.online">contact@pokemath.online</a><br />
			Hvis du har et problem du trenger hjelp til å løse, så er mailen det beste alternativet. Vi sjekker mailboxen
			daglig, men det kan ta litt tid å svare. (PokeMath er en hobby, ikke en jobb!)
		</p>
		<p>
			Du kan også legge igjen en feilmelding på <a href="https://forms.gle/Vi1VZ37R3UwfSpbu9">denne lenken</a> (Google
			Forms), eller en generell tilbakemelding på <a href="https://forms.gle/KJo37sLgL9St4m2D6">denne lenken</a> (Google
			Forms).
		</p>
		<div id="donate-button-container" class="donate">
			<p>Hvis du ønsker å sponse meg en godbit eller tilsvarende for arbeidet lagt inn i siden, så kan du legge inn en donasjon her:</p>
			<a class="pm-button secondary" href="https://www.paypal.com/donate/?hosted_button_id=XAMQNRWKEJWX4" target="_blank" rel="noopener">Doner med PayPal</a>
		</div>
	</section>

	<section id="news" class="panel pm-surface">
		<h2>Nyheter</h2>
		<ol class="news">
			{#each news as entry (entry.date)}
				<li>
					<h3><time>{entry.date}</time></h3>
					<ul>
						{#each entry.items as item, i (i)}<li>{@html item}</li>{/each}
					</ul>
				</li>
			{/each}
		</ol>
		{#if NEWS.length > SHOWN}
			<button class="pm-button small secondary" onclick={() => (allNews = !allNews)}>
				{allNews ? 'Vis færre' : `Vis eldre oppdateringer (${NEWS.length - SHOWN})`}
			</button>
		{/if}
	</section>

	<section id="privacy" class="panel pm-surface">
		<h2>Personvernerklæring</h2>
			<p>Sist oppdatert: mars 2026</p>
			<p>Pokemath driver nettstedet www.pokemath.online, som tilbyr en gratis tjeneste for matteøvelser med Pokémon-tema.</p>
			<p>Denne personvernerklæringen er laget for å informere besøkende om våre retningslinjer for innsamling, bruk og beskyttelse av informasjon. Ved å bruke nettstedet godtar du vilkårene som beskrives her.</p>
			<h3>Kort oppsummert</h3>
			<p><strong>For de aller fleste brukere lagres ingenting på våre servere.</strong> All spilldata (Pokémon, mynter, fremgang) ligger kun i din egen nettleser. Data sendes bare til serveren i to spesifikke tilfeller:</p>
			<ul>
			<li><strong>Bingo-deltakelse</strong> — kun mens en aktiv spilløkt pågår, og kun for elever som deltar i en bingo-sesjon opprettet av en lærer.</li>
			<li><strong>Lærerkonto</strong> — kun for lærere som aktivt har registrert seg. Denne funksjonen er ikke åpen for alle.</li>
			</ul>
			<p>Les videre for detaljer om hvert tilfelle.</p>
			<h3>Hva lagres lokalt på enheten din</h3>
			<p>Spillet lagrer fremdriften din i nettleserens <strong>localStorage</strong> — ikke i cookies. Dette inkluderer:</p>
			<ul>
			<li>Pokémon du har fanget</li>
			<li>Mynter og kjøpte butikkgjenstander (bakgrunner, figurer, Stardust o.l.)</li>
			<li>Brukernavn du selv har satt</li>
			<li>Oppgavestatistikk (antall løste oppgaver per nivå)</li>
			<li>En tilfeldig generert, anonym spiller-ID (UUID)</li>
			</ul>
			<p>Disse dataene forlater ikke enheten din med mindre du aktivt deltar i funksjoner som Bingo (se under). Du kan slette alle lokale data ved å tømme nettleserens localStorage.</p>
			<h3>Spiller-ID (UUID)</h3>
			<p>Når du bruker nettsiden genereres det automatisk en tilfeldig, anonym spiller-ID (UUID) som lagres i localStorage. Denne IDen inneholder ingen personlig informasjon, men brukes til å koble deg mot f.eks. bingo-premiering og hemmelige koder. UUIDen er teknisk sett unik per nettleser, men kan ikke brukes til å identifisere deg som person.</p>
			<h3>Bingo og klasserom-funksjoner</h3>
			<p><em>Gjelder kun elever som aktivt deltar i en bingo-sesjon opprettet av en lærer. Vanlig bruk av PokéMath berøres ikke av dette.</em></p>
			<p>Hvis du deltar i en bingo-sesjon, sendes følgende informasjon til vår server:</p>
			<ul>
			<li>Din anonyome spiller-ID (UUID)</li>
			<li>Brukernavnet du har satt (eller «Ash» hvis intet navn er angitt)</li>
			<li>Informasjon om pokemon du fanger i løpet av sesjonen (type, om den er shiny, osv.)</li>
			<li>Lobby-koden for bingo-sesjonen</li>
			</ul>
			<p>Disse dataene slettes automatisk når sesjonen avsluttes og premier er utdelt. Vi lagrer ikke denne informasjonen permanent utover det som er nødvendig for å gjennomføre sesjonen.</p>
			<p>Bingo er kun tilgjengelig for utvalgte lærere.</p>
			<h3>Hemmelige koder (Redeem-system)</h3>
			<p>Når du løser inn en hemmelig kode, registrerer vi at din UUID har brukt koden. Dette gjøres for å hindre at samme kode brukes flere ganger av samme person. Ingen personlig informasjon lagres i forbindelse med dette.</p>
			<h3>Lærerkontoer</h3>
			<p><em>Gjelder kun lærere som aktivt har registrert seg. Elever og vanlige brukere har ikke lærerkonto og berøres ikke av dette.</em></p>
			<p>Lærere som registrerer seg oppgir navn og e-postadresse. Disse lagres på vår server og brukes kun til autentisering og kommunikasjon relatert til tjenesten. Vi deler ikke denne informasjonen med tredjeparter. Lærerkontoer kan slettes ved å kontakte oss.</p>
			<h3>IP-adresser</h3>
			<p>Pokemath lagrer ikke IP-adresser permanent. Serverprogramvaren kan midlertidig behandle IP-adresser som del av normal nettverksdrift, men disse anonymiseres og lagres ikke i databasen vår.</p>
			<h3>Loggdata</h3>
			<p>Serveren vår loggfører teknisk aktivitet (f.eks. feilmeldinger og hendelsestidspunkter) for feilsøkingsformål. Bingo-logger som inneholder elevaktivitet slettes automatisk etter 90 dager.</p>
			<h3>Tredjeparts tjenester</h3>
			<p>Nettstedet bruker følgende tredjeparts-ressurser:</p>
			<ul>
			<li><strong>PayPal</strong> — for frivillig donasjon. PayPals egne personvernregler gjelder ved bruk av donasjon-knappen.</li>
			<li><strong>Pokémon-data</strong> — hentet fra <a href="https://pokeapi.co/">PokéAPI</a> og lagret lokalt. Det gjøres ingen live-forespørsler til PokéAPI fra nettleseren din.</li>
			<li><strong>Pokémon-bilder</strong> — hentet fra <a href="https://github.com/poketwo/poketwo">Pokétwo</a>, <a href="https://nintendo.fandom.com/">Nintendo Fandom Wiki</a> og <a href="https://pokemondb.net/">PokémonDB</a>. Bildene er lagret lokalt på vår server.</li>
			<li><strong>DreamHost</strong> — nettstedet driftes av DreamHost, LLC (USA). Se DreamHosts <a href="https://www.dreamhost.com/legal/privacy-policy/">personvernregler</a>.</li>
			</ul>
			<p>Vi anbefaler at du gjennomgår personvernerklæringen til disse tjenestene. Vi påtar oss ikke ansvar for deres personvernpraksis.</p>
			<h3>Hosting</h3>
			<p>Nettstedet kjøres på en privat server. All data lagres på denne serveren. Vi benytter bransjestandard sikkerhetspraksis, men kan ikke garantere 100 % sikkerhet ved dataoverføring over internett.</p>
			<h3>Barnas personvern</h3>
			<p>Nettstedet er beregnet for bruk i skolesammenheng og er tilgjengelig for barn. Vi samler ikke inn personlig informasjon fra barn — verken navn, e-post eller annen identifiserbar informasjon fra elevene selv. Brukernavnet som settes i spillet er valgfritt og trenger ikke være et ekte navn. Foresatte med spørsmål kan kontakte oss direkte.</p>
			<h3>For skoler og kommuner</h3>
			<p>Skoler som benytter PokéMath i undervisningen bør inngå en databehandleravtale med oss, jf. GDPR artikkel 28. Vi tilbyr en standardavtale som kan lastes ned, fylles ut og signeres av begge parter.</p>
			<p><a href="/dpa.html">→ Last ned / skriv ut databehandleravtale (PDF)</a></p>
			<h3>Dine rettigheter</h3>
			<p>Du kan når som helst:</p>
			<ul>
			<li>Slette all lokal data ved å tømme localStorage i nettleseren din</li>
			<li>Be om innsyn i eller sletting av data knyttet til din UUID ved å kontakte oss</li>
			</ul>
			<h3>Endringer i personvernerklæringen</h3>
			<p>Vi kan oppdatere denne personvernerklæringen etter behov. Datoen øverst angir når erklæringen sist ble endret. Vi anbefaler at du besøker denne siden med jevne mellomrom.</p>
			<h3>Kontakt oss</h3>
			<p>Hvis du har spørsmål eller forslag angående vår personvernerklæring, vennligst <a href="#contact">kontakt oss</a>.</p>
	</section>

	<p class="secret"><a href="redeem.html" aria-label="Hemmelige koder">:)</a></p>
</div>

<style>
	.jump {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin: -6px 0 18px;
	}
	.jump a {
		padding: 8px 14px;
		border-radius: 999px;
		background: var(--pm-paper);
		box-shadow: 0 0 0 1px var(--pm-line);
		color: var(--pm-ink);
		font-weight: 700;
	}
	.panel {
		max-width: 760px;
		margin-bottom: 16px;
		padding: 20px 22px;
		/* Room for the fixed header when a #link jumps here. */
		scroll-margin-top: calc(var(--pm-bar-height) + 12px);
		line-height: 1.55;
	}
	h2 {
		margin: 0 0 10px;
		font-family: var(--pm-display);
		font-weight: 400;
		font-size: 26px;
	}
	.panel :global(h3) {
		margin: 18px 0 6px;
		font-size: 18px;
	}
	.panel :global(p) {
		margin: 0 0 10px;
	}
	.panel :global(a) {
		color: var(--pm-red-deep);
		font-weight: 600;
	}
	.panel :global(ul) {
		margin: 0 0 10px;
		padding-left: 22px;
	}
	.credits {
		color: var(--pm-ink-soft);
		font-size: 14px;
	}
	.donate {
		margin-top: 14px;
		padding: 14px;
		border-radius: 14px;
		background: var(--pm-cream);
	}
	.donate .pm-button {
		color: var(--pm-ink);
	}
	.news {
		margin: 0 0 12px;
		padding: 0;
		list-style: none;
	}
	.news > li {
		padding: 4px 0 6px;
		border-bottom: 1px solid var(--pm-line);
	}
	.news h3 {
		margin: 10px 0 4px;
		color: var(--pm-ink-soft);
		font-size: 15px;
	}
	.secret {
		margin: 0;
		text-align: right;
	}
	.secret a {
		color: var(--pm-ink-soft);
	}
</style>
