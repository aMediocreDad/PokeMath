// Header on touch devices: what fits, and whether the menu and trainer card open and close on tap.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { webkit, devices } = require("playwright-core");
const BASE = "http://localhost:3123";
const OUT = new URL("./shots/", import.meta.url).pathname;
const browser = await webkit.launch();
for (const [name, device] of [["se", devices["iPhone SE"]], ["iphone", devices["iPhone 13"]], ["ipad", devices["iPad (gen 7)"]], ["desktop", { viewport: { width: 1280, height: 800 } }]]) {
  const context = await browser.newContext({ ...device });
  await context.addCookies([{ name: "cookies", value: "true", url: BASE }]);
  await context.addInitScript(() => Object.entries({ username: "Kari", money: "123456", pokemonlist: Array.from({ length: 840 }, (_, i) => `N${i + 1}`).join("|"), playerIcon: "flannery", playerIconImg: "images/playericons/unconverted/Flannery.webp" }).forEach(([k, v]) => localStorage.getItem(k) === null && localStorage.setItem(k, v)));
  const page = await context.newPage();
  await page.goto(BASE + "/faq.html");
  await page.waitForTimeout(1200);
  const tap = (sel) => (device.hasTouch ? page.tap(sel) : page.click(sel));
  const visible = (sel) => page.locator(sel).isVisible();
  const header = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const items = ["#backbutton", "#money", "#caught", "#badges", "#playercard", ".dropdown"].map((s) => {
      const el = document.querySelector(s); const r = el.getBoundingClientRect(); const st = getComputedStyle(el);
      return `${s}:${st.display === "none" ? "hidden" : `${Math.round(r.left)}-${Math.round(r.right)}`}`;
    });
    return { vw, items: items.join(" "), coins: document.getElementById("cointext").offsetParent ? getComputedStyle(document.getElementById("cointext")).display : "hidden", scrollW: document.documentElement.scrollWidth };
  });
  await page.screenshot({ path: `${OUT}header-${name}.png`, clip: { x: 0, y: 0, width: header.vw, height: 70 } });
  await tap(".dropbtn");
  const menuOpen = await visible(".dropdown-content");
  await page.screenshot({ path: `${OUT}menu-${name}.png` });
  await tap(".dropbtn");
  const menuClosedAgain = !(await visible(".dropdown-content"));
  await tap(".dropbtn");
  await tap(".faq-header");
  const closedByOutside = !(await visible(".dropdown-content"));
  await tap(".playerbtn");
  const cardOpen = await visible(".playercard-content");
  await page.screenshot({ path: `${OUT}card-${name}.png` });
  await tap(".faq-header");
  const cardClosed = !(await visible(".playercard-content"));
  console.log(name, JSON.stringify(header), JSON.stringify({ menuOpen, menuClosedAgain, closedByOutside, cardOpen, cardClosed }));
  await context.close();
}
await browser.close();
