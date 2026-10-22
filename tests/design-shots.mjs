// Screens for design review: game (playing, win, caught), Pokédex, shop, profile on iPad and iPhone.
// Usage: node design-shots.mjs <prefix>
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const fs = require("fs");
const { webkit, devices } = require("playwright-core");
const BASE = "http://localhost:3123";
const PREFIX = process.argv[2] || "design";
const OUT = new URL(`./design/${PREFIX}/`, import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const SAVE = {
  username: "Kari", money: "123456", shinyBaitCount: "1",
  pokemonlist: Array.from({ length: 60 }, (_, i) => `N${i + 1}`).concat(["S6", "N150", "N25", "N25", "N151"]).join("|"),
  boughtBackgrounds: "bg-002", boughtPlayerIcons: "player", playerIcon: "player", playerIconImg: "images/playericons/player.png",
  backupReminder: new Date(Date.now() + 9e9).toISOString(), tier1Solved: "41", tier3Solved: "12",
};
const browser = await webkit.launch();
for (const [vp, device] of [["ipad", devices["iPad (gen 7)"]], ["iphone", devices["iPhone 13"]]]) {
  const context = await browser.newContext({ ...device });
  await context.addCookies([{ name: "cookies", value: "true", url: BASE }]);
  await context.addInitScript((s) => Object.entries(s).forEach(([k, v]) => localStorage.getItem(k) === null && localStorage.setItem(k, v)), SAVE);
  await context.addInitScript(`(() => { let a = 5; Math.random = function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`);
  await context.clock.install({ time: new Date("2026-05-12T10:00:00") });
  const page = await context.newPage();
  const shot = async (name) => { await context.clock.runFor(800); await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}${name}-${vp}.png` }); };
  await page.goto(BASE + "/pokemath.html?stage=2");
  await context.clock.runFor(1500); await page.waitForTimeout(1200);
  const solve = async () => { const [a, op, b] = (await page.locator(".problem").textContent()).trim().split(" "); return String(op === "+" ? +a + +b : +a - +b); };
  await page.locator(".our-field").fill(await solve()); await page.locator(".our-field").press("Enter");
  await shot("game");
  for (let i = 0; i < 4; i++) { await page.locator(".our-field").fill(await solve()); await page.locator(".our-field").press("Enter"); await context.clock.runFor(300); }
  await shot("win");
  await page.locator("#pokeball").click();
  await shot("caught");
  for (const [name, path] of [["dex", "/dex.html"], ["shop", "/shop.html"], ["profile", "/player_profile.html"]]) {
    await page.goto(BASE + path);
    await context.clock.runFor(1500); await page.waitForTimeout(1200);
    await shot(name);
  }
  await context.close();
}
await browser.close();
console.log("saved to", OUT);
