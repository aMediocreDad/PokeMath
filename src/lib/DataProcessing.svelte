<script>
	// The live site's data processing agreement is for schools that use pokemath.online. This private
	// copy is not offered to schools, so the page sums up who handles the data and where instead.
	// Shown on /dpa.html and on the public /personvern.html.
	/** @type {{ privacyHref?: string }} Where the full privacy notice is. */
	let { privacyHref = '/about.html#privacy' } = $props();
</script>

<p>
	Dette er en privat kopi av PokéMath, til bruk i familien og blant venner. Den tilbys ikke til skoler. Skoler som vil
	bruke PokéMath i undervisningen, bruker <a href="https://pokemath.online">pokemath.online</a>, der Tirco tilbyr en
	egen databehandleravtale.
</p>
<dl>
	<dt>Ansvarlig</dt>
	<dd>Den som drifter kopien og inviterte deg. Spørsmål om opplysningene dine går dit.</dd>
	<dt>Databehandler</dt>
	<dd>
		Cloudflare driver siden, databasen, bingo-spillene og innloggingen, etter Cloudflares
		<a href="https://www.cloudflare.com/cloudflare-customer-dpa/">standard databehandleravtale</a>.
	</dd>
	<dt>Hvor</dt>
	<dd>Databasen og bingo-spillene ligger i EU.</dd>
	<dt>Formål</dt>
	<dd>Logge inn, lagre spillet så det kan fortsettes på en annen enhet, og kjøre bingo. Ingenting brukes til reklame eller sporing.</dd>
	<dt>Hvor lenge</dt>
	<dd>Til den som er ansvarlig sletter det. Bingo-spill slettes av seg selv etter et døgn uten aktivitet.</dd>
</dl>
<p>Hva som lagres, og hvor lenge, står i detalj i <a href={privacyHref}>personvernerklæringen</a>.</p>

<style>
	p {
		margin: 0 0 10px;
	}
	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 8px 16px;
		margin: 16px 0;
	}
	dt {
		font-weight: 700;
	}
	dd {
		margin: 0;
	}
	@media (max-width: 520px) {
		dl {
			grid-template-columns: 1fr;
			gap: 2px;
		}
		dd {
			margin-bottom: 10px;
		}
	}
	a {
		color: var(--pm-red-deep);
		font-weight: 600;
	}
</style>
