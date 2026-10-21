// Local stand-in for the production server.js, which is not in this repository.
// The endpoints are inferred from the client code; nothing here talks to MySQL or sends email.
//
// It serves static/ by default. SITE_DIR=build serves the SvelteKit build instead,
// the way production would.
//
// images/ and fonts/ are gitignored, so missing files are fetched once from the live site
// and cached on disk. Only those read-only assets are proxied; no write endpoint ever is.
const fs = require("fs");
const http = require("http");
const path = require("path");
const express = require("express");

const ROOT = path.resolve(__dirname, "..", process.env.SITE_DIR || "static");
const ASSET_DIR = path.resolve(__dirname, "..", "static");
const ASSET_ORIGIN = "https://pokemath.online";
const PORT = Number(process.env.PORT) || 3000;

function log(kind, ...parts) {
  console.log(`[${new Date().toLocaleTimeString("no-NO")}] ${kind.padEnd(7)}`, ...parts);
}

const app = express();
app.use(express.json({ limit: "2mb" }));

require("./core").register(app, log);
require("./teacher").register(app, log);
const bingo = require("./bingo");
bingo.register(app, log);

// Fetch a missing image or font from the live site and cache it in static/, which is gitignored there.
app.get(/^\/(images|fonts)\/.+/, async (req, res) => {
  const rel = decodeURIComponent(req.path).replace(/^\/+/, "");
  const file = path.join(ASSET_DIR, rel);
  if (!file.startsWith(ASSET_DIR + path.sep)) return res.status(400).end();
  if (fs.existsSync(file)) return res.sendFile(file);
  try {
    const upstream = await fetch(ASSET_ORIGIN + req.path);
    if (!upstream.ok) return res.status(upstream.status).end();
    const body = Buffer.from(await upstream.arrayBuffer());
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
    log("asset", rel);
    res.sendFile(file);
  } catch (err) {
    log("asset", `FAILED ${rel}: ${err.message}`);
    res.status(502).end();
  }
});

app.use(express.static(ROOT, { dotfiles: "ignore" }));
app.use((req, res) => res.status(404).sendFile(path.join(ROOT, "notfound.html")));

const server = http.createServer(app);
bingo.attach(server, log);
server.listen(PORT, () => log("ready", `http://localhost:${PORT}`));
