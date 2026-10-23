// The two display fixes: the points counter per stage, and recent catches on load.
import { createRequire } from "module";
import { muteAudio } from './mute.mjs';
const require = createRequire(import.meta.url);
const { webkit, devices } = require("playwright-core");
const BASE = process.argv[2] || "http://localhost:3123";
const browser = muteAudio(await webkit.launch());
const context = await browser.newContext({ ...devices["iPad (gen 7)"] });
await context.addCookies([{ name: "cookies", value: "true", url: BASE }]);
await context.addInitScript(() => {
  if (sessionStorage.getItem("s")) return;
  sessionStorage.setItem("s", "1");
  localStorage.setItem("pokemonlist", "N1|N4|N7|N25|N25|S6|N150|N4|N133");
});
const page = await context.newPage();
for (const stage of [1, 4, 5]) {
  await page.goto(`${BASE}/pokemath.html?stage=${stage}`);
  await page.waitForTimeout(1500);
  const counts = [await page.locator(".points-needed").textContent()];
  const [a, op, b] = (await page.locator(".problem").textContent()).trim().split(" ");
  const n = [Number(a), Number(b)];
  await page.locator(".our-field").fill(String(op === "+" ? n[0] + n[1] : op === "-" ? n[0] - n[1] : op === "x" ? n[0] * n[1] : n[0] / n[1]));
  await page.locator(".our-field").press("Enter");
  await page.waitForTimeout(300);
  counts.push(await page.locator(".points-needed").textContent());
  console.log(`stage ${stage}: points needed ${counts.join(" -> ")}, boxes ${await page.locator(".boxes .box").count()}`);
}
const cards = await page.evaluate(() => [...document.querySelectorAll("#pokedex > a")].map((a) => a.id + ":" + a.querySelector(".card-counter").textContent));
console.log("recent cards on load:", cards.join(" "));
await browser.close();
