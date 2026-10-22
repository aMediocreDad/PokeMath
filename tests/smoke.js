// End-to-end smoke test of the mock server: HTTP endpoints plus a full bingo round.
const WebSocket = require("ws");
const BASE = process.argv[2];
const WS = BASE.replace("http", "ws") + "/ws";
const assert = (cond, label) => { console.log(cond ? "PASS" : "FAIL", label); if (!cond) process.exitCode = 1; };
const j = async (path, opts = {}) => {
  const r = await fetch(BASE + path, { ...opts, headers: { "Content-Type": "application/json", ...(opts.headers || {}) } });
  return { status: r.status, body: await r.json().catch(() => null), type: r.headers.get("content-type") };
};
const post = (path, body, headers) => j(path, { method: "POST", body: JSON.stringify(body), headers });

function client() {
  const ws = new WebSocket(WS);
  const inbox = [];
  const waiters = [];
  ws.on("message", (raw) => {
    const msg = JSON.parse(raw);
    const i = waiters.findIndex((w) => w.type === msg.type);
    if (i >= 0) waiters.splice(i, 1)[0].resolve(msg); else inbox.push(msg);
  });
  return {
    ws,
    open: () => new Promise((r) => ws.on("open", r)),
    send: (m) => ws.send(JSON.stringify(m)),
    next: (type) => {
      const i = inbox.findIndex((m) => m.type === type);
      if (i >= 0) return Promise.resolve(inbox.splice(i, 1)[0]);
      return new Promise((resolve, reject) => {
        waiters.push({ type, resolve });
        setTimeout(() => reject(new Error("timeout waiting for " + type)), 2000);
      });
    },
  };
}

(async () => {
  // Static pages and assets
  for (const p of ["/", "/pokemath.html", "/l%C3%A6rer/index.html", "/header.html"]) {
    const r = await fetch(BASE + p);
    assert(r.status === 200, `GET ${p} -> ${r.status}`);
  }
  const logo = await fetch(BASE + "/images/logo.png");
  assert(logo.status === 200 && logo.headers.get("content-type") === "image/png", "image proxied from live site");
  const missing = await fetch(BASE + "/finnes-ikke");
  assert(missing.status === 404, "unknown page -> 404");

  // Player
  const uuid = crypto.randomUUID();
  const v1 = await j(`/validate-user?uuid=${uuid}`);
  assert(v1.body.unique && v1.body.valid && v1.body.token, "validate-user new uuid");
  const v2 = await j(`/validate-user?uuid=${uuid}&token=${v1.body.token}`);
  assert(!v2.body.unique && v2.body.valid, "validate-user known uuid");
  const bad = await post("/update-user-stats", { uuid, token: "nope", state: {} });
  assert(bad.status === 401, "stats with bad token -> 401");
  const ok = await post("/update-user-stats", { uuid, token: v1.body.token, state: { username: "Test", totalScore: 5 }, shopOptions: {} });
  assert(ok.status === 200 && ok.body.success, "stats upload");
  const r1 = await post("/redeem", { code: "mynter" });
  assert(r1.body.ok && r1.body.prize.type === "coins", "redeem known code");
  const r2 = await post("/redeem", { code: "tull" });
  assert(r2.body.ok === false && r2.body.message, "redeem unknown code");
  await post("/api/easter/catch", { uuid });
  const eg = await j("/api/easter/global");
  assert(eg.body.total === 1 && Array.isArray(eg.body.milestones), "easter counter");
  const ping = await fetch(BASE + "/math-ping", { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } });
  assert(ping.status === 204, "math-ping");

  // Who is asking: the local Worker is laerer@test.no unless x-dev-email says otherwise.
  const kid = { "x-dev-email": "elev@test.no" };
  const meTeacher = await j("/api/me");
  assert(meTeacher.body.email === "laerer@test.no" && meTeacher.body.teacher === true, "me as teacher");
  const meKid = await j("/api/me", { headers: kid });
  assert(meKid.body.email === "elev@test.no" && meKid.body.teacher === false, "me as non-teacher");

  // Teacher: the Access login is the teacher login.
  const refused = await post("/teacher/access-login", {}, kid);
  assert(refused.status === 403 && refused.body.message, "non-teacher gets no session");
  const login = await post("/teacher/access-login", {});
  const token = login.body.teacherSession;
  assert(login.body.ok && token && login.body.teacher.email === "laerer@test.no", "teacher gets a session");
  const auth = { Authorization: `Bearer ${token}` };
  const sess = await j("/teacher/session", { headers: auth });
  assert(sess.body.ok && sess.body.teacher.email === "laerer@test.no", "session");
  const noAuth = await j("/teacher/session");
  assert(noAuth.status === 401, "session without token -> 401");
  const mk = await post("/teacher/codes", { plaintext_code: "Klasse5b", label: "Hei 5B", prize_type: "coins", prize_value: "100" }, auth);
  assert(mk.body.ok, "create code");
  const list = await j("/teacher/codes", { headers: auth });
  assert(list.body.codes.length === 1, "list codes");
  const red = await post("/redeem", { code: "klasse5b" });
  assert(red.body.ok && red.body.prize.value === "100", "teacher code is redeemable");

  // Bingo round
  const host = client();
  await host.open();
  host.send({ type: "hostCreateLobby", teacherSession: token, settings: { difficulty: "unik", minLevel: "stage2", prizeType: "coins" } });
  const created = await host.next("lobbyCreated");
  const cells = created.board.cells;
  assert(/^[0-9A-Z]{6}$/.test(created.code) && cells.length === 25 && cells[12].free, "lobby created with 25-cell board");
  assert(cells.filter((c) => !c.free).every((c) => c.task.rule), "every task has a rule");

  const player = client();
  await player.open();
  player.send({ type: "joinLobby", code: created.code, uuid, name: "Ash", icon: "" });
  assert((await player.next("joinResult")).ok === true, "player joined");
  assert((await host.next("playersUpdate")).players[0].connected, "host sees player");

  const target = cells.find((c) => c.task?.rule.kind === "pokedexExact").task.rule.id;
  const catchMsg = { type: "catchPokemon", code: created.code, uuid, name: "Ash", pokemonCode: `N${target}`, pokedexId: target, pokemonName: "X", types: [], flags: {} };
  player.send({ ...catchMsg, difficulty: "stage1" });
  assert((await host.next("toastCatch")).belowLevel === true, "below-level catch only toasts");
  player.send({ ...catchMsg, difficulty: "stage3" });
  const toast = await host.next("toastCatch");
  const board = await host.next("boardUpdate");
  assert(toast.matched && board.lastEvent.pokedexId === target, "matching catch marks a cell");
  assert(board.board.cells.filter((c) => c.marked).length === 2, "free space + matched cell marked");

  host.send({ type: "hostMarkCell", teacherSession: token, code: created.code, cellId: cells[0].cellId, mark: true });
  await host.next("boardUpdate");
  host.send({ type: "hostLockLobby", teacherSession: token, code: created.code });
  const prize = await host.next("lobbyPrize");
  assert(prize.prize.amount === 50000 && prize.eligibleCount === 1, "lock gives coin prize");
  await player.next("bingoReward");
  const claim = await j(`/bingo/claim-prizes?uuid=${uuid}`);
  assert(claim.body.prizes.length === 1 && claim.body.prizes[0].amount === 50000, "player claims prize");
  const again = await j(`/bingo/claim-prizes?uuid=${uuid}`);
  assert(again.body.prizes.length === 0, "prize is claimed only once");

  host.send({ type: "hostEndLobby", teacherSession: token, code: created.code });
  await player.next("ended");
  assert(true, "player told the lobby ended");
  host.send({ type: "hostJoinLobby", teacherSession: token, code: created.code });
  assert((await host.next("lobbyNotFound")).code === created.code, "ended lobby is gone");
  host.send({ type: "hostCreateLobby", teacherSession: "falsk", settings: {} });
  assert(/ugyldig/i.test((await host.next("error")).message), "bad teacher session rejected");

  host.ws.close(); player.ws.close();
})().catch((e) => { console.log("FAIL", e.message); process.exitCode = 1; });
