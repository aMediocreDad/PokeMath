// Compare legacy and Svelte headers with a player icon, a shop background and a due backup reminder.
import { createRequire } from "module";
import { muteAudio } from '../mute.mjs';
const require = createRequire(import.meta.url);
const { webkit, devices } = require("playwright-core");
const BASE = process.argv[2] || "http://localhost:3123";
const OUT = new URL("./shots/", import.meta.url).pathname;

const save = {
  username: "Kari",
  money: "99",
  pokemonlist: JSON.stringify(Array.from({ length: 30 }, (_, i) => `N${i + 1}`).join("|")),
  playerIcon: JSON.stringify("roxanne"),
  playerIconImg: "images/playericons/unconverted/Roxanne.webp",
  shopBackground: JSON.stringify("bg-002"),
};

const browser = muteAudio(await webkit.launch());
for (const path of ["/faq-legacy.html", "/faq.html"]) {
  const context = await browser.newContext({ ...devices["iPad (gen 7)"] });
  await context.addCookies([{ name: "cookies", value: "true", url: BASE }]);
  await context.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, save);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + path);
  await page.waitForTimeout(1200);
  const info = await page.evaluate(() => ({
    caught: document.getElementById("balltext")?.textContent,
    playerimage: document.getElementById("playerimage")?.src.replace(location.origin, ""),
    playerimageLoaded: document.getElementById("playerimage")?.naturalWidth > 0,
    background: document.getElementById("background")?.src.replace(location.origin, ""),
    backgroundLoaded: document.getElementById("background")?.naturalWidth > 0,
    backupPopupVisible: !document.getElementById("backup-popup")?.classList.contains("hidden"),
  }));
  console.log(path, JSON.stringify(info), "errors:", errors.length ? errors : "none");
  await page.screenshot({ path: `${OUT}branches-${path.slice(1, -5)}.png` });

  if (path === "/faq.html") {
    await page.selectOption("#snooze-select", "3");
    page.once("dialog", (d) => { console.log("snooze alert:", d.message()); d.accept(); });
    await page.locator("#snooze-btn").tap();
    await page.waitForTimeout(300);
    const until = await page.evaluate(() => localStorage.getItem("backupReminder"));
    console.log("backupReminder written:", until, "| days ahead:", Math.round((new Date(until) - Date.now()) / 864e5));
    console.log("popup hidden after snooze:", await page.locator("#backup-popup").evaluate((el) => el.classList.contains("hidden")));
  }
  await context.close();
}
await browser.close();
