// Check the Svelte FAQ against the legacy one in WebKit at iPad size, with a seeded save.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { webkit, devices } = require("playwright-core");
const BASE = process.argv[2] || "http://localhost:3123";
const OUT = new URL("./shots/", import.meta.url).pathname;
require("fs").mkdirSync(OUT, { recursive: true });

const save = {
  username: "Kari",
  money: "1234",
  pokemonlist: JSON.stringify("N25|N1|S4|N7"),
  tier1Solved: "12",
  tier3Solved: "5",
};

const browser = await webkit.launch();
const context = await browser.newContext({ ...devices["iPad (gen 7)"] });
await context.addInitScript((s) => {
  if (!localStorage.getItem("username")) for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
}, save);
const page = await context.newPage();
const errors = [];
const requests = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("request", (r) => requests.push(new URL(r.url()).pathname));

async function headerValues() {
  return page.evaluate(() => ({
    money: document.getElementById("cointext")?.dataset.total,
    caught: document.getElementById("balltext")?.textContent,
    name: document.getElementById("playertext")?.textContent,
    tier1: document.getElementById("t1solved")?.textContent,
    tier3: document.getElementById("t3solved")?.textContent,
  }));
}

for (const path of ["/faq-legacy.html", "/faq.html"]) {
  await page.goto(BASE + path);
  await page.waitForTimeout(800);
  console.log(path, JSON.stringify(await headerValues()));
  await page.screenshot({ path: `${OUT}${path.slice(1, -5)}.png`, fullPage: false });
}

// Svelte page behaviour
const dateText = await page.locator("p", { hasText: new Date().getFullYear().toString() }).first().textContent();
console.log("date shown:", dateText.trim(), "| expected:", new Date().toDateString());
console.log("total cost:", await page.locator("#total-cost").textContent());
await page.locator('label[for="q1"]').tap();
console.log("q1 opens on tap:", await page.locator("#q1").isChecked());
console.log("track-page sent:", requests.includes("/track-page"));
console.log("cookie notice visible:", await page.locator("#cookie-container").isVisible());
await page.locator("#acceptCookies").tap();
await page.reload();
await page.waitForTimeout(500);
console.log("cookie notice after accept + reload:", await page.locator("#cookie-container").isVisible());

// Leaving for a legacy page must be a full page load that shows the same save
await page.goto(BASE + "/faq.html");
await page.locator("#caught").tap();
await page.waitForURL("**/dex.html");
await page.waitForTimeout(1500);
console.log("tap Pokédex icon ->", new URL(page.url()).pathname, JSON.stringify(await headerValues()));

console.log("errors:", errors.length ? errors : "none");
await browser.close();
