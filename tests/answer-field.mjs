// The answer field on a phone: comma decimals, the +/- button, junk input, and focus kept on taps.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { webkit, devices } = require("playwright-core");
const BASE = "http://localhost:3123";
const browser = await webkit.launch();
const context = await browser.newContext({ ...devices["iPhone 13"] });
await context.addCookies([{ name: "cookies", value: "true", url: BASE }]);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const solve = async () => {
  const [a, op, b] = (await page.locator(".problem").textContent()).trim().split(" ");
  const n = [Number(a), Number(b)];
  return op === "+" ? n[0] + n[1] : op === "-" ? n[0] - n[1] : op === "x" ? n[0] * n[1] : n[0] / n[1];
};
const status = () => page.locator(".points-needed").textContent();

// Addition with one decimal: answer with a comma, as the Norwegian keypad types it.
await page.goto(BASE + "/pokemath.html?custom=true&add=t&amin=0&amax=50&aminb=0&amaxb=50&adec=1");
await page.waitForTimeout(1200);
const before = await status();
const correct = Number((await solve()).toFixed(1));
await page.locator(".our-field").tap();
await page.keyboard.type(String(correct).replace(".", ","));
const typed = await page.locator(".our-field").inputValue();
await page.locator(".answer-button").tap();
await page.waitForTimeout(300);
console.log(`comma answer: typed "${typed}" for ${correct}; points needed ${before} -> ${await status()}; field focused: ${await page.evaluate(() => document.activeElement?.classList.contains("our-field"))}`);

// Junk is filtered; +/- toggles the sign and keeps focus.
await page.locator(".our-field").tap();
await page.keyboard.type("1a2.3.4-5");
const filtered = await page.locator(".our-field").inputValue();
await page.locator(".flip-btn").tap();
const flipped = await page.locator(".our-field").inputValue();
const focusedAfterFlip = await page.evaluate(() => document.activeElement?.classList.contains("our-field"));
await page.locator(".flip-btn").tap();
console.log(`filtered "1a2.3.4-5" to "${filtered}"; +/- gives "${flipped}" then "${await page.locator(".our-field").inputValue()}"; focus kept: ${focusedAfterFlip}`);

// A lone minus counts as empty, as with the old number field.
await page.locator(".our-field").fill("-");
const needed = await status();
await page.locator(".answer-button").tap();
console.log(`lone "-": points needed unchanged ${needed} -> ${await status()}, mistakes left ${await page.locator(".mistakes-allowed").textContent()}`);

// Negative subtraction answers, which need the +/- button on the decimal keypad.
await page.goto(BASE + "/pokemath.html?custom=true&sub=t&smin=0&smax=5&sminb=20&smaxb=30&sdec=0");
await page.waitForTimeout(1200);
const negative = await solve();
await page.locator(".our-field").tap();
await page.keyboard.type(String(Math.abs(negative)));
if (negative < 0) await page.locator(".flip-btn").tap();
await page.locator(".answer-button").tap();
await page.waitForTimeout(300);
console.log(`negative answer ${negative}: points needed now ${await status()}`);

const box = await page.evaluate(() => ({
  field: Math.round(document.querySelector(".our-field").getBoundingClientRect().height) + "px tall, font " + getComputedStyle(document.querySelector(".our-field")).fontSize,
  scroll: document.documentElement.scrollWidth + " / " + document.documentElement.clientWidth,
  inputmode: document.querySelector(".our-field").inputMode,
}));
console.log("layout:", JSON.stringify(box));
console.log("errors:", errors.length ? errors : "none");
await browser.close();
