// End-to-end smoke test of the mock server: HTTP endpoints plus a full bingo round and a raid.
const WebSocket = require("ws");
const BASE = process.argv[2];
const WS = BASE.replace("http", "ws") + "/ws";
const assert = (cond, label) => { console.log(cond ? "PASS" : "FAIL", label); if (!cond) process.exitCode = 1; };
const j = async (path, opts = {}) => {
  const r = await fetch(BASE + path, { ...opts, headers: { "Content-Type": "application/json", ...(opts.headers || {}) } });
  return { status: r.status, body: await r.json().catch(() => null), type: r.headers.get("content-type") };
};
const post = (path, body, headers) => j(path, { method: "POST", body: JSON.stringify(body), headers });
const kidHeaders = () => ({ "x-dev-anonymous": "1" });

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
    next: (type, ms = 2000) => {
      const i = inbox.findIndex((m) => m.type === type);
      if (i >= 0) return Promise.resolve(inbox.splice(i, 1)[0]);
      return new Promise((resolve, reject) => {
        const waiter = { type, resolve };
        waiters.push(waiter);
        setTimeout(() => {
          // A waiter that timed out must not take a later message.
          const at = waiters.indexOf(waiter);
          if (at >= 0) waiters.splice(at, 1);
          reject(new Error("timeout waiting for " + type));
        }, ms);
      });
    },
  };
}

/** Passes when no message of this type arrives within a short wait. */
async function assertSilent(c, type, label) {
  const arrived = await c.next(type, 600).then(() => true, () => false);
  assert(!arrived, label);
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
  assert(created.phase === "lobby", "a new bingo waits for the class");
  assert(cells.filter((c) => !c.free).every((c) => c.task.rule), "every task has a rule");

  const player = client();
  await player.open();
  player.send({ type: "joinLobby", code: created.code, uuid, name: "Ash", icon: "" });
  const joinedBingo = await player.next("joinResult");
  assert(joinedBingo.ok === true && joinedBingo.bingo.phase === "lobby", "player joined the waiting bingo");
  assert((await host.next("playersUpdate")).players[0].connected, "host sees player");

  const target = cells.find((c) => c.task?.rule.kind === "pokedexExact").task.rule.id;
  const catchMsg = { type: "catchPokemon", code: created.code, uuid, name: "Ash", pokemonCode: `N${target}`, pokedexId: target, pokemonName: "X", types: [], flags: {} };
  player.send({ ...catchMsg, difficulty: "stage3" });
  await assertSilent(host, "toastCatch", "a catch before the start does not count");
  host.send({ type: "hostStartBingo", teacherSession: token, code: created.code });
  await host.next("bingoStarted");
  assert((await player.next("bingoUpdate")).bingo.phase === "play", "children hear the bingo started");
  player.send({ ...catchMsg, difficulty: "stage1" });
  assert((await host.next("toastCatch")).belowLevel === true, "below-level catch only toasts");
  player.send({ ...catchMsg, difficulty: "stage3" });
  const toast = await host.next("toastCatch");
  const board = await host.next("boardUpdate");
  assert(toast.matched && board.lastEvent.pokedexId === target, "matching catch marks a cell");
  assert(board.board.cells.filter((c) => c.marked).length === 2, "free space + matched cell marked");

  // A full row pays every child with a catch, once.
  for (const cell of cells.slice(0, 5)) {
    host.send({ type: "hostMarkCell", teacherSession: token, code: created.code, cellId: cell.cellId, mark: true });
    await host.next("boardUpdate");
  }
  const line = await host.next("linePrize");
  assert(line.lines[0] === "Rad 1" && line.amount === 500 && line.eligibleCount === 1, "a full row pays the class");
  await player.next("bingoReward");
  const linePrizes = (await j(`/bingo/claim-prizes?uuid=${uuid}&keep=1`)).body.prizes;
  assert(linePrizes.length === 1 && linePrizes[0].amount === 500 && linePrizes[0].label === "Rad 1" && linePrizes[0].id, "the child claims the row prize");
  const unconfirmed = (await j(`/bingo/claim-prizes?uuid=${uuid}&keep=1`)).body.prizes;
  assert(unconfirmed.length === 1 && unconfirmed[0].id === linePrizes[0].id, "a prize stays until the page confirms it");
  await post(`/bingo/claim-prizes?uuid=${uuid}`, { ids: [linePrizes[0].id] });
  assert((await j(`/bingo/claim-prizes?uuid=${uuid}&keep=1`)).body.prizes.length === 0, "a confirmed prize is gone");
  host.send({ type: "hostMarkCell", teacherSession: token, code: created.code, cellId: cells[0].cellId, mark: false });
  await host.next("boardUpdate");
  host.send({ type: "hostMarkCell", teacherSession: token, code: created.code, cellId: cells[0].cellId, mark: true });
  await host.next("boardUpdate");
  await assertSilent(host, "linePrize", "a row pays only once");
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

  // Raid round: two children beat the boss together, and both catch it.
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rhost = client();
  await rhost.open();
  rhost.send({ type: "hostCreateRaid", teacherSession: token, settings: { boss: 150, length: "short", className: "5B" } });
  const raid = await rhost.next("raidState");
  assert(raid.kind === "raid" && raid.raid.phase === "lobby" && raid.raid.bossId === 150, "raid created in the lobby phase");
  const kids = [crypto.randomUUID(), crypto.randomUUID()];
  const sockets = [];
  for (const [i, id] of kids.entries()) {
    const c = client();
    await c.open();
    c.send({ type: "joinLobby", code: raid.code, uuid: id, name: `Barn${i}`, icon: "" });
    const joined = await c.next("joinResult");
    assert(joined.ok && joined.kind === "raid" && joined.raid.phase === "lobby", `child ${i} joined the raid`);
    sockets.push(c);
  }
  sockets[0].send({ type: "raidHit", code: raid.code, uuid: kids[0] });
  await assertSilent(rhost, "raidHit", "a hit before the start does nothing");
  sockets[0].send({ type: "catchPokemon", code: raid.code, uuid: kids[0], name: "Barn0", pokemonCode: "N25", pokedexId: 25, pokemonName: "Pikachu", types: [], flags: {}, difficulty: "stage3" });
  await assertSilent(rhost, "toastCatch", "a catch in a raid is ignored");
  rhost.send({ type: "hostMarkCell", teacherSession: token, code: raid.code, cellId: "free", mark: true });
  await assertSilent(rhost, "boardUpdate", "bingo-only host messages ignore a raid");

  rhost.send({ type: "hostStartRaid", teacherSession: token, code: raid.code });
  const started = await rhost.next("raidState");
  assert(started.raid.phase === "fight" && started.raid.maxHp === 20 && started.raid.hp === 20, "start sets 10 health per child");
  assert((await sockets[1].next("raidUpdate")).raid.phase === "fight", "children hear the raid started");

  sockets[0].send({ type: "raidHit", code: raid.code, uuid: kids[0] });
  sockets[0].send({ type: "raidHit", code: raid.code, uuid: kids[0] });
  const first = await rhost.next("raidHit");
  await assertSilent(rhost, "raidHit", "a second hit within a second is dropped");
  assert(first.raid.hp === 19 && first.name === "Barn0", "a hit takes one health");
  for (let round = 0; round < 10; round++) {
    await sleep(1050);
    for (const [i, id] of kids.entries()) if (round < 9 || i === 1) sockets[i].send({ type: "raidHit", code: raid.code, uuid: id });
  }
  const won = await rhost.next("raidWon");
  assert(won.raid.phase === "won" && won.raid.hp === 0 && won.winners.length === 2, "the class beats the boss together");
  await sockets[0].next("bingoReward");
  for (const id of kids) {
    const prizes = (await j(`/bingo/claim-prizes?uuid=${id}`)).body.prizes;
    assert(/^[NS]150$/.test(prizes[0]?.entry) && prizes[1]?.type === "coins", "every child who hit catches the boss");
  }
  const late = client();
  await late.open();
  late.send({ type: "joinLobby", code: raid.code, uuid: crypto.randomUUID(), name: "Sen", icon: "" });
  assert((await late.next("joinResult")).ok === false, "no joining after the win");
  rhost.send({ type: "hostEndLobby", teacherSession: token, code: raid.code });
  await sockets[0].next("ended");
  assert(true, "children told the raid ended");
  for (const c of [rhost, late, ...sockets]) c.ws.close();

  // The login gate: x-dev-anonymous makes a request logged out, as on the real site.
  const anon = { "x-dev-anonymous": "1" };
  const page = await fetch(BASE + "/", { headers: { ...anon, Accept: "text/html" }, redirect: "manual" });
  assert(page.status === 302 && page.headers.get("location") === "/login.html?next=%2F", "page without session -> login page");
  assert((await j("/api/me", { headers: anon })).status === 401, "API without session -> 401");
  assert((await fetch(BASE + "/images/logo.png", { headers: anon })).status === 401, "image without session -> 401");
  const wsRefused = await new Promise((resolve) => {
    const ws = new WebSocket(WS, { headers: anon });
    ws.on("unexpected-response", (req, res) => resolve(res.statusCode));
    ws.on("open", () => { ws.close(); resolve(101); });
    ws.on("error", () => {});
  });
  assert(wsRefused === 401, "bingo socket without session -> 401");
  const loginPage = await fetch(BASE + "/login.html", { headers: anon });
  assert(loginPage.status === 200 && (await loginPage.text()).includes("Logg inn"), "login page is open");

  // Kick, rename and End hold even when a child's iPad was asleep and joins again on waking.
  const khost = client();
  await khost.open();
  khost.send({ type: "hostCreateLobby", teacherSession: token, settings: { difficulty: "easy", minLevel: "stage1", prizeType: "coins" } });
  const room = await khost.next("lobbyCreated");
  const opened = [khost];
  const joinAs = async (id, name) => {
    const c = client();
    opened.push(c);
    await c.open();
    c.send({ type: "joinLobby", code: room.code, uuid: id, name, icon: "" });
    return c;
  };
  const [kicked, renamed, named] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  for (const [id, name] of [[kicked, "Kari"], [renamed, "Tull"], [named, "Ola"]]) {
    const c = await joinAs(id, name);
    await c.next("joinResult");
    c.ws.close();
  }
  khost.send({ type: "hostKickPlayer", teacherSession: token, code: room.code, uuid: kicked });
  khost.send({ type: "hostForceRename", teacherSession: token, code: room.code, uuid: renamed });
  khost.send({ type: "hostSetName", teacherSession: token, code: room.code, uuid: named, name: "Ola N." });
  await sleep(300);
  assert(!!(await (await joinAs(kicked, "Kari")).next("kicked")), "a kicked child cannot join again");
  assert(!!(await (await joinAs(renamed, "Tull")).next("forceRename")), "a child asked to rename cannot join with the old name");
  assert((await (await joinAs(renamed, "Tuva")).next("joinResult")).ok, "…but can with a new one");
  const back = await joinAs(named, "Ola");
  assert((await back.next("joinResult")).ok && (await back.next("nameChanged")).name === "Ola N.", "a name the teacher gave survives a rejoin");
  // A full board ends the game with the prize by itself, even with no host page left to do it.
  khost.send({ type: "hostCreateLobby", teacherSession: token, settings: { difficulty: "easy", minLevel: "stage1", prizeType: "coins" } });
  const full = await khost.next("lobbyCreated");
  khost.send({ type: "hostStartBingo", teacherSession: token, code: full.code });
  await khost.next("bingoStarted");
  const fullCells = full.board.cells.filter((c) => !c.free);
  for (const cell of fullCells) {
    khost.send({ type: "hostMarkCell", teacherSession: token, code: full.code, cellId: cell.cellId, mark: true });
    await khost.next("boardUpdate");
  }
  assert((await khost.next("lobbyPrize")).prize, "a full board hands out the prize without the host asking");
  khost.send({ type: "hostEndLobby", teacherSession: token, code: full.code });
  await khost.next("lobbyEnded");

  khost.send({ type: "hostEndLobby", teacherSession: token, code: room.code });
  assert((await khost.next("lobbyEnded")).code === room.code, "the host hears that the room has ended");
  for (const c of opened) c.ws.close();

  // A child: a teacher makes a code, the child logs in with it and gets a save of their own.
  const child = await post("/teacher/kids", { name: "Kari" });
  assert(child.body.ok && /^[A-Z]{4}-\d{4}$/.test(child.body.code), "teacher makes a code");
  const kidsList = await j("/teacher/kids");
  assert(kidsList.body.kids.some((k) => k.name === "Kari"), "teacher sees the child");
  assert((await post("/teacher/kids", { name: "X" }, kidHeaders())).status === 401, "no session cannot add children");
  const codeLogin = async (code) => {
    const r = await fetch(BASE + "/login/code", { method: "POST", headers: { ...anon, "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const cookie = (r.headers.get("set-cookie") || "").split(";")[0];
    return { status: r.status, cookie, headers: { ...anon, Cookie: cookie } };
  };
  const kari = await codeLogin(child.body.code.toLowerCase().replace("-", " "));
  assert(kari.status === 200 && kari.cookie.startsWith("pm_session="), "code logs in, any case or spacing");
  const meKari = await j("/api/me", { headers: kari.headers });
  assert(meKari.body.kind === "kid" && meKari.body.name === "Kari" && meKari.body.teacher === false, "child is not a teacher");
  assert((await j("/teacher/kids", { headers: kari.headers })).status === 403, "child cannot manage codes");
  const kariSave = await j("/api/save", { method: "PUT", headers: kari.headers, body: JSON.stringify({ data: { pokemonlist: "N25" } }) });
  assert(kariSave.status === 200 && (await j("/api/save", { headers: kari.headers })).body.save.pokemon === 1, "child has a save of their own");
  assert((await j("/api/save")).body.save?.data?.pokemonlist !== "N25", "the teacher's save is separate");

  // A new code logs the child out; logging out ends a session; removing the child ends them all.
  const fresh = await post(`/teacher/kids/${child.body.kid.id}/code`, {});
  assert((await j("/api/me", { headers: kari.headers })).status === 401, "new code ends old sessions");
  assert((await codeLogin(child.body.code)).status === 401, "old code stops working");
  const relog = await codeLogin(fresh.body.code);
  await fetch(BASE + "/logout", { method: "POST", headers: relog.headers });
  assert((await j("/api/me", { headers: relog.headers })).status === 401, "logout ends the session");
  const last = await codeLogin(fresh.body.code);
  await j(`/teacher/kids/${child.body.kid.id}?save=delete`, { method: "DELETE" });
  assert((await j("/api/me", { headers: last.headers })).status === 401, "removing the child ends their sessions");
  assert((await codeLogin(fresh.body.code)).status === 401, "removed child's code stops working");

  // Guessing: fifty different wrong codes from one address lock it out for a quarter hour; the
  // same typo again does not count. Keep this last: the lock lasts for the rest of this server's run.
  assert((await codeLogin("ZZZZ-0000")).status === 401, "wrong codes are refused");
  let typos = 0;
  while (typos < 60 && (await codeLogin("ZZZZ-0000")).status === 401) typos++;
  assert(typos === 60, "the same typo again never locks the address");
  const parallel = await Promise.all(Array.from({ length: 80 }, (_, i) => codeLogin(`ZZZZ-${String(1000 + i)}`)));
  const blocked = parallel.filter((r) => r.status === 429).length;
  assert(80 - blocked <= 50 && blocked >= 30, `different wrong codes lock the address, even sent at once (${80 - blocked} let through)`);
  assert((await codeLogin(fresh.body.code)).status === 429, "a locked address cannot log in at all");
})().catch((e) => { console.log("FAIL", e.message); process.exitCode = 1; });
