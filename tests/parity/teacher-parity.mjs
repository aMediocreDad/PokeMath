// Legacy vs Svelte for the teacher pages (PR 6): the same steps on both, a snapshot of what is
// visible after each, and the storage at the end. Emails the mock server "sends" are read from its
// log. Usage: SERVER_LOG=<task output file> node teacher-parity.mjs [scenario]
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const fs = require("fs");
const { webkit, devices } = require("playwright-core");
const BASE = "http://localhost:3123";
const ONLY = process.argv[2];
const LOG = process.env.SERVER_LOG;

/** The last token the mock server logged on a line containing `needle`. */
function tokenFromLog(needle) {
  const lines = fs.readFileSync(LOG, "utf8").split("\n").filter((l) => l.includes(needle));
  const m = lines.at(-1)?.match(/token=([\w-]+)/);
  return m?.[1] ?? null;
}

const IDS = ["sessionBox", "loginBox", "registerBox", "createCodePanel", "codesPanel", "forgotBox", "who", "whoEmail", "loginStatus", "registerStatus", "forgotStatus", "createCodeStatus", "deleteStatus",
  "tokenCount", "tcValueField", "tcValueLabel", "tcValueHint", "tcRepeatableRow", "codesList", "resetBox", "invalidBox", "resetStatus", "loadingBox", "successBox", "errorBox", "errorMsg", "teacherName",
  "mustLogin", "settingsBox", "status", "difficulty", "minLevel", "className", "prizeType", "prizeSecret"];

const snapshot = (page) => page.evaluate((ids) => {
  const out = {};
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    const visible = el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
    if (!visible) continue;
    if (el.matches("input[type=checkbox]")) out[id] = el.checked;
    else if (el.matches("input, select")) out[id] = el.value;
    else out[id] = el.textContent.replace(/\s+/g, " ").replace(/[🔑]/g, "").trim();
  }
  out.path = decodeURI(location.pathname).replace("-legacy", "");
  out.session = !!localStorage.getItem("teacherSession");
  out.bingoSettings = sessionStorage.getItem("bingoSettings");
  return out;
}, IDS);

const SCENARIOS = [
  {
    name: "start page: login, forgot, register, codes, logout",
    page: "/lærer/index",
    steps: (tag) => [
      ["load", async () => {}],
      ["wrong password", async (p) => { await p.fill("#loginEmail", "laerer@test.no"); await p.fill("#loginPassword", "feil"); await p.click("#loginBtn"); }],
      ["forgot open", async (p) => p.click("#forgotBtn")],
      ["forgot send", async (p) => p.click("#forgotSendBtn")],
      ["forgot close", async (p) => p.click("#forgotCloseBtn")],
      ["register short password", async (p) => { await p.fill("#regName", "Ny"); await p.fill("#regEmail", `ny-${tag}@test.no`); await p.fill("#regPassword", "kort"); await p.click("#registerBtn"); }],
      ["register", async (p) => { await p.fill("#regPassword", "passord123"); await p.fill("#regSchool", "Skole"); await p.click("#registerBtn"); }],
      ["unverified login", async (p) => { await p.fill("#loginEmail", `ny-${tag}@test.no`); await p.fill("#loginPassword", "passord123"); await p.click("#loginBtn"); }],
      ["login", async (p) => { await p.fill("#loginEmail", "LAERER@test.no "); await p.fill("#loginPassword", "passord123"); await p.click("#loginBtn"); }],
      ["codes", async (p) => p.click("#showCodesBtn")],
      ["create open", async (p) => p.click("#showCreateCodeBtn")],
      ["create empty", async (p) => p.click("#createTeacherCodeBtn")],
      ["coins too many", async (p) => { await p.fill("#tcCode", `K${tag}`); await p.fill("#tcLabel", "Mynter!"); await p.fill("#tcValue", "60000"); await p.click("#createTeacherCodeBtn"); }],
      ["pokemon type", async (p) => p.selectOption("#tcType", "pokemon")],
      ["pokemon unique", async (p) => { await p.fill("#tcValue", "N25-U1"); await p.click("#createTeacherCodeBtn"); }],
      ["pokemon bad format", async (p) => { await p.fill("#tcValue", "X25"); await p.click("#createTeacherCodeBtn"); }],
      ["pokemon bad id", async (p) => { await p.fill("#tcValue", "N2000"); await p.click("#createTeacherCodeBtn"); }],
      ["pokemon bad variant", async (p) => { await p.fill("#tcValue", "N25-99"); await p.click("#createTeacherCodeBtn"); await p.waitForTimeout(1500); }],
      ["message type", async (p) => p.selectOption("#tcType", "message")],
      ["coins ok", async (p) => { await p.selectOption("#tcType", "coins"); await p.fill("#tcValue", "1000"); await p.click("#createTeacherCodeBtn"); }],
      ["logout", async (p) => p.click("#logoutBtn")],
    ],
  },
  {
    name: "reset password: no token, mismatch, ok",
    page: "/lærer/reset-password",
    steps: () => [
      ["no token", async () => {}],
      ["with token", async (p, path) => {
        await p.request.post(BASE + "/teacher/forgot-password", { data: { email: "laerer@test.no" } });
        await p.waitForTimeout(300);
        await p.goto(BASE + path + "?token=" + tokenFromLog("Nytt passord for laerer@test.no"));
      }],
      ["too short", async (p) => { await p.fill("#pw1", "kort"); await p.click("#submitBtn"); }],
      ["mismatch", async (p) => { await p.fill("#pw1", "passord123"); await p.fill("#pw2", "passord124"); await p.click("#submitBtn"); }],
      ["ok", async (p) => { await p.fill("#pw2", "passord123"); await p.press("#pw2", "Enter"); }],
      ["redirect", async (p) => p.waitForTimeout(2600)],
      ["used token", async (p, path) => p.goto(BASE + path + "?token=" + tokenFromLog("Nytt passord for laerer@test.no"))],
      ["used token submit", async (p) => { await p.fill("#pw1", "passord123"); await p.fill("#pw2", "passord123"); await p.click("#submitBtn"); }],
    ],
  },
  {
    name: "verify email: no token, good, used",
    page: "/verify-email",
    steps: (tag) => [
      ["no token", async () => {}],
      ["good", async (p, path) => {
        await p.request.post(BASE + "/teacher/register", { data: { name: "Verifi", email: `v-${tag}@test.no`, password: "passord123" } });
        await p.waitForTimeout(300);
        await p.goto(BASE + path + "?token=" + tokenFromLog(`Bekreft v-${tag}@test.no`));
      }],
      ["used", async (p) => p.reload()],
    ],
  },
  {
    name: "bingo settings: logged out, restore, reset, start",
    page: "/lærer/bingo_settings",
    steps: () => [
      ["logged out", async () => {}],
      ["logged in", async (p) => {
        const { teacherSession } = await (await p.request.post(BASE + "/teacher/login", { data: { email: "laerer@test.no", password: "passord123" } })).json();
        await p.evaluate((t) => { localStorage.setItem("teacherSession", t); sessionStorage.setItem("bingoSettings", JSON.stringify({ difficulty: "hard", minLevel: "stage3", className: "7A", prizeType: "stardust", prizeSecret: true })); }, teacherSession);
        await p.reload();
      }],
      ["reset", async (p) => p.click("#resetBtn")],
      ["choose", async (p) => { await p.selectOption("#difficulty", "unik"); await p.fill("#className", "  5B  "); await p.check("#prizeSecret"); }],
      ["start", async (p) => { await p.click("#startBtn"); await p.waitForTimeout(800); }],
    ],
  },
];

const browser = await webkit.launch();
async function run(path, scenario, tag) {
  const context = await browser.newContext({ ...devices["iPad (gen 7)"] });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  await page.goto(BASE + path);
  await page.waitForTimeout(800);
  const out = [];
  for (const [label, act] of scenario.steps(tag)) {
    try { await act(page, path); } catch (e) { out.push([label, "ACTION FAILED " + e.message.split("\n")[0]]); continue; }
    await page.waitForTimeout(700);
    out.push([label, await snapshot(page)]);
  }
  await context.close();
  return { out, errors };
}

let differ = 0;
for (const s of SCENARIOS.filter((s) => !ONLY || s.name.includes(ONLY))) {
  const tag = Date.now().toString(36);
  const legacy = await run(encodeURI(s.page + "-legacy.html"), s, "l" + tag);
  const svelte = await run(encodeURI(s.page + ".html"), s, "s" + tag);
  const diffs = [];
  legacy.out.forEach(([label, a], i) => {
    const b = svelte.out[i]?.[1];
    // Per-run values: the registered address and the code made.
    const norm = (v) => JSON.stringify(v).replace(/ny-[ls]\w+@/g, "ny-X@").replace(/v-[ls]\w+@/g, "v-X@").replace(/K[ls][a-z0-9]+/gi, "KX").replace(/"tokenCount":"\d+"/, '"tokenCount":"N"');
    if (norm(a) !== norm(b)) diffs.push(`  step ${i} ${label}:\n    legacy ${norm(a)}\n    svelte ${norm(b)}`);
  });
  if (legacy.errors.length || svelte.errors.length) diffs.push(`  errors: legacy ${JSON.stringify(legacy.errors)} svelte ${JSON.stringify(svelte.errors)}`);
  console.log(`${diffs.length ? "FAIL" : "PASS"} ${s.name} — ${legacy.out.length} steps`);
  if (diffs.length) { differ++; console.log(diffs.join("\n")); }
}
console.log(differ ? `${differ} scenario(s) differ` : "all identical");
await browser.close();
