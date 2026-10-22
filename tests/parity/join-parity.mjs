// Legacy vs Svelte for bingo_join: QR link, typed code, bad code, clear, stored code, and that the
// game page then joins the lobby. Usage: node join-parity.mjs
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { webkit, devices } = require("playwright-core");
const BASE = "http://localhost:3123";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const snap = (page) => page.evaluate(() => ({
  path: location.pathname.replace("-legacy", ""),
  code: document.getElementById("code")?.value ?? null,
  status: document.getElementById("status")?.textContent.trim() ?? null,
  student: document.getElementById("studentOut")?.textContent.trim() ?? null,
  uuidShown: /^[0-9a-f-]{36}$/.test(document.getElementById("uuidOut")?.textContent.trim() ?? ""),
  joined: localStorage.getItem("bingoJoinedCode"),
  legacyKey: localStorage.getItem("bingoCode"),
  uuid: /^[0-9a-f-]{36}$/.test(localStorage.getItem("uuid") ?? ""),
}));

const browser = await webkit.launch();
async function run(path) {
  const context = await browser.newContext({ ...devices["iPhone 13"] });
  await context.addCookies([{ name: "cookies", value: "true", url: BASE }]);
  await context.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("username", "Kari");
    localStorage.setItem("backupReminder", new Date(Date.now() + 9e9).toISOString());
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const out = [];
  const step = async (label, act) => { await act(); await sleep(500); out.push([label, await snap(page)]); };

  await step("QR link, lower case", () => page.goto(BASE + path + "?code=ab-c12x"));
  await step("bad code", async () => { await page.fill("#code", "AB1"); await page.click("#joinBtn"); });
  await step("typed with symbols", async () => { await page.fill("#code", ""); await page.type("#code", "q7-x!9zk"); });
  await step("join", async () => { await page.click("#joinBtn"); await sleep(1200); });
  await step("back to join page", () => page.goto(BASE + path));
  await step("clear", () => page.click("#clearBtn"));
  out.push(["errors", errors]);
  await context.close();
  return out;
}

const legacy = await run("/bingo_join-legacy.html");
const svelte = await run("/bingo_join.html");
let diffs = 0;
legacy.forEach(([label, a], i) => {
  const b = svelte[i]?.[1];
  const norm = (v) => JSON.stringify(v).replace('"path":"/index.html"', '"path":"/"');
  if (norm(a) === norm(b)) return console.log(`same  ${label} ${norm(a)}`);
  diffs++;
  console.log(`DIFF  ${label}\n      legacy ${norm(a)}\n      svelte ${norm(b)}`);
});
console.log(diffs ? `${diffs} step(s) differ` : "all identical");
await browser.close();
