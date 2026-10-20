// Teacher account endpoints under /teacher/*.
// Emails are printed to the console instead of sent, and new accounts are approved at once.
const crypto = require("crypto");
const { redeemCodes } = require("./core");

const SESSION_LIFETIME = 7 * 24 * 60 * 60 * 1000;
const RESET_LIFETIME = 60 * 60 * 1000;
const START_TOKENS = 10;

const teachers = new Map(); // id -> teacher
const sessions = new Map(); // token -> { teacherId, exp }
const verifyTokens = new Map(); // token -> teacherId
const resetTokens = new Map(); // token -> { teacherId, exp }
const teacherCodes = []; // codes created by teachers, as returned by GET /teacher/codes

const newToken = () => crypto.randomBytes(24).toString("hex");
const hash = (password) => crypto.createHash("sha256").update(password).digest("hex");

function addTeacher({ name, email, password, county = "", municipality = "", schoolName = "", howFound = "" }) {
  const teacher = {
    id: crypto.randomUUID(),
    name, email, passwordHash: hash(password),
    county, municipality, schoolName, howFound,
    emailVerified: false,
    code_tokens: START_TOKENS,
  };
  teachers.set(teacher.id, teacher);
  return teacher;
}

// Ready-made login for local development.
addTeacher({ name: "Testlærer", email: "laerer@test.no", password: "passord123" }).emailVerified = true;

const findByEmail = (email) => [...teachers.values()].find((t) => t.email === email);

function sessionTeacher(token) {
  const session = sessions.get(token);
  if (!session || session.exp < Date.now()) return null;
  return teachers.get(session.teacherId) || null;
}

function requireTeacher(req, res, next) {
  const token = (req.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const teacher = sessionTeacher(token);
  if (!teacher) return res.status(401).json({ ok: false, message: "Du er ikke logget inn." });
  req.teacher = teacher;
  req.sessionToken = token;
  next();
}

const fail = (res, status, message) => res.status(status).json({ ok: false, message });

function register(app, log) {
  app.post("/teacher/register", (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const { name, password } = req.body || {};
    if (!name || !email || !password) return fail(res, 400, "Fyll ut navn, e-post og passord.");
    if (password.length < 8) return fail(res, 400, "Passordet må være minst 8 tegn.");
    if (findByEmail(email)) return fail(res, 409, "Det finnes allerede en konto med denne e-posten.");
    const teacher = addTeacher({ ...req.body, email });
    const token = newToken();
    verifyTokens.set(token, teacher.id);
    log("email", `Bekreft ${email}: /verify-email.html?token=${token}`);
    res.json({ ok: true, message: "Registrert! Sjekk e-posten din for å bekrefte kontoen." });
  });

  app.get("/teacher/verify-email", (req, res) => {
    const teacherId = verifyTokens.get(req.query.token);
    const teacher = teachers.get(teacherId);
    if (!teacher) return fail(res, 400, "Ugyldig eller allerede brukt lenke.");
    verifyTokens.delete(req.query.token);
    teacher.emailVerified = true;
    res.json({ ok: true, name: teacher.name });
  });

  app.post("/teacher/login", (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const teacher = findByEmail(email);
    if (!teacher || teacher.passwordHash !== hash(String(req.body?.password || ""))) {
      return fail(res, 401, "Feil e-post eller passord.");
    }
    if (!teacher.emailVerified) return fail(res, 403, "Du må bekrefte e-posten din først.");
    const token = newToken();
    sessions.set(token, { teacherId: teacher.id, exp: Date.now() + SESSION_LIFETIME });
    res.json({ ok: true, teacherSession: token });
  });

  app.get("/teacher/session", requireTeacher, (req, res) => {
    const { name, email, code_tokens } = req.teacher;
    res.json({ ok: true, teacher: { name, email, code_tokens, exp: sessions.get(req.sessionToken).exp } });
  });

  app.post("/teacher/forgot-password", (req, res) => {
    const teacher = findByEmail(String(req.body?.email || "").trim().toLowerCase());
    if (teacher) {
      const token = newToken();
      resetTokens.set(token, { teacherId: teacher.id, exp: Date.now() + RESET_LIFETIME });
      log("email", `Nytt passord for ${teacher.email}: /lærer/reset-password.html?token=${token}`);
    }
    res.json({ ok: true, message: "Forespørsel registrert. Du vil snart motta en e-post." });
  });

  app.post("/teacher/reset-password", (req, res) => {
    const { token, password } = req.body || {};
    const reset = resetTokens.get(token);
    const teacher = reset && reset.exp > Date.now() && teachers.get(reset.teacherId);
    // The page only shows its "invalid link" panel when the message contains "ugyldig".
    if (!teacher) return fail(res, 400, "Lenken er ugyldig eller utløpt.");
    if (String(password || "").length < 8) return fail(res, 422, "Passordet må være minst 8 tegn.");
    resetTokens.delete(token);
    teacher.passwordHash = hash(password);
    res.json({ ok: true, message: "Passordet er oppdatert. Du kan nå logge inn." });
  });

  app.delete("/teacher/account", requireTeacher, (req, res) => {
    teachers.delete(req.teacher.id);
    for (const [token, s] of sessions) if (s.teacherId === req.teacher.id) sessions.delete(token);
    log("email", `Konto slettet: ${req.teacher.email}`);
    res.json({ ok: true });
  });

  app.get("/teacher/codes", requireTeacher, (req, res) => {
    res.json({ ok: true, codes: teacherCodes });
  });

  app.post("/teacher/codes", requireTeacher, (req, res) => {
    const { plaintext_code, label, prize_type, prize_value, prize_image, repeatable } = req.body || {};
    const key = String(plaintext_code || "").trim().toUpperCase();
    if (!key || !label || !prize_type) return fail(res, 400, "Kode, beskrivelse og premietype må fylles ut.");
    if (redeemCodes[key]) return fail(res, 409, "Denne koden finnes allerede.");
    if (req.teacher.code_tokens < 1) return fail(res, 403, "Du har ingen kodepoletter igjen.");
    req.teacher.code_tokens -= 1;
    const code = {
      plaintext_code: key, label, prize_type,
      prize_value: prize_value ?? null, prize_image: prize_image ?? null,
      repeatable: Boolean(repeatable),
    };
    teacherCodes.push(code);
    redeemCodes[key] = { type: prize_type, value: code.prize_value, label, image: code.prize_image };
    log("code", `${req.teacher.email} laget ${key} (${prize_type})`);
    res.json({ ok: true, code_tokens: req.teacher.code_tokens });
  });
}

module.exports = { register, sessionTeacher };
