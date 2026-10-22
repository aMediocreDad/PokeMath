// Teacher pages, the join page and the host board with some marks, at iPad, iPhone and desktop size.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const fs = require("fs");
const { webkit, devices } = require("playwright-core");
const WebSocket = require("ws");
const BASE = "http://localhost:3123";
const OUT = new URL(`./design/teacher/`, import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const login = async () => (await (await fetch(BASE + "/teacher/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "laerer@test.no", password: "passord123" }) })).json()).teacherSession;

const browser = await webkit.launch();
for (const [vp, device] of [["ipad", devices["iPad (gen 7) landscape"]], ["iphone", devices["iPhone 13"]], ["desktop", { viewport: { width: 1440, height: 900 } }]]) {
  const context = await browser.newContext({ ...device });
  await context.addCookies([{ name: "cookies", value: "true", url: BASE }]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  const shot = async (name, full = false) => {
    await sleep(700);
    await page.screenshot({ path: `${OUT}${name}-${vp}.png`, fullPage: full });
    const sw = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    console.log(vp, name, sw > 0 ? `HSCROLL ${sw}` : "ok", errors.splice(0).join(" | "));
  };
  await page.goto(BASE + encodeURI("/lærer/"));
  await shot("login", true);
  await page.goto(BASE + "/verify-email.html?token=nope");
  await shot("verify-bad");
  await page.goto(BASE + encodeURI("/lærer/reset-password.html?token=abc"));
  await shot("reset");
  const token = await login();
  await page.evaluate((t) => { localStorage.setItem("teacherSession", t); localStorage.removeItem("teacherBingoCode"); }, token);
  await page.goto(BASE + encodeURI("/lærer/index.html"));
  await sleep(600);
  await page.click("#showCodesBtn");
  await page.click("#showCreateCodeBtn");
  await page.selectOption("#tcType", "pokemon");
  await shot("logged-in", true);
  await page.goto(BASE + encodeURI("/lærer/bingo_settings.html"));
  await shot("settings", true);
  await page.selectOption("#prizeType", "participation_coins");
  await page.click("#startBtn");
  await page.waitForFunction(() => /^[A-Z0-9]{6}$/.test(document.querySelector("#code")?.textContent.trim() ?? ""));
  const code = (await page.textContent("#code")).trim();
  const kids = ["Kari", "Ola", "Nora"].map((name) => {
    const ws = new WebSocket("ws://localhost:3123/ws");
    const uuid = crypto.randomUUID();
    return { name, uuid, ws, ready: new Promise((r) => ws.on("open", r)) };
  });
  for (const k of kids) { await k.ready; k.ws.send(JSON.stringify({ type: "joinLobby", code, uuid: k.uuid, name: k.name, icon: "" })); }
  await sleep(400);
  kids[1].ws.send(JSON.stringify({ type: "catchPokemon", code, uuid: kids[1].uuid, difficulty: "stage3", pokemonCode: "N4", pokedexId: 4, pokemonName: "Charmander", types: ["fire"], flags: {} }));
  for (const cell of [0, 1, 6, 7, 18]) { await page.click(`#bingoCard td >> nth=${cell}`); await sleep(150); }
  await shot("host");
  await page.click("#showQrBtn");
  await shot("host-qr");
  await page.click("#qrClose");
  for (const k of kids) k.ws.close();
  await page.click("#endGameBtn");
  await page.goto(BASE + "/bingo_join.html?code=" + code);
  await shot("join", true);
  await context.close();
}
await browser.close();
