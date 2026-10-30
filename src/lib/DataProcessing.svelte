<script>
	// Who handles the data and where, for schools weighing a data processing agreement.
	// Shown on /dpa.html and on the public /personvern.html.
	/** @type {{ privacyHref?: string }} Where the full privacy notice is. */
	let { privacyHref = '/about.html#privacy' } = $props();
</script>

<p>
	PokéMath er laget av Tirco. Denne kopien er videreutviklet og driftes privat. Skoler som vil bruke den i
	undervisningen og trenger en databehandleravtale, kan skrive til <a href="mailto:hello@amediocre.dev">hello@amediocre.dev</a>.
</p>
<dl>
	<dt>Ansvarlig</dt>
	<dd>Den som drifter siden, på <a href="mailto:hello@amediocre.dev">hello@amediocre.dev</a>. Spørsmål om opplysningene dine går dit.</dd>
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
