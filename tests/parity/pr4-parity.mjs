// Legacy vs Svelte for the PR 4 pages: run the same actions on both, compare a snapshot after
// every step and the final localStorage. Usage: node pr4-parity.mjs [only-scenario-name]
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { webkit, devices } = require("playwright-core");
const BASE = "http://localhost:3123";
const ONLY = process.argv[2];

const seedRandom = (seed) => `(() => { let a = ${seed}; Math.random = function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`;
const isDefault = (k, v) => v === undefined || v === "0" || v === "" || (k === "shinyLevel" && v === "1") || k === "pkmncaught";
// Values that legitimately differ between runs or only in encoding.
const sameValue = (k, a, b) => {
  if (a === b) return true;
  if (isDefault(k, a) && isDefault(k, b)) return true;
  const unquote = (v) => (v ?? "").replace(/^"+|"+$/g, "");
  if (["shopBackground", "playerIcon", "pokemonlist"].includes(k) && unquote(a) === unquote(b)) return true;
  return false;
};

const browser = await webkit.launch();

async function run(path, scenario) {
  const context = await browser.newContext({ ...devices["iPad (gen 7)"] });
  await context.addCookies([{ name: "cookies", value: "true", url: BASE }]);
  await context.addInitScript(seedRandom(scenario.seed ?? 7));
  await context.addInitScript((s) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, scenario.save);
  const page = await context.newPage();
  await page.clock.install({ time: new Date(scenario.date ?? "2026-05-12T10:00:00") });
  const errors = [];
  page.on("pageerror", (e) => !e.message.includes("getEntriesByType") && errors.push(e.message));
  page.on("dialog", (d) => d.accept(scenario.promptAnswer));
  const toasts = [];
  await page.exposeFunction("__toast", (t) => toasts.push(t));
  await page.addInitScript(() => {
    new MutationObserver((records) => {
      for (const r of records) for (const n of r.addedNodes) if (n.classList?.contains("toast")) setTimeout(() => window.__toast(n.textContent.trim()), 0);
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto(BASE + path + (scenario.query ?? ""));
  await page.clock.runFor(1500);
  await page.waitForTimeout(1800);
  const steps = [];
  const snap = async (label) => {
    await page.clock.runFor(300);
    await page.waitForTimeout(250);
    steps.push([label, await scenario.snap(page), toasts.splice(0)]);
  };
  await snap("load");
  for (const [label, action] of scenario.actions) {
    await action(page);
    await snap(label);
  }
  const storage = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  await context.close();
  return { steps, storage, errors };
}

const scenarios = (await import("./pr4-scenarios.mjs")).default;
let failed = 0;
for (const scenario of scenarios) {
  if (ONLY && !scenario.name.includes(ONLY)) continue;
  const legacy = await run(scenario.legacy, scenario);
  const svelte = await run(scenario.svelte, scenario);
  const problems = [];
  for (let i = 0; i < Math.max(legacy.steps.length, svelte.steps.length); i++) {
    const a = JSON.stringify(legacy.steps[i]), b = JSON.stringify(svelte.steps[i]);
    if (a !== b) problems.push(`  step ${i} ${legacy.steps[i]?.[0]}:\n    legacy ${a?.slice(0, 700)}\n    svelte ${b?.slice(0, 700)}`);
  }
  const keys = [...new Set([...Object.keys(legacy.storage), ...Object.keys(svelte.storage)])].sort();
  for (const k of keys.filter((k) => !(scenario.ignoreKeys ?? []).includes(k))) {
    if (!sameValue(k, legacy.storage[k], svelte.storage[k])) problems.push(`  storage ${k}:\n    legacy ${legacy.storage[k]?.slice(0, 200)}\n    svelte ${svelte.storage[k]?.slice(0, 200)}`);
  }
  if (legacy.errors.length || svelte.errors.length) problems.push(`  errors: legacy ${JSON.stringify(legacy.errors)} svelte ${JSON.stringify(svelte.errors)}`);
  console.log(`${problems.length ? "FAIL" : "PASS"} ${scenario.name} — ${svelte.steps.length} steps`);
  for (const p of problems.slice(0, 6)) console.log(p);
  if (problems.length) failed++;
}
console.log(failed ? `${failed} scenario(s) differ` : "all identical");
await browser.close();
