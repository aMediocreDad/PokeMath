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
			Dette er en privat kopi av PokéMath. Har du spørsmål eller har funnet en feil, så spør den som inviterte deg.
		</p>
		<p>
			PokéMath er laget av Tirco, og originalen finnes på <a href="https://pokemath.online">pokemath.online</a>. Spørsmål om
			den sendes til <a href="mailto:contact@pokemath.online">contact@pokemath.online</a>.
		</p>
		<div id="donate-button-container" class="donate">
			<p>Vil du gi Tirco en godbit for arbeidet med PokéMath, kan du donere her:</p>
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
		<p class="muted">Sist oppdatert: 22. oktober 2026</p>
		<p>
			Dette er en privat kopi av PokéMath, laget av Tirco og videreutviklet for bruk i familien og blant venner. Bare de
			som er invitert, kan logge inn. Den som drifter kopien og inviterte deg, er ansvarlig for opplysningene, og
			spørsmål om personvern går dit.
		</p>

		<h3>Kort oppsummert</h3>
		<ul>
			<li>Spillet lagres i nettleseren din, og en kopi lagres i skyen sammen med innloggingen din.</li>
			<li>Det er ingen reklame, ingen sporing og ingen analyseverktøy.</li>
			<li>Alt lagres hos Cloudflare i EU, og ingenting deles med andre.</li>
		</ul>

		<h3>Innlogging</h3>
		<p>Ingenting på siden vises uten innlogging. Det finnes to måter å logge inn på:</p>
		<ul>
			<li>
				<strong>Med kode</strong>: en voksen lager en kode til barnet på lærersiden. Serveren lagrer barnets navn, en
				tilfeldig ID og hvem som laget koden, men ikke selve koden, bare et fingeravtrykk av den.
			</li>
			<li>
				<strong>Med e-post</strong>: Cloudflare Access sender en engangskode til e-postadressen din. Bare e-postadresser
				som er lagt inn på forhånd, slipper inn.
			</li>
		</ul>
		<p>
			Feil koder telles per nettverksadresse (IP-adresse) i et kvarter, for å hindre gjetting. Når du logger ut, lagres
			spillet i skyen og fjernes fra enheten, så neste person starter med sin egen lagring.
		</p>

		<h3>Informasjonskapsler (cookies)</h3>
		<p>Siden bruker bare informasjonskapsler som trengs for at den skal virke. Ingen av dem brukes til sporing.</p>
		<div class="table-wrap">
			<table class="cookies">
				<thead><tr><th>Navn</th><th>Hva den gjør</th><th>Varighet</th></tr></thead>
				<tbody>
					<tr><td><code>pm_session</code></td><td>Husker at du er logget inn.</td><td>Ett år med kode, tre måneder med e-post, eller til du logger ut</td></tr>
					<tr><td><code>CF_Authorization</code></td><td>Settes av Cloudflare Access ved innlogging med e-post, og gjelder bare innloggingssiden.</td><td>Så lenge Access-økten varer</td></tr>
					<tr><td><code>cookies</code></td><td>Lar de eldste sidene (jul og påske) lagre spillet.</td><td>Tre måneder</td></tr>
				</tbody>
			</table>
		</div>

		<h3>Hva lagres på enheten din</h3>
		<p>Spillet lagrer fremdriften i nettleserens <strong>localStorage</strong>:</p>
		<ul>
			<li>Pokémon du har fanget, mynter og ting du har kjøpt i butikken</li>
			<li>Brukernavnet du selv har satt, og figuren din</li>
			<li>Hvor mange oppgaver du har løst per nivå</li>
			<li>En tilfeldig, anonym spiller-ID</li>
			<li>Koden til bingo-spillet du er med i</li>
		</ul>
		<p>
			Spillet lager også en sikkerhetskopi av det samme i nettleserens <strong>IndexedDB</strong>, høyst hver tredje time.
			Den kopien forlater aldri enheten. Du kan slette begge ved å tømme nettstedsdata i nettleseren.
		</p>

		<h3>Hva lagres på serveren, og hvor lenge</h3>
		<div class="table-wrap">
			<table class="stored">
				<thead><tr><th>Hva</th><th>Innhold</th><th>Slettes</th></tr></thead>
				<tbody>
					<tr><td>Skylagring</td><td>En kopi av spillet fra localStorage, koblet til innloggingen. Oppdateres omtrent hvert minutt mens du spiller.</td><td>Når den voksne fjerner barnet og velger å slette lagringen, eller på forespørsel</td></tr>
					<tr><td>Innlogginger</td><td>Hvem som er logget inn (e-post eller barnets navn) og når innloggingen går ut.</td><td>Når du logger ut, eller når innloggingen går ut</td></tr>
					<tr><td>Barn</td><td>Navnet den voksne skrev inn, fingeravtrykket av koden og hvem som laget den.</td><td>Når den voksne fjerner barnet</td></tr>
					<tr><td>Feil koder</td><td>IP-adresse og antall feil.</td><td>Etter et kvarter</td></tr>
					<tr><td>Lærere</td><td>E-postadressen og de hemmelige kodene læreren lager.</td><td>På forespørsel</td></tr>
					<tr><td>Spiller-ID</td><td>Den anonyme IDen. Jule- og påskesidene sender også brukernavn, poeng og antall fangster.</td><td>På forespørsel</td></tr>
					<tr><td>Bingo</td><td>Spiller-ID, brukernavn, figur og fangster i spillet.</td><td>Når bingoen avsluttes, eller etter et døgn uten aktivitet. Premier som ikke er hentet, etter en måned</td></tr>
					<tr><td>Felles telleverk</td><td>Antall fangster i vår-eventet, uten kobling til hvem som fanget.</td><td>Beholdes, siden den ikke sier noe om noen</td></tr>
				</tbody>
			</table>
		</div>
		<p>Hemmelige koder sjekkes mot serveren, men det lagres ikke hvem som har brukt dem.</p>
		<p>
			Cloudflare fører i tillegg tekniske logger over forespørsler en kort periode, til feilsøking. Loggene kan
			inneholde brukernavn og e-postadresse.
		</p>

		<h3>Tredjeparter</h3>
		<ul>
			<li>
				<strong>Cloudflare</strong> driver siden, databasen og innloggingen, som databehandler. Dataene lagres i EU. Se
				<a href="/dpa.html">databehandling</a> og Cloudflares <a href="https://www.cloudflare.com/privacypolicy/">personvernregler</a>.
			</li>
			<li><strong>QR-koder</strong> lages i nettleseren din. Lenken i dem sendes ikke til noen.</li>
			<li><strong>PayPal</strong>: donasjonsknappen går til Tirco. PayPals egne regler gjelder om du bruker den.</li>
			<li>
				<strong>Pokémon-data og bilder</strong> kommer fra <a href="https://pokeapi.co/">PokéAPI</a>,
				<a href="https://github.com/poketwo/poketwo">Pokétwo</a>, <a href="https://nintendo.fandom.com/">Nintendo Fandom Wiki</a>
				og <a href="https://pokemondb.net/">PokémonDB</a>, og ligger på siden selv. Nettleseren din spør ikke disse direkte.
			</li>
		</ul>

		<h3>Barn</h3>
		<p>
			Barn spiller med en kode som en voksen lager. Det eneste som lagres om barnet, er navnet den voksne skriver inn og
			brukernavnet barnet velger i spillet. Ingen av dem trenger å være et ekte navn.
		</p>

		<h3>Dine rettigheter</h3>
		<ul>
			<li>Du kan slette alt som ligger på enheten ved å tømme nettstedsdata i nettleseren.</li>
			<li>
				Du kan be den som inviterte deg om innsyn i, retting av eller sletting av opplysninger om deg eller barnet ditt.
			</li>
			<li>
				Mener du at opplysningene behandles feil, kan du klage til <a href="https://www.datatilsynet.no/">Datatilsynet</a>.
			</li>
		</ul>
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
	.muted {
		color: var(--pm-ink-soft);
	}
	.table-wrap {
		margin: 0 0 12px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 15px;
	}
	th,
	td {
		padding: 8px 10px 8px 0;
		border-bottom: 1px solid var(--pm-line);
		text-align: left;
		vertical-align: top;
	}
	th {
		color: var(--pm-ink-soft);
		font-size: 13px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	/* Phones: each row becomes a small block, with the last column labelled. */
	@media (max-width: 560px) {
		thead {
			display: none;
		}
		tr,
		td {
			display: block;
		}
		tr {
			padding: 8px 0;
			border-bottom: 1px solid var(--pm-line);
		}
		td {
			padding: 2px 0;
			border: 0;
		}
		td:first-child {
			font-weight: 700;
		}
		td:last-child {
			color: var(--pm-ink-soft);
			font-size: 14px;
		}
		.cookies td:last-child::before {
			content: 'Varighet: ';
			font-weight: 700;
		}
		.stored td:last-child::before {
			content: 'Slettes: ';
			font-weight: 700;
		}
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
