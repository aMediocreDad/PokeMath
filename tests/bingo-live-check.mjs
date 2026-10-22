// The live-site bingo features on the Svelte pages: board size, continue button, kick and rename.
// One teacher in WebKit (desktop), two students in WebKit (iPhone). Usage: node bingo-live-check.mjs [outdir]
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { webkit, devices } = require("playwright-core");
const BASE = "http://localhost:3123";
const OUT = process.argv[2] || ".";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok, detail }); console.log(ok ? "PASS" : "FAIL", name, detail); };

const login = await (await fetch(BASE + "/teacher/access-login", { method: "POST" })).json();
const browser = await webkit.launch();

const teacherCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await teacherCtx.addCookies([{ name: "cookies", value: "true", url: BASE }]);
await teacherCtx.addInitScript((t) => localStorage.setItem("teacherSession", t), login.teacherSession);
const teacher = await teacherCtx.newPage();
teacher.on("pageerror", (e) => console.log("teacher pageerror", e.message));
await teacher.goto(BASE + "/l%C3%A6rer/bingo_settings.html");
await teacher.selectOption("#minLevel", "stage3").catch(() => {});
check("adaptive checkbox shows for a stage minimum", await teacher.locator("#allowAdaptive").isVisible());
await teacher.selectOption("#gridSize", "7");
await teacher.screenshot({ path: `${OUT}/settings-desktop.png`, fullPage: true });
await teacher.click("#startBtn");
await teacher.waitForURL(/bingo_host/);
await teacher.waitForFunction(() => /^[A-Z0-9]{6}$/.test(document.getElementById("code")?.textContent.trim() ?? ""), null, { timeout: 15000 });
const code = (await teacher.textContent("#code")).trim();
await sleep(500);
const cellCount = await teacher.locator("#bingoCard td[data-cell-id]").count();
check("7×7 board has 49 cells", cellCount === 49, `got ${cellCount}`);

async function student(name) {
	// Each student is their own Access login, so they do not share a cloud save.
	const ctx = await browser.newContext({ ...devices["iPhone 13"], extraHTTPHeaders: { "x-dev-email": `${name.toLowerCase()}-${Date.now()}@test.no` } });
	await ctx.addCookies([{ name: "cookies", value: "true", url: BASE }]);
	await ctx.addInitScript((n) => { if (!localStorage.getItem("username")) localStorage.setItem("username", n); }, name);
	const page = await ctx.newPage();
	page.on("pageerror", (e) => console.log(name, "pageerror", e.message));
	const dialogs = [];
	page.on("dialog", (d) => { dialogs.push(d.message()); d.accept(); });
	await page.goto(`${BASE}/bingo_join.html?code=${code}`);
	await page.click("#joinBtn");
	await page.waitForURL(/pokemath\.html/, { timeout: 15000 }).catch(() => {});
	if (!/pokemath\.html/.test(page.url())) await page.goto(BASE + "/pokemath.html?stage=5");
	return { page, dialogs, ctx };
}
const ola = await student("Ola");
const kari = await student("Kari");
await teacher.waitForFunction(() => document.querySelectorAll("#players .player-row").length >= 2, null, { timeout: 15000 }).catch(() => {});
check("host lists both students", (await teacher.locator("#players .player-row").count()) === 2);
await teacher.screenshot({ path: `${OUT}/host-desktop.png`, fullPage: true });

// Rename Kari directly.
teacher.once("dialog", (d) => d.accept("Kari Nordmann"));
await teacher.locator("#players .player-name", { hasText: "Kari" }).click();
await teacher.locator("#bingo-player-menu button", { hasText: "Sett" }).click();
await sleep(1500);
check("student sees the new name", (await kari.page.evaluate(() => localStorage.getItem("username"))) === "Kari Nordmann");

// Kick Ola.
await teacher.locator("#players .player-name", { hasText: "Ola" }).click();
teacher.once("dialog", (d) => d.accept());
await teacher.locator("#bingo-player-menu button", { hasText: "Kast ut" }).click();
await sleep(2000);
check("kicked student got the alert", ola.dialogs.some((m) => /kastet ut/.test(m)), JSON.stringify(ola.dialogs));
check("kicked student is back on the front page", new URL(ola.page.url()).pathname === "/" || /index\.html$/.test(ola.page.url()), ola.page.url());
check("kicked student forgot the code", (await ola.page.evaluate(() => localStorage.getItem("bingoJoinedCode"))) == null);

// The teacher front page offers to continue the running lobby.
await teacher.goto(BASE + "/l%C3%A6rer/index.html");
await teacher.waitForSelector("#continueBingoBtn", { timeout: 10000 }).catch(() => {});
const cont = await teacher.locator("#continueBingoBtn").textContent().catch(() => "");
check("continue button names the lobby", cont.includes(code), cont);

// Phone-size host and join screenshots.
const phoneTeacher = await browser.newContext({ ...devices["iPhone 13"] });
await phoneTeacher.addCookies([{ name: "cookies", value: "true", url: BASE }]);
await phoneTeacher.addInitScript(([t, c]) => { localStorage.setItem("teacherSession", t); localStorage.setItem("teacherBingoCode", c); }, [login.teacherSession, code]);
const pt = await phoneTeacher.newPage();
await pt.goto(BASE + "/l%C3%A6rer/bingo_host.html");
await sleep(2500);
await pt.screenshot({ path: `${OUT}/host-phone.png`, fullPage: true });
const overflow = await pt.evaluate(() => document.documentElement.scrollWidth - innerWidth);
check("phone host has no sideways scroll", overflow <= 0, `overflow ${overflow}px`);
await kari.page.goto(BASE + "/bingo_join.html");
await kari.page.screenshot({ path: `${OUT}/join-phone.png`, fullPage: true });

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
