// Scenarios for pr4-parity.mjs: Pokédex, Pokémon viewer, shop, customizer and redeem.
const click = (selector) => (page) => page.evaluate((s) => document.querySelector(s).click(), selector);
const clickText = (selector, text) => (page) =>
  page.evaluate(([s, t]) => [...document.querySelectorAll(s)].find((el) => el.textContent.trim() === t).click(), [selector, text]);
const header = (page) => page.evaluate(() => ({
  money: document.getElementById("cointext")?.dataset.total,
  caught: document.getElementById("balltext")?.textContent.trim(),
}));

// ── Pokédex ────────────────────────────────────────────────────────────────
const dexList = [];
for (let i = 1; i <= 160; i++) dexList.push(`N${i}`);
dexList.push("N25", "N25", "N4", "S6", "S150", "N150", "N151", "S151", "N6-1", "N6-2", "S6-1", "N52-2", "N77-1",
  "N1-H1", "N25-C1", "N0-U1", "N43-E1", "N25-S1", "N3-1", "N999999", "N700", "N813", "N906");
const scrollAll = async (page) => {
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(150);
  }
};
const dexSnap = async (page) => {
  await scrollAll(page);
  return page.evaluate(() => ({
    cards: [...document.querySelectorAll("#pokedex > a")].map((a) => a.id + a.querySelector(".card-counter").textContent).join(" "),
    status: [document.getElementById("dexLoadStatus").textContent.trim(), document.getElementById("dexLoadStatus").style.opacity],
    counts: ["amountCaught", "amountCaught2", "amountCaught3"].map((id) => document.getElementById(id).textContent),
    buttons: [...document.querySelectorAll("#filterButtons .btn")].map((b) => b.textContent.trim() + ":" + ["active", "filter-include", "filter-exclude"].filter((c) => b.classList.contains(c)).join("+")).join(" "),
    types: [...document.querySelectorAll(".typecard2.active")].map((t) => t.dataset.filter).join(","),
    gens: [...document.querySelectorAll(".genCheckbox")].map((c) => (c.checked ? 1 : 0)).join(""),
    panels: ["typecontent", "generationContent", "sortContent"].map((id) => document.getElementById(id).style.display).join(","),
    bars: [...document.querySelectorAll(".dex-pbar-text")].map((t) => t.textContent.replace(/\s+/g, " ").trim()).join(" | "),
    collapsed: document.getElementById("dexProgressBars").classList.contains("collapsed"),
  }));
};
const search = (q) => async (page) => {
  await page.locator("#searchInput").fill(q);
};

// ── Pokémon viewer ─────────────────────────────────────────────────────────
const viewerSnap = (page) => page.evaluate(() => {
  const text = (id) => (document.getElementById(id)?.innerText ?? "").replace(/\s+/g, " ").trim();
  const imgs = (id) => [...(document.getElementById(id)?.querySelectorAll("img") ?? [])].map((i) => i.getAttribute("src").replace(/^\//, "") + "|" + i.style.filter).join(" ");
  const bg = (id) => { const el = document.getElementById(id); return el.style.backgroundImage.replace(/"/g, "") + "|" + el.style.filter; };
  return {
    main: text("main-pokemon-wrapper"), mainImgs: imgs("main-pokemon-wrapper"),
    prev: text("prev-evolution-wrapper"), prevImgs: imgs("prev-evolution-wrapper"),
    next: text("next-evolution-wrapper"), nextImgs: imgs("next-evolution-wrapper"),
    alt: text("alternate-forms-wrapper"), altImgs: imgs("alternate-forms-wrapper"),
    altDisplay: document.getElementById("alternate-forms-wrapper").style.display,
    buttons: [bg("prevButtonBG"), bg("nextButtonBG")],
    search: document.getElementById("searchBar").value,
  };
});

// ── Shop ───────────────────────────────────────────────────────────────────
const shopSnap = async (page) => ({
  ...(await header(page)),
  ...(await page.evaluate(() => {
    const cls = (el) => (el ? (el.classList.contains("disabled") ? "off" : "on") : "-");
    return {
      upgrades: [...document.querySelectorAll(".shopObject")].map((o) => [o.id, o.querySelector(".levelIndicator")?.dataset.level, o.querySelector(".pricetag")?.dataset.price, cls(o.querySelector(".shopButton")), o.querySelector(".shinyBaitStock")?.textContent].join(":")).join(" "),
      backgrounds: [...document.querySelectorAll(".carousel-caption")].map((c) => c.id + cls(c.querySelector(".buy")) + cls(c.querySelector(".use"))).join(" "),
      carousel: document.querySelector(".carousel-track").style.transform,
      icons: [...document.querySelectorAll(".icon-grid")].map((g) => g.id + "=" + [...g.querySelectorAll(".icon-card")].map((c) => c.id + cls(c.querySelector(".buy")) + cls(c.querySelector(".use"))).join(",")).join(" "),
      exclusive: getComputedStyle(document.getElementById("exclusiveIconSection") ?? document.body).display === "none" || !document.getElementById("exclusiveIconSection") ? "hidden" : "shown",
      background: document.getElementById("background")?.getAttribute("src") ?? "",
      player: document.getElementById("playerimage")?.getAttribute("src"),
    };
  })),
});

// ── Customizer ─────────────────────────────────────────────────────────────
const customizerSnap = (page) => page.evaluate(() => ({
  sections: ["addSection", "subSection", "mulSection", "divSection"].map((id) => document.getElementById(id).style.display).join(","),
  checks: ["additioncheck", "subtractioncheck", "multiplicationcheck", "divisioncheck", "subtractionallownegative"].map((id) => (document.getElementById(id).checked ? 1 : 0)).join(""),
  values: [...document.querySelectorAll(".customizerform input[type=number]")].map((i) => i.id + "=" + i.value).join(" "),
  presets: [...document.querySelectorAll("[id^=presetCard-]")].map((c) => c.querySelector(".card-title").textContent.trim() + ":" + ["save-btn", "load-btn", "del-btn"].map((b) => (c.querySelector("." + b).classList.contains("disabled") ? 0 : 1)).join("")).join(" "),
  qr: [document.getElementById("barcode").getAttribute("src"), document.getElementById("barcode").style.display],
}));
const fill = (id, value) => (page) => page.locator("#" + id).fill(value);

// ── Redeem ─────────────────────────────────────────────────────────────────
const redeemSnap = async (page) => ({
  ...(await header(page)),
  ...(await page.evaluate(() => ({
    response: document.getElementById("response").textContent,
    input: document.getElementById("secretCodeInput").value,
    notes: [...document.querySelectorAll("#notification-container .notification")].map((n) => n.querySelector("p").textContent + "|" + n.querySelector("img").getAttribute("src").replace(/^\//, "")).join(" / "),
    fireworks: document.querySelectorAll(".firework").length,
  }))),
});
const redeem = (code) => async (page) => {
  await page.locator("#secretCodeInput").fill(code);
  await page.locator("#secretCodeInput").press("Enter");
  await page.waitForTimeout(400);
};

export default [
  {
    name: "pokedex: filters, search, sort",
    legacy: "/dex-legacy.html", svelte: "/dex.html",
    save: { pokemonlist: dexList.join("|"), money: "10" },
    snap: dexSnap,
    actions: [
      ["shiny include", clickText("#filterButtons .btn", "Shiny")],
      ["shiny exclude", clickText("#filterButtons .btn", "Shiny")],
      ["shiny off", clickText("#filterButtons .btn", "Shiny")],
      ["legendary", clickText("#filterButtons .btn", "Legendarisk")],
      ["mythic too", clickText("#filterButtons .btn", "Mytisk")],
      ["show all", clickText("#filterButtons .btn", "Vis alle")],
      ["mega", clickText("#filterButtons .btn", "Mega")],
      ["show all", clickText("#filterButtons .btn", "Vis alle")],
      ["halloween", clickText("#filterButtons .btn", "Halloween")],
      ["show all", clickText("#filterButtons .btn", "Vis alle")],
      ["duplicates only", click("#duplicatesBtn")],
      ["no duplicates", click("#duplicatesBtn")],
      ["duplicates off", click("#duplicatesBtn")],
      ["open types", click("#typeDropdownBtn")],
      ["type fire", click('.typecard2[data-filter="fire"]')],
      ["open types again", click("#typeDropdownBtn")],
      ["type flying too", click('.typecard2[data-filter="flying"]')],
      ["show all", clickText("#filterButtons .btn", "Vis alle")],
      ["open gens", click("#generationDropdown")],
      ["gen 1 off", (page) => page.locator('.genCheckbox[value="gen-1"]').uncheck()],
      ["gen 2 off", (page) => page.locator('.genCheckbox[value="gen-2"]').uncheck()],
      ["close panels", click("h1, #pokedex")],
      ["search char", search("char")],
      ["search fire", search("fire")],
      ["search #25", search("#25")],
      ["search missing", search("missing")],
      ["clear search", search("")],
      ["show all", clickText("#filterButtons .btn", "Vis alle")],
      ["sort id desc", async (page) => { await click("#sortDropdownBtn")(page); await click('#sortContent a[data-sort="id-desc"]')(page); }],
      ["sort name", async (page) => { await click("#sortDropdownBtn")(page); await click('#sortContent a[data-sort="name-asc"]')(page); }],
      ["sort count", async (page) => { await click("#sortDropdownBtn")(page); await click('#sortContent a[data-sort="count-desc"]')(page); }],
      ["collapse bars", click("#progressToggleBtn")],
    ],
  },
  {
    name: "viewer: browse, shiny, evolutions, forms",
    legacy: "/pokeviewer-legacy.html", svelte: "/pokeviewer.html", query: "?pokemonId=5",
    save: { pokemonlist: "N4|N5|S6|N6-1|N133|N134|N1010|N1|N862", money: "10" },
    snap: viewerSnap,
    actions: [
      ["next", click("#nextButton")],
      ["shiny on", click("#shinycheck")],
      ["next", click("#nextButton")],
      ["shiny off", click("#shinycheck")],
      ["search eevee", async (page) => { await page.locator("#searchBar").fill("eevee"); await click("#searchButton")(page); }],
      ["search 1", async (page) => { await page.locator("#searchBar").fill("1"); await page.locator("#searchBar").press("Enter"); }],
      ["prev from 1", click("#prevButton")],
      ["prev from 0", click("#prevButton")],
      ["search 862", async (page) => { await page.locator("#searchBar").fill("862"); await click("#searchButton")(page); }],
      ["search 52", async (page) => { await page.locator("#searchBar").fill("52"); await click("#searchButton")(page); }],
      ["search nonsense", async (page) => { await page.locator("#searchBar").fill("zzz"); await click("#searchButton")(page); }],
    ],
  },
  {
    name: "shop: buy, use, upgrade, stardust",
    legacy: "/shop-legacy.html", svelte: "/shop.html",
    save: { money: "300000", pokemonlist: "N1", boughtPlayerIcons: "poke_morten", shinyLevel: "3", coinLevel: "49" },
    snap: shopSnap,
    actions: [
      ["carousel next", click(".carousel-btn:last-of-type")],
      ["carousel back twice", async (page) => { await click(".carousel-btn")(page); await click(".carousel-btn")(page); }],
      ["buy bg-004", click("#bg-004 .buy")],
      ["buy bg-004 again", click("#bg-004 .buy")],
      ["use bg-004", click("#bg-004 .use")],
      ["use bg-004 again", click("#bg-004 .use")],
      ["use bg-005 not owned", click("#bg-005 .use")],
      ["remove background", click(".button-1.use.centerposition")],
      ["remove again", click(".button-1.use.centerposition")],
      ["buy bg-019 too dear", click("#bg-019 .buy")],
      ["buy flannery", click("#flannery .buy")],
      ["use flannery", click("#flannery .use")],
      ["use player (free, not owned)", click("#player .use")],
      ["buy exclusive", click("#poke_morten .buy")],
      ["use exclusive", click("#poke_morten .use")],
      ["upgrade shiny", click("#shinyShop .shopButton")],
      ["upgrade shiny", click("#shinyShop .shopButton")],
      ["upgrade legend", click("#legendShop .shopButton")],
      ["upgrade mythic", click("#mythicShop .shopButton")],
      ["upgrade coin 49→50", click("#coinShop .shopButton")],
      ["upgrade coin 50→51", click("#coinShop .shopButton")],
      ["stardust", click("#shinyBaitShop .shopButton")],
      ["stardust", click("#shinyBaitShop .shopButton")],
    ],
  },
  {
    name: "shop: max level and broke",
    legacy: "/shop-legacy.html", svelte: "/shop.html",
    save: { money: "50", legendLevel: "15" },
    snap: shopSnap,
    actions: [
      ["legend at max", click("#legendShop .shopButton")],
      ["shiny broke", click("#shinyShop .shopButton")],
      ["stardust broke", click("#shinyBaitShop .shopButton")],
    ],
  },
  {
    name: "customizer: options, link, presets",
    legacy: "/customizer-legacy.html", svelte: "/customizer.html",
    save: { customPreset3: JSON.stringify("Gammel|/pokemath.html?custom=true&sub=t&smin=5&smax=50&sminb=1&smaxb=9&sdec=1&san=f") },
    promptAnswer: "  Min|test med et veldig langt navn  ",
    snap: customizerSnap,
    actions: [
      ["addition on", click("#additioncheck")],
      ["set addition", async (page) => { await fill("addMinSel", "5")(page); await fill("addMaxSel", "250")(page); await fill("addDecSel", "1")(page); }],
      ["subtraction on", click("#subtractioncheck")],
      ["allow negative", click("#subtractionallownegative")],
      ["multiplication on", click("#multiplicationcheck")],
      ["mul decimals", fill("mulDecSel", "2")],
      ["division on", click("#divisioncheck")],
      ["division off", click("#divisioncheck")],
      ["qr code", click("#qrcreate")],
      ["save preset 1", (page) => page.evaluate(() => document.querySelector("#presetCard-1 .save-btn").click())],
      ["load preset 3", (page) => page.evaluate(() => document.querySelector("#presetCard-3 .load-btn").click())],
      ["load preset 1", (page) => page.evaluate(() => document.querySelector("#presetCard-1 .load-btn").click())],
      ["delete preset 3", (page) => page.evaluate(() => document.querySelector("#presetCard-3 .del-btn").click())],
      ["load empty preset 2", (page) => page.evaluate(() => document.querySelector("#presetCard-2 .load-btn").click())],
      ["play", async (page) => { await click("#useform")(page); await page.waitForURL("**/pokemath.html*"); }],
    ],
    snapOverride: true,
  },
  {
    name: "redeem: every prize type",
    legacy: "/redeem-legacy.html", svelte: "/redeem.html",
    seed: 4242,
    save: { money: "100", pokemonlist: "N1", boughtBackgrounds: "bg-001" },
    snap: redeemSnap,
    actions: [
      ["empty", redeem("")],
      ["unknown", redeem("tull")],
      ["coins", redeem("mynter")],
      ["coins again", redeem("MYNTER")],
      ["pokemon", redeem("pikachu")],
      ["random shiny", redeem("shiny")],
      ["random legendary", redeem("legendarisk")],
      ["stardust", redeem("stjernestøv")],
      ["background", redeem("bakgrunn")],
      ["character", redeem("figur")],
      ["fireworks", redeem("fyrverkeri")],
      ["message", redeem("melding")],
      ["random mythic", redeem("mytisk")],
      ["random shiny mythic", redeem("shinymyt")],
      ["button instead of enter", async (page) => { await page.locator("#secretCodeInput").fill("tull2"); await page.locator("#redemptionForm button").click(); await page.waitForTimeout(400); }],
    ],
  },
];
