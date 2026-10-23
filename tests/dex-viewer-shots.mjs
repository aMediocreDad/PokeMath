// The Pokédex's two modes and the viewer: legendary and mythic auras on cards, in the viewer and in
// a bingo prize; the shiny foil in the viewer; "Alle arter" with shadows; a card opening the viewer
// and "‹ Pokédex" bringing back the filters and scroll; and an empty save landing in "Alle arter".
// On the iPad (760 px and wider) the Pokédex is split: a tap shows the Pokémon in a pane beside the
// list. A card under the game opens the viewer in the same tab, and "‹ Spillet" goes back to it.
// Usage: node dex-viewer-shots.mjs [base] [outdir]. tests/dex-viewer-serve-shots.sh builds this
// checkout and serves it on :3124.
import { createRequire } from "module";
import { muteAudio } from './mute.mjs';
const require = createRequire(import.meta.url);
const fs = require("fs");
const { webkit, devices } = require("playwright-core");
const BASE = process.argv[2] || "http://localhost:3124";
const OUT = (process.argv[3] || new URL("./design/dex-viewer/", import.meta.url).pathname).replace(/\/?$/, "/");
fs.mkdirSync(OUT, { recursive: true });
const SAVE = {
  username: "Kari", money: "123456",
  pokemonlist: ["N1", "N4", "S6", "N25", "N144", "N145", "N146", "N150", "S150", "N151", "N249", "S251", "N384", "N493"].join("|"),
  backupReminder: new Date(Date.now() + 9e9).toISOString(), storageNoticeSeen: "true",
  uuid: "00000000-0000-4000-8000-00000000d3c5",
};
const PRIZES = { ok: true, prizes: [
  { id: "aura-1", type: "pokemon", pokedexId: 249, entry: "N249", legendary: true, source: "bingo" },
  { id: "aura-2", type: "pokemon", pokedexId: 151, entry: "N151", source: "bingo" },
] };
// Pin every animation to one moment, so the shots do not depend on timing.
const pin = () => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = 1300; });
let failures = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) failures++; };

const browser = muteAudio(await webkit.launch());
for (const [vp, device] of [["ipad", devices["iPad (gen 7)"]], ["iphone", devices["iPhone 13"]]]) {
  for (const motion of ["no-preference", "reduce"]) {
    const context = await browser.newContext({ ...device, reducedMotion: motion, serviceWorkers: "block" });
    await context.addCookies([{ name: "cookies", value: "true", url: BASE }]);
    await context.addInitScript((s) => Object.entries(s).forEach(([k, v]) => localStorage.getItem(k) === null && localStorage.setItem(k, v)), SAVE);
    const page = await context.newPage();
    const tag = `${vp}-${motion === "reduce" ? "still" : "move"}`;

    await page.goto(BASE + "/dex.html");
    await page.waitForSelector(".pm-card.legendary");
    check(await page.locator("#dexModeMine[aria-pressed=true]").count() === 1, `${tag}: a save with catches opens in Mine`);
    check(await page.locator('[id="N150"] .aura.legendary').count() === 1, `${tag}: legendary card has an aura`);
    check(await page.locator('[id="N151"] .aura.mythic').count() === 1, `${tag}: mythic card has an aura`);
    check(await page.locator('[id="S150"] .foil').count() === 1 && await page.locator('[id="S150"] .aura').count() === 1, `${tag}: shiny legendary has foil and aura`);
    await page.waitForTimeout(800);
    await page.evaluate(pin);
    await page.screenshot({ path: `${OUT}dex-mine-${tag}.png` });
    for (const id of ["N150", "N151", "S150"]) await page.locator(`[id="${id}"]`).screenshot({ path: `${OUT}card-${id}-${tag}.png` });
    if (motion === "reduce") {
      await context.close();
      continue;
    }

    // Every species, shadows for the missing ones; then only the legendaries still missing.
    await page.click("#dexModeAll");
    await page.waitForSelector(".pm-card.locked");
    check(await page.locator("#speciesCaught").textContent() === "13 / 1026", `${tag}: 13 of 1026 species caught`);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}dex-all-${tag}.png` });
    await page.click("#caughtBtn"); await page.click("#caughtBtn");
    await page.click('[data-filter="Legendarisk"]');
    await page.waitForTimeout(300);
    const missing = await page.locator("#pokedex .pm-card").count();
    check(missing > 0 && await page.locator("#pokedex .pm-card:not(.locked)").count() === 0, `${tag}: missing legendaries are all shadows (${missing})`);
    await page.screenshot({ path: `${OUT}dex-all-missing-legendary-${tag}.png` });

    // A card opens the viewer in the same tab; ‹ Pokédex comes back to the same filters and scroll.
    await page.click("#caughtBtn");
    await page.waitForTimeout(300);
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(300);
    const scrollBefore = await page.evaluate(() => window.scrollY);
    const shown = await page.locator("#pokedex .pm-card").count();
    // A card already on screen, so the click does not scroll the list first.
    const onScreen = await page.evaluate(() => [...document.querySelectorAll("#pokedex .pm-card")].findIndex((c) => c.getBoundingClientRect().top > 200));
    if (vp === "ipad") {
      // Split view: the tap fills the pane and stays on the page; an evolution tapped in the pane
      // replaces it; the pane's button opens the full viewer.
      const card = page.locator("#pokedex .pm-card").nth(onScreen);
      const id = (await card.getAttribute("href")).match(/pokemonId=(\d+)/)[1];
      await card.click();
      await page.waitForTimeout(400);
      check(page.url().includes("dex.html") && await page.locator(`.dex-pane .number`).textContent() === `#${id}`, `${tag}: a tap shows #${id} in the pane`);
      check(await card.getAttribute("aria-current") === "true", `${tag}: the picked card is marked`);
      check(Math.abs(await page.evaluate(() => window.scrollY) - scrollBefore) < 40, `${tag}: picking does not scroll the list`);
      await page.locator('[id="dexModeMine"]').click();
      await page.click('[data-filter="all"]');
      await page.locator('[id="N1"]').click();
      await page.locator('.dex-pane #next-evolution-wrapper a').first().click();
      await page.waitForTimeout(300);
      check(await page.locator(".dex-pane .number").textContent() === "#2", `${tag}: an evolution in the pane shows #2`);
      await page.waitForTimeout(800);
      await page.evaluate(pin);
      await page.screenshot({ path: `${OUT}dex-split-${tag}.png` });
      await page.evaluate(() => document.getAnimations().forEach((a) => a.play()));
      await page.locator('[id="S150"]').click();
      await page.waitForTimeout(300);
      check(await page.locator(".dex-pane .hero-art .foil").count() === 1, `${tag}: a shiny in the pane is foiled`);
      await page.click("#dexModeAll");
      await page.click('[data-filter="Legendarisk"]');
      await page.waitForTimeout(300);
      await page.evaluate((y) => window.scrollTo(0, y), scrollBefore);
      await page.waitForTimeout(300);
      await page.click(".open-viewer");
    } else {
      await page.locator("#pokedex .pm-card").nth(onScreen).click();
    }
    await page.waitForURL(/pokeviewer/);
    await page.waitForSelector(".hero .name");
    await page.click(".to-dex");
    await page.waitForURL(/dex\.html/);
    await page.waitForSelector("#pokedex .pm-card");
    await page.waitForTimeout(600);
    check(await page.locator("#dexModeAll[aria-pressed=true]").count() === 1, `${tag}: back in Alle arter`);
    check(await page.locator('[data-filter="Legendarisk"].filter-include').count() === 1, `${tag}: Legendarisk filter kept`);
    check(await page.locator("#pokedex .pm-card").count() === shown, `${tag}: same cards shown (${shown})`);
    if (vp === "ipad") check(await page.locator(".dex-pane .number").textContent() === "#150", `${tag}: the pane keeps the picked Pokémon`);
    const scrollAfter = await page.evaluate(() => window.scrollY);
    check(Math.abs(scrollAfter - scrollBefore) < 40, `${tag}: scroll kept (${scrollBefore} → ${scrollAfter})`);

    // Viewer: shiny foil and aura on the big picture, a mythic, and a shadow.
    for (const [query, name, sel] of [["150&shiny=1", "shiny-legendary", ".hero-art .foil"], ["151", "mythic", ".hero-art .aura.mythic"], ["249", "legendary", ".hero-art .aura.legendary"], ["243", "locked", ".hero-art.locked"]]) {
      await page.goto(`${BASE}/pokeviewer.html?pokemonId=${query}`);
      await page.waitForSelector(".hero .name");
      check(await page.locator(sel).count() === 1, `${tag}: viewer ${name} has ${sel}`);
      await page.waitForTimeout(600);
      await page.evaluate(pin);
      await page.screenshot({ path: `${OUT}viewer-${name}-${tag}.png` });
    }
    check(await page.locator(".hero-art .aura").count() === 0, `${tag}: a shadow has no aura`);

    // A legendary and a mythic bingo prize open in an aura frame.
    await page.route("**/bingo/claim-prizes**", (route) => route.request().method() === "GET"
      ? route.fulfill({ json: PRIZES }) : route.fulfill({ json: { ok: true } }));
    await page.goto(BASE + "/pokemath.html?stage=2");
    for (const name of ["legendary", "mythic"]) {
      await page.locator("#bingo-lootbox-overlay").click();
      await page.waitForSelector(`.prize-art.frame.${name} .aura`);
      await page.waitForTimeout(800);
      await page.evaluate(pin);
      await page.screenshot({ path: `${OUT}prize-${name}-${tag}.png` });
      await page.evaluate(() => document.getAnimations().forEach((a) => a.play()));
      await page.locator("#bingo-lootbox-overlay").click();
    }
    await context.close();
  }

  // A child with nothing caught lands in Alle arter and can open the viewer.
  const empty = await browser.newContext({ ...device, serviceWorkers: "block" });
  await empty.addCookies([{ name: "cookies", value: "true", url: BASE }]);
  await empty.addInitScript((s) => Object.entries(s).forEach(([k, v]) => localStorage.getItem(k) === null && localStorage.setItem(k, v)),
    { ...SAVE, pokemonlist: "", uuid: "00000000-0000-4000-8000-00000000e3e7" });
  const page = await empty.newPage();
  await page.goto(BASE + "/dex.html");
  await page.waitForSelector(".pm-card.locked");
  check(await page.locator("#dexModeAll[aria-pressed=true]").count() === 1, `${vp}: an empty save opens in Alle arter`);
  await page.screenshot({ path: `${OUT}dex-empty-${vp}.png` });
  await page.locator('#pokedex [href*="pokemonId=25"]').scrollIntoViewIfNeeded();
  await page.locator('#pokedex [href*="pokemonId=25"]').click();
  await page.waitForTimeout(300);
  check(await page.locator(".hero .name").textContent() === "???", `${vp}: empty save sees #25 as a shadow`);
  await empty.close();

  // A card under the game opens the viewer in the same tab, and the back link returns to the game.
  {
    const context = await browser.newContext({ ...device, serviceWorkers: "block" });
    await context.addCookies([{ name: "cookies", value: "true", url: BASE }]);
    await context.addInitScript((s) => Object.entries(s).forEach(([k, v]) => localStorage.getItem(k) === null && localStorage.setItem(k, v)), SAVE);
    const page = await context.newPage();
    await page.goto(BASE + "/pokemath.html?stage=2");
    await page.waitForSelector(".recent .pm-card");
    check(await page.locator(".recent .pm-card[target]").count() === 0, `${vp}: game cards have no new-tab target`);
    await page.locator(".recent .pm-card").first().click();
    await page.waitForURL(/pokeviewer/);
    check(await page.locator(".to-dex").textContent() === "‹ Spillet", `${vp}: the viewer offers ‹ Spillet`);
    await page.click(".to-dex");
    await page.waitForURL(/pokemath\.html/);
    check(true, `${vp}: ‹ Spillet goes back to the game`);
    await context.close();
  }
}
// iPad held sideways: the split view at its most common size.
{
  const context = await browser.newContext({ ...devices["iPad (gen 7) landscape"], serviceWorkers: "block" });
  await context.addCookies([{ name: "cookies", value: "true", url: BASE }]);
  await context.addInitScript((s) => Object.entries(s).forEach(([k, v]) => localStorage.getItem(k) === null && localStorage.setItem(k, v)), SAVE);
  const page = await context.newPage();
  await page.goto(BASE + "/dex.html");
  await page.waitForSelector(".dex-pane .number");
  await page.locator('[id="N151"]').click();
  await page.waitForTimeout(800);
  await page.evaluate(pin);
  await page.screenshot({ path: `${OUT}dex-split-ipad-landscape.png` });
  await context.close();
}

// Desktop: both Pokédex modes and a viewer hero at 1280 wide, and the catch screen's burst behind a
// legendary and a mythic. The roll is random, so the burst gets the rarity class set by hand: this
// checks the look, not which Pokémon was caught.
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
  await context.addCookies([{ name: "cookies", value: "true", url: BASE }]);
  await context.addInitScript((s) => Object.entries(s).forEach(([k, v]) => localStorage.getItem(k) === null && localStorage.setItem(k, v)), SAVE);
  const page = await context.newPage();
  await page.goto(BASE + "/dex.html");
  await page.waitForSelector(".pm-card.legendary");
  await page.waitForTimeout(800);
  await page.evaluate(pin);
  await page.screenshot({ path: `${OUT}dex-mine-desktop.png` });
  await page.evaluate(() => document.getAnimations().forEach((a) => a.play()));
  await page.click("#dexModeAll");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}dex-all-desktop.png` });
  check(await page.locator(".dex-pane").count() === 1, "desktop: the Pokédex is split");
  await page.goto(BASE + "/pokeviewer.html?pokemonId=150&shiny=1");
  await page.waitForSelector(".hero .name");
  await page.waitForTimeout(600);
  await page.evaluate(pin);
  await page.screenshot({ path: `${OUT}viewer-shiny-legendary-desktop.png` });

  await page.goto(BASE + "/pokemath.html?stage=2");
  await page.waitForSelector(".problem");
  const solve = async () => { const [a, op, b] = (await page.locator(".problem").textContent()).trim().split(" "); return String(op === "+" ? +a + +b : +a - +b); };
  for (let i = 0; i < 12 && await page.locator("#pokeball:not(.is-hidden)").count() === 0; i++) {
    await page.locator(".our-field").fill(await solve()); await page.locator(".our-field").press("Enter"); await page.waitForTimeout(400);
  }
  await page.locator("#pokeball").click();
  await page.waitForSelector(".burst");
  for (const rarity of ["legendary", "mythic"]) {
    await page.evaluate((r) => { const b = document.querySelector(".burst"); b.classList.remove("legendary", "mythic"); b.classList.add(r); }, rarity);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}catch-burst-${rarity}-desktop.png` });
  }
  await context.close();
}
await browser.close();
console.log("saved to", OUT);
if (failures) { console.error(`${failures} check(s) failed`); process.exit(1); }
