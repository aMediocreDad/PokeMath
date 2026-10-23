// Touch audit of the Svelte pages on phone and tablet: screenshots plus measurable problems.
// Usage: node touch-audit.mjs [prefix] [page-filter]
import { createRequire } from "module";
import { muteAudio } from './mute.mjs';
const require = createRequire(import.meta.url);
const fs = require("fs");
const { webkit, devices } = require("playwright-core");
const BASE = "http://localhost:3123";
const PREFIX = process.argv[2] || "before";
const ONLY = process.argv[3];
const OUT = new URL(`./audit/${PREFIX}/`, import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });

const SAVE = {
  username: "Kari", money: "123456", shinyBaitCount: "1",
  pokemonlist: Array.from({ length: 80 }, (_, i) => `N${i + 1}`).concat(["S6", "N150", "N25", "N25"]).join("|"),
  boughtBackgrounds: "bg-002|bg-004", boughtPlayerIcons: "roxanne|flannery", playerIcon: "flannery",
  playerIconImg: "images/playericons/unconverted/Flannery.webp",
  customPreset1: JSON.stringify("Gange|/pokemath.html?custom=true&mul=t&mumina=2&mumaxa=9&mudec=0&muminb=2&mumaxb=9"),
  backupReminder: new Date(Date.now() + 9e9).toISOString(),
};
const PAGES = ["/pokemath.html?stage=3", "/dex.html", "/pokeviewer.html?pokemonId=6", "/shop.html", "/customizer.html", "/redeem.html", "/player_profile.html", "/saveandload.html", "/faq.html"];
const VIEWPORTS = {
  "iphone": devices["iPhone 13"],
  "iphone-land": devices["iPhone 13 landscape"],
  "ipad": devices["iPad (gen 7)"],
  "ipad-land": devices["iPad (gen 7) landscape"],
};

const browser = muteAudio(await webkit.launch());
const report = [];
for (const [vpName, device] of Object.entries(VIEWPORTS)) {
  const context = await browser.newContext({ ...device });
  await context.addCookies([{ name: "cookies", value: "true", url: BASE }]);
  await context.addInitScript((s) => { for (const [k, v] of Object.entries(s)) if (localStorage.getItem(k) === null) localStorage.setItem(k, v); }, SAVE);
  for (const path of PAGES) {
    if (ONLY && !path.includes(ONLY)) continue;
    const page = await context.newPage();
    await page.clock.install({ time: new Date("2026-05-12T10:00:00") });
    await page.goto(BASE + path);
    await page.clock.runFor(1500);
    await page.waitForTimeout(1500);
    const name = path.slice(1).split(".")[0];
    await page.screenshot({ path: `${OUT}${name}-${vpName}.png` });
    const m = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
      const label = (el) => (el.id ? "#" + el.id : "") + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "") + (el.textContent.trim() ? ` "${el.textContent.trim().slice(0, 18)}"` : "");
      const targets = [...document.querySelectorAll("a[href], button, input, select, label[for], [onclick], .owned-card, .typecard2, .card")].filter(visible);
      const small = targets.filter((el) => { const r = el.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).map((el) => { const r = el.getBoundingClientRect(); return `${label(el)} ${Math.round(r.width)}x${Math.round(r.height)}`; });
      const overflow = [...document.querySelectorAll("body *")].filter((el) => visible(el) && el.getBoundingClientRect().right > vw + 1 && getComputedStyle(el).position !== "fixed").map(label);
      const zoomInputs = [...document.querySelectorAll("input:not([type=checkbox]):not([type=file]), select, textarea")].filter(visible).filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16).map((el) => label(el) + " " + getComputedStyle(el).fontSize);
      return { scrollWidth: document.documentElement.scrollWidth, vw, small: [...new Set(small)], overflow: [...new Set(overflow)].slice(0, 8), zoomInputs };
    });
    report.push({ page: name, vp: vpName, ...m });
    await page.close();
  }
  await context.close();
}
await browser.close();
for (const r of report) {
  console.log(`${r.page.padEnd(15)} ${r.vp.padEnd(12)} hscroll ${r.scrollWidth > r.vw ? `YES (${r.scrollWidth}>${r.vw})` : "no"} | small targets ${r.small.length} | zoom inputs ${r.zoomInputs.length}`);
}
fs.writeFileSync(`${OUT}report.json`, JSON.stringify(report, null, 1));
console.log("details:", `${OUT}report.json`);
