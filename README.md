# PokéMath

PokéMath er et gratis, nettleserbasert læringsspill for matematikk med Pokémon-tema. Formålet er å skape en motiverende læringsarena for elever som øver på addisjon, subtraksjon, multiplikasjon og divisjon.

Den originale ideen om å gi ut Pokémon som belønning for å løse matteoppgaver er inspirert av [Lesekloden.no](http://www.lesekloden.no).

---

## Funksjoner

- **Matematikkøvelser** på fem vanskelighetsgrader, inkludert egendefinert modus
- **Pokédex** – samle over 1 000 Pokémon, inkludert shinies, legendaries, alternative former og sesongvarianter
- **Butikk** – kjøp bakgrunner, karakterer og oppgraderinger med mynter du tjener ved å løse oppgaver
- **Stardust** – garanterer at neste fangede Pokémon blir shiny
- **Bingo** – klasseromsfunksjon for lærere der elevene spiller Bingo mens de løser oppgaver
- **Lærerkonto** – lærere kan opprette spilløkter, gi premier og lage hemmelige koder
- **Hemmelige koder** – løs inn koder for å få spesielle belønninger
- **Spillerprofil** – velg navn, profilbilde og se statistikk

---

## Teknologi

- **Frontend:** SvelteKit, bygget til statiske sider
- **Backend:** en Cloudflare Worker (`worker/`) med D1-database og en Durable Object for bingo, raid og memory
- **Innlogging:** e-post via Cloudflare Access, eller en kode fra læreren for barn uten e-post

---

## Kjøre lokalt

```sh
npm install
npm run dev
```

Åpne http://localhost:5173. `npm run dev` starter også Workeren på port 3001 (`scripts/dev-worker.sh`), med en lokal database i `.wrangler/dev` som beholdes mellom kjøringer. Slett mappen for å starte på nytt. Bilder og fonter som ikke er speilet til `static/` (`npm run mirror`), hentes fra pokemath.online.

- **Innlogging:** lokalt er alle innlogget som `laerer@test.no`, som også er lærer. Logg inn med en barnekode i et privat vindu for å være en annen spiller.
- **Koder:** `MYNTER`, `SHINY`, `LEGENDARISK`, `STJERNESTØV` og `PIKACHU` kan løses inn på redeem.html, én gang per innlogging.
- **Bingo, raid og memory:** start et spill fra lærersiden, og bli med fra `bingo_join.html` i et annet vindu.

### Publisere

`npm run deploy` bygger siden til `build/` og laster opp Workeren. Nye databasemigreringer må kjøres først: `npx wrangler d1 migrations apply DB --remote`. Prøv bygget lokalt med `npm run dev:worker`, som er det testene i `tests/` kjører mot.

---

## Datahåndtering

All spilldata lagres lokalt i nettleserens `localStorage`. Data sendes kun til server ved deltakelse i Bingo eller ved bruk av lærerkonto. Se [personvernerklæringen](about.html#privacy) for detaljer.

For skoler som bruker lærerkontoer finnes en [databehandleravtale](dpa.html) i henhold til GDPR artikkel 28.

---

## Bildekreditering

- Pokémon-sprites: [Pokétwo](https://github.com/poketwo/poketwo), [Nintendo Fandom Wiki](https://nintendo.fandom.com/), [PokémonDB](https://pokemondb.net/)
- Pokémon-data: [PokéAPI](https://pokeapi.co/) (lagret lokalt)
- Bakgrunner: [Pixabay](https://pixabay.com/)

Pokémon and all elements of the Pokémon franchise are © 1995–2026 Nintendo, GAME FREAK inc. TM © and Creatures Inc.

---

## Kontakt

📧 [contact@pokemath.online](mailto:contact@pokemath.online)
