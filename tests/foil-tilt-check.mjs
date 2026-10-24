// The shiny foil following the card: scrolling it up the screen by default, a mouse across it on
// desktop, a finger dragged across a bingo prize, the tilt (faked deviceorientation events) only
// once switched on in the profile, Safari's question asked by that switch, a bingo prize drifting
// as before, Safari asked again by the first tap after the page is reopened, and the foil left
// alone under reduced motion. The foiled cards are the game page's recent catches.
// Usage: node foil-tilt-check.mjs [base] [outdir]. tests/foil-tilt-serve-check.sh builds this
// checkout and serves it on :3126.
import { createRequire } from "module";
import { muteAudio } from './mute.mjs';
const require = createRequire(import.meta.url);
const fs = require("fs");
const { webkit, devices } = require("playwright-core");
const BASE = process.argv[2] || "http://localhost:3126";
const OUT = (process.argv[3] || new URL("./design/foil-tilt/", import.meta.url).pathname).replace(/\/?$/, "/");
fs.mkdirSync(OUT, { recursive: true });
// Enough Pokémon ahead of the shiny that the Pokédex scrolls it up the screen.
const SAVE = {
  username: "Kari", money: "123456",
  pokemonlist: [...Array.from({ length: 40 }, (_, i) => `N${i + 1}`), "S150", "N150", "S6", "S25"].join("|"),
  backupReminder: new Date(Date.now() + 9e9).toISOString(), storageNoticeSeen: "true",
  uuid: "00000000-0000-4000-8000-00000000f012",
};
// The server's answer to the game page's prize claim: one shiny from a bingo.
const PRIZES = { ok: true, prizes: [{ id: "tilt-1", type: "pokemon", pokedexId: 150, entry: "S150", shiny: true, source: "bingo" }] };
const CARD = '[id="S150"]';
let failures = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) failures++; };
const shift = (page, sel) => page.locator(sel).first().evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);
const drifting = (page, sel) => page.locator(sel).first().evaluate((el) => el.getAnimations().some((a) => /sweep/.test(a.animationName)));
// A burst of events, as a held device sends them about 60 times a second: the tilt is smoothed.
const tiltTo = (page, beta, gamma) => page.evaluate(([beta, gamma]) => {
  for (let i = 0; i < 30; i++) {
    const e = new Event("deviceorientation");
    Object.defineProperties(e, { beta: { value: beta }, gamma: { value: gamma }, alpha: { value: 0 } });
    window.dispatchEvent(e);
  }
}, [beta, gamma]);
// Tilt from rest to the left, then to the right; returns how far the glare moved between them,
// either way: headless WebKit calls a portrait iPad turned, so side to side may land on either axis.
const offset = (page, sel) => page.locator(sel).first().evaluate((el) => { const m = new DOMMatrix(getComputedStyle(el).transform); return [m.m41, m.m42]; });
const tiltLeftRight = async (page) => {
  await tiltTo(page, 40, 0);
  await tiltTo(page, 40, -15); await page.waitForTimeout(300);
  const a = await offset(page, `${CARD} .glare`);
  await tiltTo(page, 40, 15); await page.waitForTimeout(300);
  const b = await offset(page, `${CARD} .glare`);
  return [0, Math.hypot(b[0] - a[0], b[1] - a[1])];
};
// Safari's question, faked: answers `answer` and counts how often it was asked.
const fakeSafari = (context, answer) => context.addInitScript((answer) => {
  window.DeviceOrientationEvent ??= class extends Event {};
  DeviceOrientationEvent.requestPermission = () => { sessionStorage.asked = (+sessionStorage.asked || 0) + 1; return Promise.resolve(answer); };
}, answer);
const open = async (device, motion, extra = {}) => {
  const context = await browser.newContext({ ...device, reducedMotion: motion, serviceWorkers: "block" });
  await context.addCookies([{ name: "cookies", value: "true", url: BASE }]);
  await context.addInitScript((s) => Object.entries(s).forEach(([k, v]) => localStorage.getItem(k) === null && localStorage.setItem(k, v)), { ...SAVE, ...extra });
  return context;
};
const openPrize = async (page) => {
  await page.route("**/bingo/claim-prizes**", (route) => route.request().method() === "GET"
    ? route.fulfill({ json: PRIZES }) : route.fulfill({ json: { ok: true } }));
  await page.goto(BASE + "/pokemath.html?stage=2");
  await page.locator("#bingo-lootbox-overlay").click();
  await page.waitForSelector(".foil-frame .foil");
  await page.waitForTimeout(500);
};

const browser = muteAudio(await webkit.launch());

// iPhone, by default: scrolling moves the foil; the tilt does nothing until switched on.
{
  const context = await open(devices["iPhone 13"], "no-preference");
  const page = await context.newPage();
  await page.goto(BASE + "/pokemath.html");
  await page.waitForSelector(`${CARD} .foil`);
  const supported = await page.evaluate(() => CSS.supports("animation-timeline: view()"));
  console.log("     this WebKit ties animations to scrolling:", supported);
  check(await page.locator(`${CARD} .foil.scrolls`).count() === (supported ? 1 : 0), "iphone: foil follows scrolling where the browser can");
  // Safari on a real iPhone lets the blended layers out past overflow: hidden; headless WebKit
  // does not, so this checks the clip that keeps them in, not the corners themselves.
  const clip = await page.locator(`${CARD} .art`).evaluate((el) => getComputedStyle(el).clipPath);
  check(/round 12px/.test(clip), `iphone: the window is clipped to its rounded corners (${clip})`);
  if (supported) {
    const card = page.locator(CARD);
    await card.evaluate((el) => el.scrollIntoView({ block: "end" })); await page.waitForTimeout(300);
    const low = await shift(page, `${CARD} .foil`);
    await card.screenshot({ path: `${OUT}scroll-low.png` });
    await card.evaluate((el) => el.scrollIntoView({ block: "start" })); await page.waitForTimeout(300);
    const high = await shift(page, `${CARD} .foil`);
    await card.screenshot({ path: `${OUT}scroll-high.png` });
    console.log("     foil shift with the card low on the screen", Math.round(low), "high", Math.round(high));
    check(Math.abs(high - low) > 20, "iphone: scrolling the card up moves its foil");
  }
  const [a, b] = await tiltLeftRight(page);
  check(b === 0 && await page.evaluate(() => !("tilt" in document.documentElement.dataset)), "iphone: tilt does nothing while switched off");
  await context.close();
}

// Desktop: the mouse moves the foil and glare opposite ways, and scrolling takes over once it leaves.
{
  const context = await open({ viewport: { width: 1280, height: 900 } }, "no-preference");
  const page = await context.newPage();
  await page.goto(BASE + "/pokemath.html");
  await page.waitForSelector(`${CARD} .foil`);
  const art = page.locator(`${CARD} .art`);
  await art.scrollIntoViewIfNeeded();
  const box = await art.boundingBox();
  await page.mouse.move(box.x + 4, box.y + box.height / 2);
  await page.waitForTimeout(300);
  const left = [await shift(page, `${CARD} .foil`), await shift(page, `${CARD} .glare`)];
  await art.screenshot({ path: `${OUT}mouse-left.png` });
  await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2, { steps: 5 });
  await page.waitForTimeout(300);
  const right = [await shift(page, `${CARD} .foil`), await shift(page, `${CARD} .glare`)];
  await art.screenshot({ path: `${OUT}mouse-right.png` });
  console.log("     mouse left", left.map(Math.round), "right", right.map(Math.round));
  check(left[0] < 0 && right[0] > 0, "desktop: foil follows the mouse");
  check(left[1] > 0 && right[1] < 0, "desktop: glare slides against it");
  await page.mouse.move(5, 5);
  check(await page.locator(`${CARD} .foil.live`).count() === 0, "desktop: the mouse lets go once it leaves");
  await context.close();
}

// iPad, switched on in the profile: Safari is asked by the switch, then the tilt moves the foil.
for (const [name, device] of [["ipad", devices["iPad (gen 7)"]], ["ipad-landscape", devices["iPad (gen 7) landscape"]]]) {
  const context = await open(device, "no-preference");
  await fakeSafari(context, "granted");
  const page = await context.newPage();
  await page.goto(BASE + "/player_profile.html");
  const toggle = page.locator("#tiltSwitch");
  await toggle.waitFor({ state: "attached", timeout: 5000 }).catch(() => {});
  check(await toggle.count() === 1 && !(await toggle.isChecked()), `${name}: the profile shows the tilt switch, off`);
  await page.locator('label[for="tiltSwitch"]').click(); await page.waitForTimeout(300);
  check(await toggle.isChecked() && await page.evaluate(() => localStorage.foilTilt === "on" && sessionStorage.asked === "1"), `${name}: switching it on asks Safari once and keeps it on`);
  await page.locator("#tiltSwitch").screenshot({ path: `${OUT}${name}-switch.png` });
  await page.locator("section", { has: page.locator("#tiltSwitch") }).screenshot({ path: `${OUT}${name}-panel.png` });
  await page.goto(BASE + "/pokemath.html");
  await page.waitForSelector(`${CARD} .foil`);
  const [a, b] = await tiltLeftRight(page);
  console.log(`     ${name} foil shift`, Math.round(a), "→", Math.round(b));
  check(Math.abs(b - a) > 20, `${name}: foil follows the tilt`);
  check(await page.evaluate(() => sessionStorage.asked) === "1", `${name}: the game page does not ask again`);
  // Opened again, Safari has forgotten the answer and sends nothing: the next tap anywhere asks.
  await page.reload();
  await page.waitForSelector(`${CARD} .foil`);
  await page.waitForTimeout(300);
  await page.locator("h2", { hasText: "Siste fangster" }).click();
  await page.waitForTimeout(300);
  check(await page.evaluate(() => sessionStorage.asked) === "2", `${name}: a tap after reopening asks Safari again (${await page.evaluate(() => sessionStorage.asked)})`);
  await page.locator("h2", { hasText: "Siste fangster" }).click();
  await page.waitForTimeout(300);
  check(await page.evaluate(() => sessionStorage.asked) === "2", `${name}: and only once, while the tilt is coming`);
  await context.close();
}

// iPad, Safari's question declined: the switch stays off and says why.
{
  const context = await open(devices["iPad (gen 7)"], "no-preference");
  await fakeSafari(context, "denied");
  const page = await context.newPage();
  await page.goto(BASE + "/player_profile.html");
  await page.locator('label[for="tiltSwitch"]').click(); await page.waitForTimeout(300);
  check(!(await page.locator("#tiltSwitch").isChecked()) && await page.evaluate(() => !localStorage.foilTilt), "ipad: a declined question leaves the switch off");
  check(await page.getByText("Fikk ikke lov").count() > 0, "ipad: and says so");
  await context.close();
}

// Desktop: no tilt switch, as there is nothing to tilt.
{
  const context = await open({ viewport: { width: 1280, height: 900 } }, "no-preference");
  const page = await context.newPage();
  await page.goto(BASE + "/player_profile.html");
  await page.waitForSelector(".uuid-card");
  check(await page.locator("#tiltSwitch").count() === 0, "desktop: no tilt switch in the profile");
  await context.close();
}

// iPad, a shiny bingo prize: it sits in a fixed overlay, so it drifts, and a finger drags its foil.
{
  const context = await open(devices["iPad (gen 7)"], "no-preference");
  const page = await context.newPage();
  await openPrize(page);
  check(await page.locator(".foil-frame .foil.scrolls").count() === 0 && await drifting(page, ".foil-frame .foil"), "prize: foil drifts in the fixed overlay");
  const frame = await page.locator(".foil-frame").boundingBox();
  const at = { x: frame.x + 10, y: frame.y + frame.height / 2 };
  await page.locator(".foil-frame").dispatchEvent("pointermove", { pointerType: "touch", clientX: at.x, clientY: at.y, bubbles: true });
  await page.waitForTimeout(300);
  const left = await shift(page, ".foil-frame .foil");
  await page.locator(".foil-frame").dispatchEvent("pointermove", { pointerType: "touch", clientX: frame.x + frame.width - 10, clientY: at.y, bubbles: true });
  await page.waitForTimeout(300);
  const right = await shift(page, ".foil-frame .foil");
  console.log("     prize finger left", Math.round(left), "right", Math.round(right));
  check(left < 0 && right > 0, "prize: a finger dragged across moves the foil");
  await context.close();
}

// Reduced motion: neither scrolling, mouse nor tilt moves the foil.
{
  const context = await open(devices["iPad (gen 7)"], "reduce", { foilTilt: "on" });
  const page = await context.newPage();
  await page.goto(BASE + "/pokemath.html");
  await page.waitForSelector(`${CARD} .foil`);
  const still = () => page.locator(`${CARD} .bands`).evaluate((el) => getComputedStyle(el).transform + " " + el.getAnimations().length);
  const before = await still();
  await tiltTo(page, 40, 0); await tiltTo(page, 40, 15); await page.waitForTimeout(300);
  await page.locator(`${CARD} .art`).hover().catch(() => {});
  const after = await still();
  check(before === after && before.endsWith(" 0"), `reduce: the foil stays still (${after})`);
  await context.close();
}

await browser.close();
console.log(failures ? `${failures} failed` : "all ok", "· shots in", OUT);
process.exit(failures ? 1 : 0);
