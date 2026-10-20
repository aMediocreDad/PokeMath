// Classroom bingo: the /ws WebSocket used by bingo_host_tasks.js (teacher) and
// bingo_client_live.js (players), plus GET /bingo/claim-prizes.
const { WebSocketServer } = require("ws");
const bingoTasks = require("../static/bingo-tasks.js");
const { sessionTeacher } = require("./teacher");

const rooms = new Map(); // code -> room
const pendingPrizes = new Map(); // player uuid -> prizes not yet claimed

const GEN_END = [151, 251, 386, 493, 649, 721, 809, 905, 1025];
const STAGE_ORDER = ["custom", "stage1", "stage2", "stage3", "stage4", "stage5"];
const COIN_PRIZE = { easy: 5000, medium: 10000, hard: 25000, extreme: 35000, unik: 50000 };

// The production server's category lists are not in the repo; these are a reasonable stand-in.
const CATEGORIES = {
  starter: [1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393, 495, 498, 501, 650, 653, 656, 722, 725, 728, 810, 813, 816, 906, 909, 912],
  dog: [58, 59, 209, 210, 228, 229, 243, 244, 245, 261, 262, 506, 507, 508, 667, 668, 744, 745, 835, 836, 888, 889, 926, 927],
  bird: [16, 17, 18, 21, 22, 83, 84, 85, 144, 145, 146, 163, 164, 276, 277, 396, 397, 398, 519, 520, 521, 661, 662, 663, 731, 732, 733, 821, 822, 823],
  fish: [118, 119, 129, 130, 170, 171, 211, 222, 223, 224, 318, 319, 339, 340, 349, 350, 369, 370, 456, 457, 550, 594, 846, 847],
  plant: [43, 44, 45, 69, 70, 71, 102, 103, 114, 182, 187, 188, 189, 191, 192, 315, 406, 407, 420, 421, 455, 465, 546, 547, 548, 549],
  cat: [52, 53, 300, 301, 403, 404, 405, 431, 432, 509, 510, 677, 678, 725, 726, 727, 863],
  mouse: [19, 20, 25, 26, 27, 28, 172, 311, 312, 417, 587, 702, 777, 819, 820, 921, 922, 923],
  eevee: [133, 134, 135, 136, 196, 197, 470, 471, 700],
  alien: [120, 121, 343, 344, 386, 436, 437, 599, 600, 601, 605, 606, 794, 795, 796, 797, 798, 799, 803, 804, 805, 806],
  machine: [81, 82, 137, 233, 462, 474, 599, 600, 601, 649, 774, 781, 801],
  farm: [83, 84, 85, 128, 241, 273, 274, 275, 672, 673, 819, 820, 916],
};

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  while (rooms.has(code));
  return code;
}

function pick(list, count) {
  return [...list].sort(() => Math.random() - 0.5).slice(0, count);
}

function buildBoard(difficulty) {
  const config = bingoTasks.difficultyConfig[difficulty] || bingoTasks.difficultyConfig.easy;
  let chosen;
  if (config.uniqueIds) {
    chosen = bingoTasks.generateUniqueIdTasks(config.uniqueIds);
  } else {
    chosen = [
      ...pick(bingoTasks.tasks.filter((t) => t.difficulty === "easy" && t.rule), config.easy),
      ...pick(bingoTasks.tasks.filter((t) => t.difficulty === "medium" && t.rule), config.medium),
      ...Array.from({ length: config.randomRange }, bingoTasks.generateRandomRangeTask),
      ...Array.from({ length: config.random }, bingoTasks.generateRandomNumberTask),
    ];
  }
  chosen = pick(chosen, 24);
  const cells = chosen.map((task, i) => ({ cellId: `c${i}-${task.id}`, free: false, marked: false, hits: 0, task }));
  cells.splice(12, 0, { cellId: "free", free: true, marked: true, hits: 0 });
  return { difficulty, cells };
}

function matches(rule, catchMsg) {
  if (!rule) return false;
  const id = Number(catchMsg.pokedexId);
  switch (rule.kind) {
    case "gen": return id > (GEN_END[rule.gen - 2] || 0) && id <= GEN_END[rule.gen - 1];
    case "type": return (catchMsg.types || []).includes(rule.type);
    case "flag": return Boolean(catchMsg.flags?.[rule.flag]);
    case "category": return (CATEGORIES[rule.category] || []).includes(id);
    case "pokedexExact": return id === rule.id;
    case "pokedexRange": return id >= rule.start && id <= rule.end;
    default: return false;
  }
}

const send = (ws, msg) => ws && ws.readyState === ws.OPEN && ws.send(JSON.stringify(msg));

function playerList(room) {
  return [...room.players.values()].map(({ uuid, name, icon, socket, catchCount }) => ({
    uuid, name, icon, catchCount, connected: Boolean(socket && socket.readyState === socket.OPEN),
  }));
}

function roomSnapshot(room) {
  return { code: room.code, board: room.board, className: room.settings.className || "", players: playerList(room), totalCatches: room.totalCatches };
}

// Prize the host modal shows, and the prizes each eligible player receives.
function computePrize(room) {
  const eligible = [...room.players.values()].filter((p) => p.catchCount > 0);
  const legendary = [144, 145, 146, 150, 243, 244, 245, 249, 250, 377, 378, 379, 380, 381, 382, 383, 384];
  const mythic = [151, 251, 385, 386, 490, 491, 492, 493, 494, 647, 648, 649];
  let type = room.settings.prizeType || "random";
  if (type === "random") type = pick(["coins", "legendary", "mythic", "shiny"], 1)[0];

  switch (type) {
    case "coins": {
      const amount = COIN_PRIZE[room.board.difficulty] || 5000;
      return { prize: { type: "coins", amount }, perPlayer: () => [{ type: "coins", amount }] };
    }
    case "participation_coins": {
      const pot = 2000 * room.players.size + 50 * room.totalCatches;
      const share = Math.round(pot / Math.max(1, eligible.length));
      return { prize: { type: "participation_coins", pot }, perPlayer: () => [{ type: "coins", amount: share, participationPot: pot }] };
    }
    case "per_catch_coins":
      return { prize: { type: "per_catch_coins" }, perPlayer: (p) => [{ type: "coins", amount: 50 * p.catchCount }] };
    case "stardust":
      return { prize: { type: "stardust", amount: 1 }, perPlayer: () => [{ type: "stardust", amount: 1 }] };
    case "shiny": {
      const prizes = Array.from({ length: 3 }, () => {
        const id = Math.floor(Math.random() * 1000) + 1;
        return { type: "pokemon", pokedexId: id, entry: `S${id}`, shiny: true, legendary: false };
      });
      return { prize: prizes, perPlayer: () => prizes };
    }
    default: {
      const isLegendary = type === "legendary";
      const id = pick(isLegendary ? legendary : mythic, 1)[0];
      const prize = { type: "pokemon", pokedexId: id, entry: `N${id}`, shiny: false, legendary: isLegendary };
      return { prize, perPlayer: () => [prize] };
    }
  }
}

function hostRoom(ws, msg) {
  if (!sessionTeacher(msg.teacherSession)) {
    send(ws, { type: "error", message: "Lærerøkten er ugyldig. Logg inn på nytt." });
    return null;
  }
  return rooms.get(msg.code) || null;
}

const handlers = {
  hostCreateLobby(ws, msg, log) {
    if (!sessionTeacher(msg.teacherSession)) return send(ws, { type: "error", message: "Lærerøkten er ugyldig. Logg inn på nytt." });
    const settings = msg.settings || {};
    const room = {
      code: makeCode(), settings, host: ws, players: new Map(),
      board: buildBoard(settings.difficulty || "easy"), totalCatches: 0, events: [], locked: false,
    };
    rooms.set(room.code, room);
    log("bingo", `rom ${room.code} opprettet (${room.board.difficulty})`);
    send(ws, { type: "lobbyCreated", ...roomSnapshot(room) });
  },

  hostJoinLobby(ws, msg) {
    if (!sessionTeacher(msg.teacherSession)) return send(ws, { type: "error", message: "Lærerøkten er ugyldig. Logg inn på nytt." });
    const room = rooms.get(msg.code);
    if (!room) return send(ws, { type: "lobbyNotFound", code: msg.code });
    room.host = ws;
    send(ws, { type: "lobbyState", ...roomSnapshot(room), events: room.events });
  },

  hostMarkCell(ws, msg) {
    const room = hostRoom(ws, msg);
    const cell = room?.board.cells.find((c) => c.cellId === msg.cellId);
    if (!cell || cell.free) return;
    cell.marked = Boolean(msg.mark);
    send(room.host, { type: "boardUpdate", board: room.board, totalCatches: room.totalCatches });
  },

  hostLockLobby(ws, msg, log) {
    const room = hostRoom(ws, msg);
    if (!room || room.locked) return;
    room.locked = true;
    const { prize, perPlayer } = computePrize(room);
    const eligible = [...room.players.values()].filter((p) => p.catchCount > 0);
    for (const player of eligible) {
      pendingPrizes.set(player.uuid, [...(pendingPrizes.get(player.uuid) || []), ...perPlayer(player)]);
      send(player.socket, { type: "bingoReward" });
    }
    log("bingo", `rom ${room.code} låst, ${eligible.length} vinnere`);
    send(room.host, { type: "lobbyPrize", prize, eligibleCount: eligible.length });
  },

  hostEndLobby(ws, msg, log) {
    const room = hostRoom(ws, msg);
    if (!room) return;
    for (const player of room.players.values()) send(player.socket, { type: "ended" });
    rooms.delete(room.code);
    log("bingo", `rom ${room.code} avsluttet`);
  },

  joinLobby(ws, msg, log) {
    const room = rooms.get(msg.code);
    if (!room || room.locked || !msg.uuid) return send(ws, { type: "joinResult", ok: false });
    const existing = room.players.get(msg.uuid);
    room.players.set(msg.uuid, {
      uuid: msg.uuid, name: msg.name || "Ash", icon: msg.icon || "",
      catchCount: existing?.catchCount || 0, socket: ws,
    });
    ws.player = { code: room.code, uuid: msg.uuid };
    if (!existing) log("bingo", `${msg.name} ble med i ${room.code}`);
    send(ws, { type: "joinResult", ok: true });
    send(room.host, { type: "playersUpdate", players: playerList(room) });
  },

  catchPokemon(ws, msg) {
    const room = rooms.get(msg.code);
    const player = room?.players.get(msg.uuid);
    if (!room || !player || room.locked) return;

    const minLevel = room.settings.minLevel || "alle";
    const belowLevel = minLevel !== "alle" && STAGE_ORDER.indexOf(msg.difficulty) < STAGE_ORDER.indexOf(minLevel);
    const event = {
      ts: Date.now(), uuid: msg.uuid, name: player.name, pokemonCode: msg.pokemonCode, pokedexId: msg.pokedexId,
      pokemonName: msg.pokemonName, difficulty: msg.difficulty, types: msg.types, flags: msg.flags, matched: false,
    };
    if (belowLevel) {
      send(room.host, { type: "toastCatch", ...event, belowLevel: true, totalCatches: room.totalCatches });
      return;
    }

    const matchedCells = room.board.cells.filter((c) => !c.free && !c.marked && matches(c.task.rule, msg));
    for (const cell of matchedCells) {
      cell.marked = true;
      cell.hits += 1;
    }
    event.matched = matchedCells.length > 0;
    player.catchCount += 1;
    room.totalCatches += 1;
    room.events.push(event);

    const names = matchedCells.map((c) => c.task.name);
    send(room.host, { type: "toastCatch", ...event, totalCatches: room.totalCatches, matchedCells: names, matchedCell: names[0] || null });
    send(room.host, { type: "boardUpdate", board: room.board, totalCatches: room.totalCatches, lastEvent: event });
    send(room.host, { type: "playersUpdate", players: playerList(room) });
  },
};

function register(app) {
  app.get("/bingo/claim-prizes", (req, res) => {
    const prizes = pendingPrizes.get(req.query.uuid) || [];
    pendingPrizes.delete(req.query.uuid);
    res.json({ ok: true, prizes });
  });

  // Only the dead host button on bingo.html calls this.
  app.post("/create-board", (req, res) => res.status(410).json({ error: "Bruk lærersiden for å starte bingo." }));
}

function attach(server, log) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  wss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      const handler = handlers[msg?.type];
      // bingo.js still sends an older message shape (lobbyCode, playerUUID); ignore it.
      if (handler && !msg.lobbyCode) handler(ws, msg, log);
    });
    ws.on("close", () => {
      const room = ws.player && rooms.get(ws.player.code);
      if (room) send(room.host, { type: "playersUpdate", players: playerList(room) });
    });
  });
}

module.exports = { register, attach };
