// Play the legacy and the Svelte game with the same seeded Math.random and a pinned date,
// and compare what they show and what they leave in localStorage.
// Usage: node game-parity.mjs [base] [date ISO]
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { webkit, devices } = require("playwright-core");
const BASE = process.argv[2] || "http://localhost:3123";
const DATE = process.argv[3] || "2026-05-12T10:00:00";

const SAVE = {
  username: "Kari",
  money: "1000",
  // N1 is likely to repeat on low rolls; seeded below to check duplicate payouts.
  pokemonlist: "N25|N4",
  shinyLevel: "2",
  shinyBaitCount: "1",
  coinLevel: "2",
};

// Each scenario: query string and a script of answers: "c" correct, "w" wrong.
const SCENARIOS = [
  { name: "stage 1, clean round", query: "?stage=1", moves: "ccccc" },
  { name: "stage 3, mistakes then win", query: "?stage=3", moves: "cwcwccc" },
  { name: "stage 3, three wrong resets", query: "?stage=3", moves: "cwww" + "ccccc" },
  { name: "stage 4 (4 to win)", query: "?stage=4", moves: "cccc" + "cccc" },
  { name: "stage 5 (3 to win)", query: "?stage=5", moves: "ccc" + "ccc" + "ccc" },
  { name: "no stage", query: "", moves: "ccccc" },
  { name: "custom, + and x with decimals", query: "?custom=true&add=t&amin=0&amax=50&aminb=0&amaxb=50&adec=1&mul=t&mumina=2&mumaxa=12&muminb=2&mumaxb=12&mudeca=0", moves: "ccccc" },
  { name: "custom too easy (stage 0)", query: "?custom=true&add=t&amin=0&amax=1&aminb=0&amaxb=1&adec=0", moves: "ccccc" },
  { name: "tampered stage", query: "?stage=2.5", moves: "ccc" },
];

function mulberry32Source(seed) {
  return `(() => { let a = ${seed} >>> 0; Math.random = function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`;
}

function solve(text) {
  const m = text.trim().match(/^(-?[\d.]+) ([+\-x/]) (-?[\d.]+)$/);
  if (!m) throw new Error("cannot read problem: " + JSON.stringify(text));
  const [a, op, b] = [Number(m[1]), m[2], Number(m[3])];
  const r = op === "+" ? a + b : op === "-" ? a - b : op === "x" ? a * b : a / b;
  return Number(r.toFixed(6));
}

const browser = await webkit.launch();

async function play(path, scenario, seed) {
  const context = await browser.newContext({ ...devices["iPad (gen 7)"] });
  await context.addCookies([{ name: "cookies", value: "true", url: BASE }]);
  await context.addInitScript(mulberry32Source(seed));
  await context.addInitScript((s) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, SAVE);
  const page = await context.newPage();
  await page.clock.install({ time: new Date(DATE) });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  await page.goto(BASE + path + scenario.query);
  await page.clock.runFor(1500);
  await page.waitForTimeout(1500); // pokemon_info.json

  const log = [];
  const snap = () => page.evaluate(() => ({
    problem: document.querySelector(".problem")?.textContent.trim(),
    needed: document.querySelector(".points-needed")?.textContent.trim(),
    mistakes: document.querySelector(".mistakes-allowed")?.textContent.trim(),
    boxes: document.querySelectorAll(".boxes .box").length,
    money: document.getElementById("cointext")?.dataset.total,
    caught: document.getElementById("balltext")?.textContent.trim(),
    name: document.getElementById("playertext")?.textContent.trim(),
    overlay: document.body.classList.contains("overlay-is-open"),
  }));
  log.push(["load", await snap()]);
  for (const move of scenario.moves) {
    const s = await snap();
    if (s.overlay) break;
    const correct = solve(s.problem);
    await page.locator(".our-field").fill(String(move === "c" ? correct : correct + 1));
    await page.locator(".our-field").press("Enter");
    await page.clock.runFor(1200);
    const after = await snap();
    log.push([move, after]);
    if (after.overlay) {
      const message = await page.locator(".end-message").textContent();
      await page.clock.runFor(500);
      await page.locator("#pokeball").click();
      await page.clock.runFor(800);
      const caught = await page.evaluate(() => ({
        message: document.querySelector(".end-message").textContent,
        image: (document.querySelector("#new-catch-info .pkmn-pop")?.style.backgroundImage ?? "").replace(/^url\("?|"?\)$/g, "").replace(/^\//, ""),
        cards: [...document.querySelectorAll("#pokedex > a")].map((a) => a.id + ":" + a.querySelector(".card-counter").textContent),
      }));
      log.push(["win", { cheer: message, ...caught }]);
      await page.locator(".reset-button").click();
      await page.clock.runFor(500);
      log.push(["continue", await snap()]);
    }
  }
  const storage = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  await context.close();
  return { log, storage, errors };
}

const isDefault = (k, v) => v === undefined || v === "0" || (k === "shinyLevel" && v === "1") || k === "pkmncaught";
let failures = 0;
for (const [i, scenario] of SCENARIOS.entries()) {
  const seed = 1000 + i * 7;
  const legacy = await play("/pokemath-legacy.html", scenario, seed);
  const svelte = await play("/pokemath.html", scenario, seed);
  const problems = [];
  const len = Math.max(legacy.log.length, svelte.log.length);
  for (let j = 0; j < len; j++) {
    const a = JSON.stringify(legacy.log[j]);
    const b = JSON.stringify(svelte.log[j]);
    if (a !== b) problems.push(`  step ${j}:\n    legacy ${a}\n    svelte ${b}`);
  }
  const keys = [...new Set([...Object.keys(legacy.storage), ...Object.keys(svelte.storage)])].sort();
  for (const k of keys) {
    const [a, b] = [legacy.storage[k], svelte.storage[k]];
    if (a === b || (isDefault(k, a) && isDefault(k, b))) continue;
    problems.push(`  storage ${k}:\n    legacy ${a?.slice(0, 200)}\n    svelte ${b?.slice(0, 200)}`);
  }
  if (legacy.errors.length || svelte.errors.length) problems.push(`  errors: legacy ${JSON.stringify(legacy.errors)} svelte ${JSON.stringify(svelte.errors)}`);
  const wins = svelte.log.filter(([k]) => k === "win").map(([, w]) => w.image.split("/").slice(-2).join("/"));
  console.log(`${problems.length ? "FAIL" : "PASS"} ${scenario.name} — ${svelte.log.length} steps, catches: ${wins.join(", ") || "none"}`);
  for (const p of problems.slice(0, 8)) console.log(p);
  if (problems.length) failures++;
}
console.log(failures ? `${failures} scenario(s) differ` : "all scenarios identical");
await browser.close();
