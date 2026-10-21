// Player endpoints: UUID validation, stats upload, redeem codes, easter event, tracking.
// Everything is held in memory and lost when the server stops.
const crypto = require("crypto");

const users = new Map(); // uuid -> { token, stats }
const easter = { total: 0, milestones: [] };

// Codes that can be redeemed on redeem.html during local development.
const redeemCodes = {
  MYNTER: { type: "coins", value: 500, label: "500 mynter!" },
  SHINY: { type: "random_shiny", label: "En tilfeldig shiny!" },
  LEGENDARISK: { type: "random_legendary", label: "En legendarisk Pokémon!" },
  STJERNESTØV: { type: "stardust", value: 3, label: "3 stjernestøv!" },
  PIKACHU: { type: "pokemon", value: "N25", label: "Pikachu!" },
};

function register(app, log) {
  app.get("/validate-user", (req, res) => {
    const { uuid, token } = req.query;
    if (!uuid) return res.status(400).json({ error: "uuid mangler" });
    const user = users.get(uuid);
    if (!user) {
      const newToken = crypto.randomBytes(16).toString("hex");
      users.set(uuid, { token: newToken, stats: null });
      return res.json({ unique: true, valid: true, token: newToken });
    }
    // The live client (global.js, 2026-10) starts over with a new id when the server answers
    // reassign: the id is someone else's. When the real server sends it is not in the client
    // code; here it is any known id with the wrong token. Unverified against production.
    if (user.token !== token) return res.json({ unique: false, valid: false, reassign: true });
    res.json({ unique: false, valid: true });
  });

  app.post("/update-user-stats", (req, res) => {
    const { uuid, token, state, shopOptions } = req.body || {};
    const user = users.get(uuid);
    if (!user || user.token !== token) return res.status(401).json({ error: "Ugyldig token" });
    user.stats = { state, shopOptions, updatedAt: Date.now() };
    log("stats", uuid, `${state?.username} poeng=${state?.totalScore} fanget=${state?.pkmnCaught}`);
    res.json({ success: true });
  });

  app.post("/redeem", (req, res) => {
    const code = String(req.body?.code || "").trim().toUpperCase();
    const prize = redeemCodes[code];
    if (!prize) return res.json({ ok: false, message: "Ugyldig kode!" });
    res.json({ ok: true, prize });
  });

  app.get("/api/easter/global", (req, res) => res.json(easter));
  app.post("/api/easter/catch", (req, res) => {
    easter.total += 1;
    const segment = Math.floor(easter.total / 250_000);
    if (easter.total % 250_000 === 0 && !easter.milestones.some((m) => m.segment === segment)) {
      easter.milestones.push({ segment, reached_at: new Date().toISOString() });
    }
    res.json({ ok: true, total: easter.total });
  });

  // Fire-and-forget: the client never reads the response.
  for (const path of ["/math-ping", "/track-page", "/track-stage", "/track-catch"]) {
    app.post(path, (req, res) => {
      log("track", path, JSON.stringify(req.body));
      res.status(204).end();
    });
  }
}

module.exports = { register, users, redeemCodes };
