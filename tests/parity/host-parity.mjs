// Legacy vs Svelte for the bingo host board: a teacher page in WebKit and a student played from
// Node over /ws. Boards and codes are random per lobby, so snapshots compare structure and text,
// not which tasks landed where. Usage: node host-parity.mjs
import { createRequire } from "module";
import { muteAudio } from '../mute.mjs';
const require = createRequire(import.meta.url);
const { webkit, devices } = require("playwright-core");
const WebSocket = require("ws");
const BASE = "http://localhost:3123";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function teacherSession() {
  const r = await fetch(BASE + "/teacher/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "laerer@test.no", password: "passord123" }) });
  return (await r.json()).teacherSession;
}

function student(code, uuid, name) {
  const ws = new WebSocket("ws://localhost:3123/ws");
  const got = [];
  ws.on("message", (d) => got.push(JSON.parse(String(d)).type));
  const ready = new Promise((r) => ws.on("open", r));
  return {
    got,
    async join() { await ready; ws.send(JSON.stringify({ type: "joinLobby", code, uuid, name, icon: "" })); },
    catch(fields) { ws.send(JSON.stringify({ type: "catchPokemon", code, uuid, types: [], flags: {}, ...fields })); },
    close() { ws.close(); },
  };
}

const snapshot = (page) => page.evaluate(() => {
  const text = (sel) => (document.querySelector(sel)?.textContent ?? "").replace(/\s+/g, " ").trim();
  const visible = (sel) => { const el = document.querySelector(sel); return !!el && el.getClientRects().length > 0 && getComputedStyle(el).display !== "none"; };
  const tds = [...document.querySelectorAll("#bingoCard td")];
  return {
    codeLen: text("#code").length,
    difficulty: text("#difficultyLabel"),
    className: text("#classNameLabel"),
    cells: tds.length,
    freeAt: tds.findIndex((td) => td.classList.contains("free-space")),
    freeText: text("#bingoCard td.free-space"),
    toggled: tds.filter((td) => td.classList.contains("toggled")).length,
    total: text("#totalCatches"),
    players: text("#playerCount"),
    playerNames: [...document.querySelectorAll(".player-name")].map((e) => e.textContent.trim()).join(","),
    logCount: text("#logCount"),
    logTop: text("#events > div:first-child").replace(/^\d\d:\d\d:\d\d\s*/, ""),
    toast: visible("#toast") ? text("#toast") : "",
    prize: visible("#prizeModal") ? text("#prizeModal") : "",
    banner: visible("#host-banner") ? text("#host-banner").replace(/×$/, "").trim() : "",
    stored: !!localStorage.getItem("teacherBingoCode"),
  };
});

const browser = muteAudio(await webkit.launch());
async function run(path) {
  const token = await teacherSession();
  const context = await browser.newContext({ ...devices["iPad (gen 7) landscape"] });
  await context.addInitScript(([t]) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("teacherSession", t);
    localStorage.removeItem("teacherBingoCode");
    sessionStorage.setItem("bingoSettings", JSON.stringify({ difficulty: "easy", minLevel: "stage2", className: "7A", prizeType: "coins", prizeSecret: false }));
  }, [token]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  const out = [];
  const snap = async (label, wait = 600) => { await sleep(wait); out.push([label, await snapshot(page)]); };

  await page.goto(BASE + path);
  await page.waitForFunction(() => /^[A-Z0-9]{6}$/.test(document.querySelector("#code")?.textContent.trim() ?? ""));
  await snap("created");
  const code = (await page.textContent("#code")).trim();
  const kid = student(code, crypto.randomUUID(), "Kari");
  await kid.join();
  await snap("student joined");
  kid.catch({ difficulty: "stage1", pokemonCode: "N25", pokedexId: 25, pokemonName: "Pikachu", types: ["electric"] });
  await snap("catch below level");
  kid.catch({ difficulty: "stage3", pokemonCode: "N10000", pokedexId: 10000, pokemonName: "Ingen", types: ["nothing"] });
  await snap("catch without match");
  for (let i = 0; i < 5; i++) { await page.click(`#bingoCard tr:nth-child(1) td:nth-child(${i + 1})`); await sleep(250); }
  await snap("row 1 marked by hand");
  await page.click("#bingoCard tr:nth-child(1) td:nth-child(1)");
  await snap("unmark one");
  await page.click("#sortAlphaBtn");
  await page.click("#toggleCatchesBtn");
  await snap("sort and hide catches", 200);
  await page.click("#toggleLog");
  await snap("log hidden", 200);
  await page.click("#toggleLog");
  const cellsLeft = await page.$$("#bingoCard td:not(.toggled):not(.free-space)");
  for (const td of cellsLeft) { await td.click(); await sleep(120); }
  await snap("full board", 2500);
  await page.reload();
  await page.waitForFunction(() => /^[A-Z0-9]{6}$/.test(document.querySelector("#code")?.textContent.trim() ?? ""));
  await snap("reload keeps lobby");
  const sameCode = (await page.textContent("#code")).trim() === code;
  await page.click("#endGameBtn");
  await snap("ended");
  out.push(["student messages", kid.got.join(",") + " sameCode=" + sameCode]);
  kid.close();
  await context.close();
  return { out, errors };
}

const legacy = await run(encodeURI("/lærer/bingo_host-legacy.html"));
const svelte = await run(encodeURI("/lærer/bingo_host.html"));
let diffs = 0;
legacy.out.forEach(([label, a], i) => {
  const b = svelte.out[i]?.[1];
  const ja = JSON.stringify(a), jb = JSON.stringify(b);
  if (ja === jb) { console.log(`same  ${label}`); return; }
  diffs++;
  console.log(`DIFF  ${label}\n      legacy ${ja}\n      svelte ${jb}`);
});
console.log("errors:", JSON.stringify(legacy.errors), JSON.stringify(svelte.errors));
console.log(diffs ? `${diffs} step(s) differ` : "all identical");
await browser.close();
