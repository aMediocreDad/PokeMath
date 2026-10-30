<script>
	// The privacy notice, shown on the about page and on the public /personvern.html.

	/** @type {{ dpaHref?: string }} Where the data processing summary is. */
	let { dpaHref = '/dpa.html' } = $props();
</script>

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
	<li>Siden drives av Cloudflare. Databasen og bingo-spillene ligger i EU, og ingenting deles med andre.</li>
</ul>

<h3>Innlogging</h3>
<p>Bare innloggingen og denne personvernerklæringen vises uten innlogging. Det finnes to måter å logge inn på:</p>
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
			<tr><td>Feil koder</td><td>IP-adresse og antall feil.</td><td>Ved neste innlogging med kode etter et kvarter</td></tr>
			<tr><td>Lærere</td><td>E-postadressen og de hemmelige kodene læreren lager.</td><td>På forespørsel</td></tr>
			<tr><td>Spiller-ID</td><td>Den anonyme IDen. Jule- og påskesidene sender også brukernavn, poeng og antall fangster.</td><td>På forespørsel</td></tr>
			<tr><td>Bingo, raid og memory</td><td>Spiller-ID, brukernavn, figur, og fangster (bingo) eller antall riktige svar (raid og memory) i spillet.</td><td>Når spillet avsluttes, eller etter et døgn uten aktivitet. Premier som ikke er hentet, etter en måned</td></tr>
			<tr><td>Felles telleverk</td><td>Antall fangster i vår-eventet, uten kobling til hvem som fanget.</td><td>Beholdes, siden den ikke sier noe om noen</td></tr>
		</tbody>
	</table>
</div>
<p>Hvilke hemmelige koder du har brukt, lagres i spillet, og dermed også i skylagringen.</p>
<p>
	Cloudflare fører i tillegg tekniske logger over forespørsler en kort periode, til feilsøking. Loggene kan
	inneholde brukernavn og e-postadresse (om denne er brukt til å logge inn).
</p>

<h3>Tredjeparter</h3>
<ul>
	<li>
		<strong>Cloudflare</strong> driver siden, databasen og innloggingen, som databehandler. Databasen og bingo-spillene ligger i EU. Se
		<a href={dpaHref}>databehandling</a> og Cloudflares <a href="https://www.cloudflare.com/privacypolicy/">personvernregler</a>.
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

<style>
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
</style>
