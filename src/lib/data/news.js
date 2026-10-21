// The update log from the "Nyheter" section of static/about.html, newest first. Items are HTML,
// since a few of them hold links.
/** @type {{ date: string, items: string[] }[]} */
export const NEWS = [
	{
		"date": "21.03.2026",
		"items": [
			"La inn negativ pokedex filtrering. Nå kan du velge å vise alle pokemon som IKKE er shiny, og lignende filtere.",
			"La inn en spiller-profil side. Her kan man nå endre navn og profilbilde, og se alle bildene man har.",
			"Oppdaterte alle profilbilder, og la inn MANGE nye. Det er nå nesten 300 forskjellige karakterer å velge mellom!",
			"Gjorde så man ikke kan kjøpe alle karakterene samtidig. Nå går de på en ukentlig rulering, så det er nye karakterer i butikken hver mandag!",
			"Pokedexen vil nå vise en prosentandel av hvor mange pokemon du har fanget i de forskjellige kategoriene. (Normal, Shiny, Alternative Former og totalt)",
			"La inn mange nye alternative former! - Hvis noen skulle lastes inn uten bilde, så si ifra!",
			"La inn den nyeste generasjonen med pokemon!",
			"PokeViewer (Som du kommer til når du trykker på en pokemon i pokedexen) har nå blitt oppdatert, og viser nå mer informasjon om pokemonene, og har et bedre design!",
			"La til \"Stardust\" i butikken, som kan brukes for å garantere at den neste pokemonen du fanger er shiny!",
			"Endret måten hemmelige koder fungerer. Nå er de server-baserte, og jeg kan lage de mye enklere. Enkelte lærere kan også nå lage egne koder!",
			"Jeg kommer til å lage en kode som heter Stardust, bare jeg husker at jeg skal gjøre det...",
			"Oppdaterte about.html, og privacy policy. Oppdaterte også cookie-consent knappen til å bli mer riktig.",
			"Lagde en template databehandleravtale. Dette er for lærere som ønsker å bruke lærerkonto-funksjonen, og dermed behandle data om elever. Du finner den <a href=\"dpa.html\">her</a>."
		]
	},
	{
		"date": "11.03.2026",
		"items": [
			"Ser at jeg ikke har loggført arbeidet på en stund! På tide å fikse det.",
			"Oppaterte noen CSS deler av koden (utseendet)",
			"La inn en veldig tidlig versjon av lærerkontroll. Dette er ikke for allmenn bruk enda.",
			"Gjorde noen backend oppdateringer.",
			"Gjorde det lettere å spille pokemath med bare tastaturet. Man kan nå åpne pokeballer og trykke \"fortsett\" kun med enter knappen.",
			"Endret hvordan top og botbar lastes inn. Litt mindre gaffateip i kodingen!",
			"Lekte videre med webserver, og muligheten for å sende informasjon.",
			"La inn nye ting i FAQ.",
			"Fikset skrivefeil i FAQ.",
			"Oppdaterte pokeviewer.",
			"Forbedret innlasting av pokedexen og la inn flere filtreringer.",
			"Flere ting som jeg har glemt å loggføre!"
		]
	},
	{
		"date": "08.12.2024",
		"items": [
			"fikset en breddefeil på pokeviewer.",
			"fikset så missingNo synes i pokeviewer.",
			"la inn pokedex-innlegget til pokemon #1009 & #1010",
			"fikset så darkrai nå blir merket som mytisk, istedetfor legendarisk. Ops!",
			"oppdaterte lagre og last inn funksjonen. Nå skal den være mer effektiv når den lagrer filer, og det skal være veldig vanskelig for den å unngå informasjon. Det forrige systemet var veldig komplisert, nå har det blitt forenklet massivt. Det skal fortsatt være mulig å laste inn gamle filer.",
			"La inn en påminnelse om å lagre en backup.",
			"Jobber videre med funksjoner som kobler brukere mot nett."
		]
	},
	{
		"date": "27.11.2024",
		"items": [
			"Gjorde forberedelser til jule-eventet.",
			"La til 31 nye julevarianter av pokemon!",
			"Fikset en feil med pokeviewer, slik at den ikke ble lastet inn riktig. Gjorde også slik at alternative former er mer synlig",
			"Oppdaterte hvordan ting ble lagret lokalt (Nå bruker koden mindre av JSON.stringify).",
			"Ryddet opp i save-and-load.",
			"Gjorde så de hemmelige kodene nå fungerer som de skal igjen.",
			"Laget en feilmelding hvis pokedexen prøvde å laste inn en pokemon som ikke finnes. Feilmeldingen vil vises hver gang du går inn på pokedexen, så send meg gjerne en kopi av lagringsfilen så jeg kan se hva som gikk galt!",
			"Fjernet noen uønskede test-meldinger i konsollen.",
			"Endret måten antall fangede pokemon regnes ut, slik at den er mer nøyaktig."
		]
	},
	{
		"date": "12.11.2024",
		"items": [
			"Prøvde å fikse enkelte sider som ikke fungerte etter forrige oppdatering.",
			"Oppdaterte funksjonen til pokedexen så den skal (i teorien) være mer effektiv på innlasting."
		]
	},
	{
		"date": "10.11.2024",
		"items": [
			"Endret måten sider blir lastet inn. Nå har topplinjen blitt automatisert, så jeg ikke trenger å endre på alle undersidene når topplinjen endres.",
			"Ødela butikken (og fikset den igjen)",
			"La til en del nye figurer i butikken.",
			"La til en funksjon som sørger for at man kobler til med https. Dette burde fikse noen feil for noen brukere",
			"Bingo-siden får nå en større oppdatering, og man kan forvente å oppleve store feil ved den intill videre.",
			"La til flere ikoner til Bingo-funksjonen.",
			"Tester ut metoder for å gjøre ting på tvers av enheter... <a href=\"http:www.secret.pokemath.online\">:)</a>"
		]
	},
	{
		"date": "02.11.2024",
		"items": [
			"Lenge siden forrige offentlige oppdatering - Men det har skjedd en del ting bak sløret.",
			"La til Faktor B i Egendefinert Modus for multiplikasjon. Nå kan du øve på den gangen du trenger å øve på!",
			"Fikset en feil hvor Roaring Moon, Iron Valiant, Walking Wake og Iron Leaves var klassifisert som Legendariske... Det er de ikke, selv om de er Paradox Pokemon. (Takk, Halvor, for at du følger med!)",
			"Fikset småfeil.",
			"Til lærere: Test ut https://pokemath.online/bingo.html -> Den kan være motiverende å ha på tavlen, og la elevene klikke ut om de får en som er på bingokortet. Eller så kan de ha hvert sitt bingo-kort i en egen fane. Bruk den som dere vil, det var bare et morsomt sideprosjekt jeg hadde for en stund siden.",
			"Også til lærere: Det finnes en del hemmelige koder som kan gis som ekstra belønninger til elever. Send oss en velformulert e-post fra en jobb-konto (for å filtrere ut små luringer), så kan dere få noen av de. Inkluder gjerne hvilken skole og hvilk(e) trinn dere jobber med, men dette er ikke et krav. Jeg er bare nyskjerrig!"
		]
	},
	{
		"date": "30.09.2023",
		"items": [
			"La til \"Badges\", eller \"Merker\" som de heter på norsk.",
			"La til flere høst/halloween pokemon.",
			"Fikset noen småfeil på siden.",
			"Gjorde slik at nivå 4 og 5 trenger færre oppgaver løst for å få en pokemon.",
			"La til et kode-system hvor jeg kan gi ut gaver basert på hemmelige ord.",
			"La til sporing på hvor mange oppgaver som er gjort i dag, den siste uken og den siste måneden. (Denne blir ikke sendt inn til meg, men kan brukes av lærere for å se om du har gjort det du skal) - Sporingen blir IKKE lagret hvis du bruker \"lagre/last inn\" funksjonen, så ikke bruk den rett før læreren din sjekker!",
			"La til flere unike pokemon.",
			"La til \"pokeviewer\" som lar deg se utviklinger og spesielle versjoner som er linket til en pokemon.",
			"Gjorde så alle bildene tar mindre lagringsplass.",
			"Oppdaterte lagringssystemet for å behandle ny data.",
			"Forhåpentligvis fikset feilen som gjorde at pokemath ble stengt.",
			"En hemmelig kode du kan bruke i det nye kode-systemet (hvis du finner det) er \"Greed\". :) Pass på store og små bokstaver. :)"
		]
	},
	{
		"date": "24.09.2023",
		"items": [
			"Fjernet en \"money glitch\" (Error).",
			"Fikset ID 1001 og 1002. De er nå listet som Legendary."
		]
	},
	{
		"date": "13.09.2023",
		"items": [
			"Fjernet en bugg som ga for mange shinies.",
			"La til Gen IX pokemon."
		]
	},
	{
		"date": "22.08.2023",
		"items": [
			"Fjernet CountAPI for å laste inn enkelte elementer raskere."
		]
	},
	{
		"date": "25.11.2022",
		"items": [
			"La til en feilmelding på nettlesere som ikke har JavaScript på.",
			"La til jule-eventet. Du kan nå finne gaver mens du løser oppgaver.",
			"Lagde en julekalender.",
			"La til en hilsen til de som er litt ekstra nyskjerrige i Developer Tools",
			"Removed Herobrine... Nei vent... Feil spill.",
			"Endret utseendet på ikonene på startsiden. De er nå litt mindre masete, og det er lettere å se flere av knappene.",
			"La til noen hemmeligheter. (Missing No.)",
			"Ordnet ny e-post adresse! Wooo! Vi har nå en egen pokemath epost!",
			"Oppdaterte pokedexen så den laster inn mye raskere om du går tilbake til den!",
			"Endret på rammen til mytiske og legendariske pokemon.",
			"Fikset fonten som er på forside splash-teksten, slik at den er lik på flere enheter."
		]
	},
	{
		"date": "02.11.2022",
		"items": [
			"Halloween-eventet er automatisk fjernet.",
			"Oppdaterte Customizer (lag ditt eget nivå).",
			"Gjorde slik at gjentatte pokemon som er shiny, legendarisk eller mytisk gir ekstra mye penger.",
			"Gikk igjennom sjansene for legendarisk, mytisk og shiny."
		]
	},
	{
		"date": "16.10.2022",
		"items": [
			"Forbedret måten pokemon lagres og lastes inn på, slik at belastningen på spillet blir mindre.",
			"La til en fiks for når man bruker frem og tilbake navigasjon.",
			"Laget en FAQ side.",
			"Laget en funksjon for å lagre og laste opp brukerdata som en fil.",
			"Oppdaterte sorteringsfunksjonen på Pokedex.",
			"Begrenset pokemonene som er lastet inn på mattesiden. Dette er for å begrense data som lastes ned fra nettsiden.",
			"Gikk over til en lokal database for pokemon. Dette bør gjøre så feilene for å få pokemon blir sjeldnere.",
			"Endret innlastningsmetoden på pokemon, slik at pokemon med feil kan fikses fortløpende.",
			"La til flere nye karakterer på butikksiden.",
			"Endret på sjansene for Shiny, Legendary og Mythic.",
			"Gjorde sånn at om halloweenegget trenger 25 pokemon, så vil neste runde bare trenge 5.",
			"La til en usynlig årsak til å ville gjøre minst mulig feil!"
		]
	},
	{
		"date": "06.10.2022",
		"items": [
			"Enda en hotfix! Makan til rotete kode! :P",
			"La til en ny varselboks på forsiden, hvis jeg trenger å gi meldinger til brukerne.",
			"La til to nye tilbakemeldingsbokser på \"kontakt-oss\" for de som ikke vil sende e-post."
		]
	},
	{
		"date": "03.10.2022",
		"items": [
			"Hotfixet Halloween eventet:",
			"Shadow MewTwo har nå riktig bilde. (OG det oppdaterer seg til riktg, etterhvert) Denne typen fix vil snart være på plass for alle de buggede pokemonene, når jeg omarbeider hvordan de lastes inn. (Så om du har Alolan \"Rapidash\" så blir dette fikset snart-ish)",
			"Fjernet muligheten for juksing ved å laste inn på nytt. (Dette var en bugg ved innlastning)",
			"Takk for alle tilbakemeldinger og feilmeldinger!"
		]
	},
	{
		"date": "24.09.2022",
		"items": [
			"Gjorde klar for Halloween! Gjennom hele oktober kan man fange 18 spesielle pokemon ved å bruke egget som dukker opp på regnesiden. Man kan også få ekstra mange dark og ghost-pokemon!",
			"Fikset småfeil på pokedexen.",
			"La til flere nye bakgrunner i butikken.",
			"Fikset en feil med antall mulige desimaler.",
			"Fikset flere småfeil med custom mode.",
			"Takk for alle tilbakemeldingene! Jeg leser alle jeg får!",
			"Fikset at Alolan Ninetales heter Alolan Rapidash i spillet. (Hvis du har denne pokemonen fra før, vil feilen bli værende.)"
		]
	},
	{
		"date": "20.09.2022",
		"items": [
			"Fikset en feil som gjorde at man ikke kunne få pokemon i custom mode."
		]
	},
	{
		"date": "19.09.2022",
		"items": [
			"Fikset deling i egenvalgt modus.",
			"Gjorde så egenvalgt modus automatisk regner ut hvilken vanskelighetsgrad du spiller på.",
			"Leste igjennom tilbakemeldingene deres. (Takk!)",
			"Fjernet muligheten for å missbruke egenvalgt modus til å få for lette oppgaver. Juksepaver blir ikke pokemonmestere!"
		]
	},
	{
		"date": "14.09.2022",
		"items": [
			"La til egenvalgt modus. (Beta)",
			"La til funksjoner som tillater desimaltall.",
			"Gjorde interne endringer på hvordan godkjenning av svar fungerer.",
			"Fikset småfeil i lenker.",
			"Fikset at feil bilde ble brukt på Hisuian Goodra. Om du allerede har fanget denne pokemonen vil feilen vedvare.",
			"Fikset Cookie Consent pop-up.",
			"La til en offentlig Cookie Policy.",
			"La til en offentlig Privacy Notice.",
			"Sørget for at siden er GDPR-vennlig."
		]
	},
	{
		"date": "27.08.2022",
		"items": [
			"Oppdaterte Om siden.",
			"Startet arbeid for en ny funksjon når man klikker på en fanget pokemon. Denne er ikke klar enda.",
			"La til Hisuian pokemon og variasjonene deres."
		]
	},
	{
		"date": "01.05.2022",
		"items": [
			"La til en GitHub side. Denne finner du i \"Om siden\".",
			"La til spiller-ikoner i butikken.",
			"La til feilmelding ved for langt navn.",
			"Endret tastatur på mobile enheter.",
			"Fikset småfeil."
		]
	},
	{
		"date": "15.04.2022",
		"items": [
			"La til nye bakgrunner i butikken.",
			"La til nye oppgraderinger i butikken.",
			"La til en donasjonsknapp under \"kontakt\".",
			"Overførte pokebildene til lokal vert. (Dette gjelder nylig fangede pokemon, og ikke de du har fra før)"
		]
	},
	{
		"date": "15.03.2022",
		"items": [
			"Fikset \"bruk\" knappen på bakgrunnen.",
			"Økte effektiviteten på Shiny Charm litt.",
			"Endret på prisen og maks-nivå på Shiny Charm.",
			"La til et \"Toast\"-system som gjør at meldinger kan vises enklere.",
			"La til tilfeldige meldinger når du får en pokemon, istedet for bare \"flott jobbet!\""
		]
	},
	{
		"date": "05.03.2022",
		"items": [
			"Fikset noen mindre feil.",
			"La til de første elementene i butikken.",
			"Oppdaterte utseendet på pokedexen og hovedmenyen."
		]
	},
	{
		"date": "16.02.2022",
		"items": [
			"Fikset på bildet til Gigantamax Rillaboom. Hvis du allerede har fanget denne pokemonen, så vil bildet forbli feil...",
			"Endret på vanskelighetsgradene til nivå 2 og 4.",
			"Endret på informasjon om vanskelighetsgrad."
		]
	},
	{
		"date": "08.02.2022",
		"items": [
			"Fikset på noen pokemon som lå inne med feil bilde. Hvis du allerede har fanget disse pokemonene, så vil bildet forbli feil...",
			"Fikset på en pokemon som burde vert listet som legendarisk.",
			"Endret på utseendet til informasjonssiden.",
			"Forbedret deler av koden.",
			"Oppdaterte utseendet til Pokédexen.",
			"Gjorde klar til videre oppdateringer."
		]
	},
	{
		"date": "06.02.2022",
		"items": [
			"Lagde en pokedex side.",
			"Slettet alle pokemon fra cookies.",
			"Tok i bruk et nytt lagringssystem.",
			"Fikset ikonet til charizard i hovedmenyen.",
			"Fikset så pengene lagrer seg og legges til ordentlig.",
			"Oppdaterte utseendet på pokemon i listen.",
			"La til en \"slett alt\"-knapp, og lagde en navigerings meny.",
			"Gjorde så duplikate pokemon ikke lager nye kort.",
			"Endret litt på språket på siden.",
			"Fikset en bugg hvor shinies lagde uendelige normale versjoner av seg selv.",
			"La til Alolan varianter.",
			"La til Galarian varianter.",
			"La til Gigantamax varianter.",
			"La til Mega varianter.",
			"La til spesielle varianter av noen pokemon."
		]
	},
	{
		"date": "01.02.2022",
		"items": [
			"la til flere nivåer.",
			"La til nivå-meny.",
			"endret på utseendet.",
			"ryddet opp i kode.",
			"la til ikoner for poeng og pokemon.",
			"fikset småfeil."
		]
	},
	{
		"date": "28.01.2022",
		"items": [
			"La til delingsstykker.",
			"Gjorde Shinies vanskeligere å finne.",
			"Gjorde legendaries og mythics vanskeligere å finne.",
			"Gjorde så legendaries og mythics har egne rammer i pokedexen",
			"La til lagring.",
			"Lagde topptekst og bunntekst",
			"La til en teller for antall pokemon og poeng.",
			"Tok i bruk cookies.",
			"La til funksjoner som hindrer at man med et uhell kan gå forbi en pokemon."
		]
	}
];
