// Legacy vs Svelte: profile page actions and backup round trips, compared by localStorage contents.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const fs = require("fs");
const { webkit, devices } = require("playwright-core");
const BASE = process.argv[2] || "http://localhost:3123";
const TMP = new URL("./tmp/", import.meta.url).pathname;
fs.mkdirSync(TMP, { recursive: true });

const SAVE = {
  username: "Kari",
  money: "5000",
  pokemonlist: "N25|N25|S4|N52-2|N150",
  tier1Solved: "12", tier3Solved: "5",
  boughtPlayerIcons: "roxanne|brawly|roxanne",
  boughtBackgrounds: "bg-002|bg-019",
  shinyLevel: "3",
};

const browser = await webkit.launch();
const errors = [];

async function open(path, seed = SAVE) {
  const context = await browser.newContext({ ...devices["iPad (gen 7)"], acceptDownloads: true });
  await context.addCookies([{ name: "cookies", value: "true", url: BASE }]);
  await context.addInitScript((s) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, seed);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`${path}: ${e.message}`));
  page.on("dialog", (d) => d.accept());
  await page.goto(BASE + path);
  await page.waitForTimeout(1200);
  return { context, page };
}
const storage = (page) => page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
function diff(label, a, b, ignore = []) {
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => !ignore.includes(k)).sort();
  const d = keys.filter((k) => a[k] !== b[k]);
  console.log(`${label}: ${keys.length} keys, ${d.length} differ${d.length ? "" : " ✓"}`);
  for (const k of d) console.log(`   ${k}: ${JSON.stringify(a[k])?.slice(0, 100)}  vs  ${JSON.stringify(b[k])?.slice(0, 100)}`);
}

// 1. Profile: what it shows, then the same actions on both pages
const profileText = async (page) => page.evaluate(() => ({
  coins: document.getElementById("statCoins").textContent.trim(),
  caught: document.getElementById("statCaught").textContent.trim(),
  t1: document.getElementById("statT1").textContent.trim(),
  icons: document.getElementById("ownedIconCount").textContent.trim(),
  bgs: document.getElementById("ownedBgCount").textContent.trim(),
  bars: [...document.querySelectorAll(".profile-pbar-text")].map((e) => e.textContent.trim()).join(" | "),
  name: document.getElementById("usernameInput").value,
}));
const results = {};
for (const path of ["/player_profile-legacy.html", "/player_profile.html"]) {
  const { context, page } = await open(path);
  const shown = await profileText(page);
  await page.locator("#usernameInput").fill("Ola");
  await page.getByRole("button", { name: "Lagre" }).tap();
  await page.locator("#iconGrid").evaluate((el) => el.previousElementSibling.click());
  await page.locator("#ownedIconGrid .owned-card").nth(1).click();
  await page.locator("#bgGrid").evaluate((el) => el.previousElementSibling.click());
  await page.locator("#ownedBgGrid .owned-card").nth(1).click();
  await page.waitForTimeout(300);
  const afterEquip = await storage(page);
  await page.getByRole("button", { name: "Fjern figur" }).tap();
  await page.waitForTimeout(300);
  results[path] = { shown, afterEquip, afterRemove: await storage(page), header: await page.locator("#playertext").textContent() };
  await context.close();
}
const [L, S] = ["/player_profile-legacy.html", "/player_profile.html"].map((p) => results[p]);
console.log("profile shows (legacy):", JSON.stringify(L.shown));
console.log("profile shows (svelte):", JSON.stringify(S.shown));
console.log("header name after save:", L.header, "/", S.header);
diff("profile after rename + equip", L.afterEquip, S.afterEquip);
diff("profile after remove icon", L.afterRemove, S.afterRemove);

// 2. Backups across both directions
async function makeBackup(path) {
  const { context, page } = await open(path);
  const original = await storage(page);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Last ned" }).tap()]);
  const file = TMP + (await dl.suggestedFilename());
  await dl.saveAs(file);
  await context.close();
  return { file, original, name: await dl.suggestedFilename() };
}
async function restore(path, file) {
  const { context, page } = await open(path, { username: "Someone", money: "1" });
  await page.locator("#fileInput").setInputFiles(file);
  await page.waitForTimeout(1500);
  const out = { storage: await storage(page), header: await page.locator("#balltext").textContent() };
  await context.close();
  return out;
}
const legacyBackup = await makeBackup("/saveandload-legacy.html");
const svelteBackup = await makeBackup("/saveandload.html");
console.log("backup file names:", legacyBackup.name, "/", svelteBackup.name);
diff("backup contents (legacy file vs svelte file)",
  JSON.parse(Buffer.from(fs.readFileSync(legacyBackup.file, "utf8"), "base64").toString("latin1")),
  JSON.parse(Buffer.from(fs.readFileSync(svelteBackup.file, "utf8"), "base64").toString("latin1")),
  ["backupReminder"]);
for (const [from, backup] of [["legacy", legacyBackup], ["svelte", svelteBackup]]) {
  const intoLegacy = await restore("/saveandload-legacy.html", backup.file);
  const intoSvelte = await restore("/saveandload.html", backup.file);
  diff(`restore ${from} file: legacy vs svelte result`, intoLegacy.storage, intoSvelte.storage, ["backupReminder"]);
  console.log(`   header caught after restore: ${intoLegacy.header} / ${intoSvelte.header}`);
}

// 3. Old-format backup
const oldState = ["Gammel", "777", "0", "0", "0", "3", "N1,N4,S7", "1", "2", "3", "4", "5", "0"].join("|") + "|";
const oldShop = ["bg-003", "brawly", "bg-003", "brawly", "", "2", "0", "1", "0", "1"].join("|") + "|";
const oldFile = TMP + "old.pkmth";
fs.writeFileSync(oldFile, Buffer.from(`${oldState}*SPLIT*${oldShop}*SPLIT*2023|[1,2]*SPLIT*${JSON.stringify({ version: "1.1", badges: [] })}*SPLIT*["KODE"]`, "latin1").toString("base64"));
const oldLegacy = await restore("/saveandload-legacy.html", oldFile);
const oldSvelte = await restore("/saveandload.html", oldFile);
diff("restore old-format file", oldLegacy.storage, oldSvelte.storage, ["backupReminder"]);
console.log(`   header caught after restore: ${oldLegacy.header} / ${oldSvelte.header}`);

console.log("errors:", errors.length ? errors : "none");
await browser.close();
