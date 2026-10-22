// Open two pages with the same seeded save and diff what each leaves in localStorage.
// Usage: node load-diff.mjs <base> <pathA> <pathB>
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { webkit, devices } = require("playwright-core");
const [BASE, A, B] = process.argv.slice(2);

const saves = {
  fresh: {},
  messy: {
    username: '"Kari"',
    money: "1234",
    pokemonlist: JSON.stringify("N25|N1|S4|N7-1"),
    boughtPlayerIcons: '"roxanne"|"brawly"',
    playerIcon: '"roxanne"',
    shopBackground: '"bg-002"',
    tier2Solved: "7",
    badges: JSON.stringify({ version: "1.0", badges: [{ id: 1, name: "x", description: "y", achieved: false, progress: 3, goal: 250 }] }),
  },
};

async function dump(path, save) {
  const browser = await webkit.launch();
  const context = await browser.newContext({ ...devices["iPad (gen 7)"] });
  await context.addCookies([{ name: "cookies", value: "true", url: BASE }]);
  await context.addInitScript((s) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, save);
  const page = await context.newPage();
  await page.goto(BASE + path);
  await page.waitForTimeout(1500);
  const out = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  await browser.close();
  return out;
}

for (const [name, save] of Object.entries(saves)) {
  const a = await dump(A, save);
  const b = await dump(B, save);
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  const diffs = keys.filter((k) => a[k] !== b[k]);
  console.log(`[${name}] ${keys.length} keys, ${diffs.length} differ`);
  for (const k of diffs) console.log(`  ${k}\n    ${A}: ${JSON.stringify(a[k])?.slice(0, 160)}\n    ${B}: ${JSON.stringify(b[k])?.slice(0, 160)}`);
}
