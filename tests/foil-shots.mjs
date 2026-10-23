// Shiny foil screens: the Pokédex and the game's card row with shinies (shiny legendary and mythic
// included), the glare pinned mid-sweep, a reduced-motion frame, a shiny on the catch screen, and
// a shiny bingo prize in its foil frame.
// Usage: node foil-shots.mjs [base] [outdir]. The base must serve a build of this branch;
// tests/foil-serve-shots.sh builds one and serves it on :3124.
import { createRequire } from "module";
import { muteAudio } from './mute.mjs';
const require = createRequire(import.meta.url);
const fs = require("fs");
const { webkit, devices } = require("playwright-core");
const BASE = process.argv[2] || "http://localhost:3123";
const OUT = (process.argv[3] || new URL("./design/foil/", import.meta.url).pathname).replace(/\/?$/, "/");
fs.mkdirSync(OUT, { recursive: true });
const SAVE = {
  username: "Kari", money: "123456", shinyBaitCount: "1",
  pokemonlist: ["N1", "S1", "N4", "S4", "S6", "S7", "N25", "S25", "S94", "S130", "N150", "S150", "N151", "S151", "S249"].join("|"),
  backupReminder: new Date(Date.now() + 9e9).toISOString(), storageNoticeSeen: "true",
  uuid: "00000000-0000-4000-8000-00000000f011",
};
// The server's answer to the game page's prize claim: one shiny from a bingo.
const PRIZES = { ok: true, prizes: [{ id: "foil-1", type: "pokemon", pokedexId: 150, entry: "S150", shiny: true, source: "bingo" }] };
// Pin every glare to the middle of its sweep, so the shot does not depend on timing.
const pinGlare = () => document.getAnimations().forEach((a) => {
  a.pause();
  if (a.animationName === "glare-sweep" || /glare/.test(a.animationName)) a.currentTime = 900 + a.effect.getTiming().delay;
});
const browser = muteAudio(await webkit.launch());
for (const [vp, device] of [["ipad", devices["iPad (gen 7)"]], ["iphone", devices["iPhone 13"]]]) {
  for (const motion of ["no-preference", "reduce"]) {
    // No service worker: it would fetch the prize claim itself, past page.route.
    const context = await browser.newContext({ ...device, reducedMotion: motion, serviceWorkers: "block" });
    await context.addCookies([{ name: "cookies", value: "true", url: BASE }]);
    await context.addInitScript((s) => Object.entries(s).forEach(([k, v]) => localStorage.getItem(k) === null && localStorage.setItem(k, v)), SAVE);
    const page = await context.newPage();
    const tag = `${vp}-${motion === "reduce" ? "still" : "foil"}`;
    await page.goto(BASE + "/dex.html");
    await page.waitForSelector(".pm-card.shiny");
    if (await page.locator(".pm-card.shiny .foil").count() === 0) {
      console.error(`${BASE} serves a build without the foil. Serve this worktree's build instead.`);
      process.exit(1);
    }
    await page.waitForTimeout(1500);
    if (motion !== "reduce") await page.evaluate(pinGlare);
    await page.screenshot({ path: `${OUT}dex-${tag}.png` });
    await page.locator('[id="S150"]').screenshot({ path: `${OUT}card-legendary-${tag}.png` });
    if (motion !== "reduce") {
      await page.route("**/bingo/claim-prizes**", (route) => route.request().method() === "GET"
        ? route.fulfill({ json: PRIZES }) : route.fulfill({ json: { ok: true } }));
      await page.goto(BASE + "/pokemath.html?stage=2");
      await page.locator("#bingo-lootbox-overlay").click();
      await page.waitForSelector(".foil-frame");
      await page.waitForTimeout(800);
      await page.evaluate(pinGlare);
      await page.screenshot({ path: `${OUT}prize-${tag}.png` });
      await page.locator("#bingo-lootbox-overlay").click();
      await page.unroute("**/bingo/claim-prizes**");
      await page.waitForTimeout(1500);
      const solve = async () => { const [a, op, b] = (await page.locator(".problem").textContent()).trim().split(" "); return String(op === "+" ? +a + +b : +a - +b); };
      for (let i = 0; i < 12 && await page.locator("#pokeball:not(.is-hidden)").count() === 0; i++) {
        await page.locator(".our-field").fill(await solve()); await page.locator(".our-field").press("Enter"); await page.waitForTimeout(400);
      }
      await page.locator("#pokeball").click();
      await page.waitForSelector(".sparkles");
      await page.waitForTimeout(1500);
      await page.evaluate(() => document.getAnimations().forEach((a) => { a.pause(); if (a.animationName === "twinkle" || /twinkle/.test(a.animationName)) a.currentTime = 2400; }));
      await page.screenshot({ path: `${OUT}catch-${tag}.png` });
    }
    await context.close();
  }
}
await browser.close();
console.log("saved to", OUT);
