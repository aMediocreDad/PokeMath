// Screenshot legacy and Svelte game pages at iPad size: playing, and the catch screen.
// Usage: node game-shots.mjs [base] [date ISO] [prefix]
import { createRequire } from "module";
import { muteAudio } from './mute.mjs';
const require = createRequire(import.meta.url);
const { webkit, devices } = require("playwright-core");
const BASE = process.argv[2] || "http://localhost:3123";
const DATE = process.argv[3] || "2026-05-12T10:00:00";
const PREFIX = process.argv[4] || "game";
const OUT = new URL("./shots/", import.meta.url).pathname;

const browser = muteAudio(await webkit.launch());
for (const [label, path] of [["legacy", "/pokemath-legacy.html"], ["svelte", "/pokemath.html"]]) {
  const context = await browser.newContext({ ...devices["iPad (gen 7)"] });
  await context.addCookies([{ name: "cookies", value: "true", url: BASE }]);
  await context.addInitScript(`(() => { let a = 77; Math.random = function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`);
  await context.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    Object.entries({ username: "Kari", money: "1000", pokemonlist: "N25|N4" }).forEach(([k, v]) => localStorage.setItem(k, v));
  });
  const page = await context.newPage();
  await page.clock.install({ time: new Date(DATE) });
  await page.goto(BASE + path + "?stage=2");
  await page.clock.runFor(1500);
  await page.waitForTimeout(1500);
  const solve = async () => {
    const [a, op, b] = (await page.locator(".problem").textContent()).trim().split(" ");
    return op === "+" ? Number(a) + Number(b) : Number(a) - Number(b);
  };
  await page.locator(".our-field").fill(String(await solve()));
  await page.locator(".our-field").press("Enter");
  await page.clock.runFor(1200);
  await page.locator(".our-field").fill("999");
  await page.locator(".our-field").press("Enter");
  await page.clock.runFor(1200);
  await page.screenshot({ path: `${OUT}${PREFIX}-${label}-playing.png` });
  for (let i = 0; i < 4; i++) {
    await page.locator(".our-field").fill(String(await solve()));
    await page.locator(".our-field").press("Enter");
    await page.clock.runFor(1200);
  }
  await page.locator("#pokeball").click();
  await page.clock.runFor(1500);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}${PREFIX}-${label}-caught.png` });
  await context.close();
}
await browser.close();
console.log("done");
