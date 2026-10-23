// Bingo, legacy vs Svelte game page: a scripted teacher hosts a lobby; the player joins, catches,
// and receives a prize. Compares the WebSocket frames the page sends and the resulting save.
import { createRequire } from "module";
import { muteAudio } from '../mute.mjs';
const require = createRequire(import.meta.url);
const WebSocket = require("ws");
const { webkit, devices } = require("playwright-core");
const BASE = process.argv[2] || "http://localhost:3123";

async function teacher() {
  const r = await fetch(BASE + "/teacher/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "laerer@test.no", password: "passord123" }) });
  const { teacherSession } = await r.json();
  const ws = new WebSocket(BASE.replace("http", "ws") + "/ws");
  const inbox = [];
  ws.on("message", (raw) => inbox.push(JSON.parse(raw)));
  await new Promise((r) => ws.on("open", r));
  const next = async (type) => {
    for (let i = 0; i < 100; i++) {
      const idx = inbox.findIndex((m) => m.type === type);
      if (idx >= 0) return inbox.splice(idx, 1)[0];
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error("host timeout waiting for " + type);
  };
  ws.send(JSON.stringify({ type: "hostCreateLobby", teacherSession, settings: { difficulty: "easy", minLevel: "alle", prizeType: "coins" } }));
  const { code } = await next("lobbyCreated");
  return { ws, code, next, inbox, lock: () => ws.send(JSON.stringify({ type: "hostLockLobby", teacherSession, code })), end: () => ws.send(JSON.stringify({ type: "hostEndLobby", teacherSession, code })) };
}

const browser = muteAudio(await webkit.launch());
async function run(path) {
  const host = await teacher();
  const context = await browser.newContext({ ...devices["iPad (gen 7)"] });
  await context.addCookies([{ name: "cookies", value: "true", url: BASE }]);
  await context.addInitScript(`(() => { let a = 99; Math.random = function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`);
  await context.addInitScript(([code]) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    Object.entries({ username: "Kari", money: "100", pokemonlist: "N25", UUID: "8f14e45f-ceea-4e7a-9f6b-2b0d8c1a3e11", bingoJoinedCode: code }).forEach(([k, v]) => localStorage.setItem(k, v));
  }, [host.code]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const sent = [];
  page.on("websocket", (ws) => ws.on("framesent", (f) => sent.push(JSON.parse(f.payload))));
  await page.clock.install({ time: new Date("2026-05-12T10:00:00") });
  await page.goto(BASE + path + "?stage=5");
  await page.clock.runFor(2000);
  await page.waitForTimeout(2000);
  const indicator = await page.locator("#bingoIndicator").textContent().catch(() => null);
  const players = await host.next("playersUpdate");

  for (let i = 0; i < 3; i++) {
    const [a, op, b] = (await page.locator(".problem").textContent()).trim().split(" ");
    const n = [Number(a), Number(b)];
    const answer = op === "+" ? n[0] + n[1] : op === "-" ? n[0] - n[1] : op === "x" ? n[0] * n[1] : n[0] / n[1];
    await page.locator(".our-field").fill(String(answer));
    await page.locator(".our-field").press("Enter");
    await page.clock.runFor(1200);
  }
  await page.locator("#pokeball").click();
  await page.clock.runFor(500);
  await page.waitForTimeout(800);
  const toast = await host.next("toastCatch");

  host.lock();
  const prize = await host.next("lobbyPrize");
  await page.waitForTimeout(1500);
  await page.clock.runFor(1000);
  await page.waitForTimeout(500);
  const lootboxShown = await page.locator("#bingo-lootbox-overlay").isVisible();
  await page.clock.runFor(3000);
  await page.waitForTimeout(300);
  const label = (await page.locator("#bingo-lootbox-overlay").textContent().catch(() => "")).replace(/\s+/g, " ").trim();
  await page.locator("#bingo-lootbox-overlay").click();
  await page.waitForTimeout(300);
  const lootboxGone = !(await page.locator("#bingo-lootbox-overlay").isVisible().catch(() => false));
  const money = await page.locator("#cointext").getAttribute("data-total");

  host.end();
  await page.waitForTimeout(800);
  const indicatorAfterEnd = await page.locator("#bingoIndicator").isVisible().catch(() => false);
  const storage = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  await context.close();
  host.ws.close();
  return {
    indicator, joinedAs: players.players.map((p) => p.name).join(","),
    sent: sent.map(({ code, ...m }) => m),
    hostSaw: { pokemonCode: toast.pokemonCode, pokemonName: toast.pokemonName, types: toast.types, difficulty: toast.difficulty, flags: toast.flags },
    prize: prize.prize, lootboxShown, label, lootboxGone, moneyInHeader: money, indicatorAfterEnd, storage, errors: errors.filter((e) => !e.includes("getEntriesByType")),
  };
}

const legacy = await run("/pokemath-legacy.html");
const svelte = await run("/pokemath.html");
const isDefault = (k, v) => v === undefined || v === "0" || v === "" || (k === "shinyLevel" && v === "1") || k === "pkmncaught";
let ok = true;
for (const key of Object.keys(legacy)) {
  if (key === "storage") {
    const keys = [...new Set([...Object.keys(legacy.storage), ...Object.keys(svelte.storage)])].sort();
    const diff = keys.filter((k) => legacy.storage[k] !== svelte.storage[k] && !(isDefault(k, legacy.storage[k]) && isDefault(k, svelte.storage[k])));
    console.log(`${diff.length ? "DIFF" : "same"}  storage (${keys.length} keys)`);
    for (const k of diff) { ok = false; console.log(`      ${k}: ${JSON.stringify(legacy.storage[k])?.slice(0, 120)} | ${JSON.stringify(svelte.storage[k])?.slice(0, 120)}`); }
    continue;
  }
  const a = JSON.stringify(legacy[key]), b = JSON.stringify(svelte[key]);
  if (a !== b) ok = false;
  console.log(`${a === b ? "same" : "DIFF"}  ${key}: ${a.slice(0, 300)}${a === b ? "" : `\n      svelte: ${b.slice(0, 300)}`}`);
}
console.log(ok ? "bingo identical" : "bingo differs");
await browser.close();
