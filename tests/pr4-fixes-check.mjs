// The PR 4 follow-up fixes: multiplication decimals, preset loading, prompt cancel, name sort.
import { createRequire } from "module";
import { muteAudio } from './mute.mjs';
const require = createRequire(import.meta.url);
const { webkit, devices } = require("playwright-core");
const BASE = "http://localhost:3123";
const browser = muteAudio(await webkit.launch());
const context = await browser.newContext({ ...devices["iPad (gen 7)"] });
await context.addCookies([{ name: "cookies", value: "true", url: BASE }]);
await context.addInitScript(() => {
  if (sessionStorage.getItem("s")) return;
  sessionStorage.setItem("s", "1");
  localStorage.setItem("pokemonlist", "N25|N1|N150|N4|N133|N7");
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

// 1. Multiplication decimals from a customizer link (mudec=2).
await page.goto(BASE + "/pokemath.html?custom=true&mul=t&mumina=2&mumaxa=12&mudec=2&muminb=2&mumaxb=12");
await page.waitForTimeout(1200);
console.log("custom mul with mudec=2, problem:", (await page.locator(".problem").textContent()).trim());

// 2 + 3. Presets: cancel the name prompt, then save with negatives off and load it back.
await page.goto(BASE + "/customizer.html");
await page.waitForTimeout(800);
page.once("dialog", (d) => d.dismiss());
await page.locator("#presetCard-1 .save-btn").click();
await page.waitForTimeout(200);
console.log("after cancelled prompt: slot 1 =", (await page.locator("#presetCard-1 .card-title").textContent()).trim(), "| stored:", await page.evaluate(() => localStorage.getItem("customPreset1")));
await page.locator("#subtractioncheck").check({ force: true });
console.log("negatives allowed before save:", await page.locator("#subtractionallownegative").isChecked());
page.once("dialog", (d) => d.accept("Uten minus"));
await page.locator("#presetCard-1 .save-btn").click();
await page.locator("#subtractionallownegative").check({ force: true });
await page.locator("#presetCard-1 .load-btn").click();
await page.waitForTimeout(200);
console.log("negatives allowed after loading the preset:", await page.locator("#subtractionallownegative").isChecked());

// 4. Name sort in the Pokédex.
await page.goto(BASE + "/dex.html");
await page.waitForTimeout(1500);
for (const sort of ["name-asc", "name-desc"]) {
  await page.locator("#sortDropdownBtn").click();
  await page.locator(`#sortContent a[data-sort="${sort}"]`).click();
  await page.waitForTimeout(200);
  console.log(sort + ":", (await page.locator("#pokedex > a strong").allTextContents()).map((t) => t.trim()).join(", "));
}
console.log("errors:", errors.length ? errors : "none");
await browser.close();
