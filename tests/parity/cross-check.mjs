// Legacy and Svelte pages sharing one save, and client-side navigation between Svelte pages.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { webkit, devices } = require("playwright-core");
const BASE = process.argv[2] || "http://localhost:3123";
const browser = await webkit.launch();
const context = await browser.newContext({ ...devices["iPad (gen 7)"] });
await context.addCookies([{ name: "cookies", value: "true", url: BASE }]);
await context.addInitScript(() => {
  if (sessionStorage.getItem("s")) return;
  sessionStorage.setItem("s", "1");
  Object.entries({ username: "Kari", money: "50000", pokemonlist: "N25" }).forEach(([k, v]) => localStorage.setItem(k, v));
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => !e.message.includes("getEntriesByType") && errors.push(`${new URL(page.url()).pathname}: ${e.message}`));
page.on("dialog", (d) => d.accept());
const solve = async () => {
  const [a, op, b] = (await page.locator(".problem").textContent()).trim().split(" ");
  const n = [Number(a), Number(b)];
  return String(op === "+" ? n[0] + n[1] : op === "-" ? n[0] - n[1] : op === "x" ? n[0] * n[1] : n[0] / n[1]);
};
async function winRound() {
  for (let i = 0; i < 3; i++) {
    await page.locator(".our-field").fill(await solve());
    await page.locator(".our-field").press("Enter");
    await page.waitForTimeout(150);
  }
  await page.locator("#pokeball").click();
  await page.waitForTimeout(300);
  const caught = await page.locator(".end-message").textContent();
  await page.locator(".reset-button").click();
  return caught;
}

// 1. Play in Svelte, then look in the legacy Pokédex and shop.
await page.goto(BASE + "/pokemath.html?stage=5");
await page.waitForTimeout(1500);
const caught = await winRound();
const svelteMoney = await page.locator("#cointext").getAttribute("data-total");
const svelteList = await page.evaluate(() => localStorage.getItem("pokemonlist"));
console.log("svelte game:", caught.trim(), "| money", svelteMoney, "| list", svelteList);
await page.locator("#caught").tap();
await page.waitForURL("**/dex.html");
await page.waitForTimeout(2000);
const dex = await page.evaluate(() => ({
  money: document.getElementById("cointext")?.dataset.total,
  caught: document.getElementById("balltext")?.textContent,
  cards: [...document.querySelectorAll("#pokedex > a")].map((a) => a.id),
}));
console.log("legacy dex:", JSON.stringify(dex));

// 2. Buy shiny bait in the legacy shop, then check the Svelte game uses it.
await page.goto(BASE + "/shop.html");
await page.waitForTimeout(2000);
const buttons = await page.evaluate(() => [...document.querySelectorAll("button, .button-1, [onclick]")].map((b) => (b.getAttribute("onclick") || "") + " " + b.textContent.trim()).filter((t) => /bait|stjerne|stardust/i.test(t)).slice(0, 5));
console.log("shop bait buttons:", JSON.stringify(buttons));
const bought = await page.evaluate(() => {
  const el = [...document.querySelectorAll("[onclick]")].find((b) => /bait|Bait|stardust|Stardust/.test(b.getAttribute("onclick") || ""));
  if (!el) return null;
  el.click();
  return el.getAttribute("onclick");
});
await page.waitForTimeout(800);
const afterShop = await page.evaluate(() => ({ bait: localStorage.getItem("shinyBaitCount"), money: localStorage.getItem("money") }));
console.log("legacy shop:", bought, JSON.stringify(afterShop));
await page.goto(BASE + "/pokemath.html?stage=5");
await page.waitForTimeout(1500);
const baitCatch = await winRound();
const afterBait = await page.evaluate(() => ({ bait: localStorage.getItem("shinyBaitCount"), last: localStorage.getItem("pokemonlist").split("|").pop() }));
console.log("svelte game after bait:", baitCatch.trim(), JSON.stringify(afterBait));

// 3. Client-side navigation between Svelte pages: no stacked handlers, no stale overlay.
await page.goto(BASE + "/pokemath.html?stage=1");
await page.waitForTimeout(1500);
await page.evaluate(() => { const a = document.createElement("a"); a.href = "/faq.html"; a.id = "go-faq"; a.textContent = "faq"; document.body.append(a); });
for (let i = 0; i < 3; i++) {
  await page.locator("#go-faq").click();
  await page.waitForURL("**/faq.html");
  await page.goBack();
  await page.waitForURL("**/pokemath.html?stage=1");
  await page.waitForTimeout(400);
  await page.evaluate(() => { if (!document.getElementById("go-faq")) { const a = document.createElement("a"); a.href = "/faq.html"; a.id = "go-faq"; a.textContent = "faq"; document.body.append(a); } });
}
const before = await page.evaluate(() => localStorage.getItem("tier1Solved"));
await page.locator(".our-field").fill(await solve());
await page.locator(".our-field").press("Enter");
await page.waitForTimeout(300);
const after = await page.evaluate(() => localStorage.getItem("tier1Solved"));
const state = await page.evaluate(() => ({ needed: document.querySelector(".points-needed").textContent, overlay: document.body.classList.contains("overlay-is-open") }));
console.log(`after 3 round trips via client-side nav: one answer moved tier1Solved ${before} -> ${after}, needed ${state.needed}, overlay ${state.overlay}`);
await page.locator("#go-faq").click();
await page.waitForURL("**/faq.html");
console.log("on faq after leaving game: overlay class", await page.evaluate(() => document.body.classList.contains("overlay-is-open")), "| bingo badge", await page.locator("#bingoIndicator").count());

console.log("errors:", errors.length ? errors : "none");
await browser.close();
