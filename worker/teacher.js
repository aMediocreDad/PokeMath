// Teacher endpoints under /teacher/*, ported from dev/teacher.js; the data lives in D1.
// There are no passwords: the site sits behind Cloudflare Access, which has already checked the
// visitor's email, and the emails in TEACHER_EMAILS are teachers. Logging in turns that into the
// session token the bingo pages have always sent.
import { isTeacher } from './access.js';
import { body, fail, json, log, randomHex } from './http.js';

const SESSION_LIFETIME = 7 * 24 * 60 * 60 * 1000;

/**
 * The teacher a session token belongs to, or null, also when their email has since left
 * TEACHER_EMAILS. The bingo Durable Object uses it too.
 * @param {Env} env @param {unknown} token
 */
export async function sessionTeacher(env, token) {
	if (!token || typeof token !== 'string') return null;
	const teacher = await env.DB
		.prepare('SELECT t.*, s.exp FROM teacher_sessions s JOIN teachers t ON t.id = s.teacher_id WHERE s.token = ? AND s.exp > ?')
		.bind(token, Date.now())
		.first();
	return teacher && isTeacher({ email: String(teacher.email) }, env) ? teacher : null;
}

/** @param {Request} request */
const bearer = (request) => (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');

/**
 * @param {URL} url @param {Request} request @param {Env} env @param {import('./access.js').Identity} who
 * @returns {Promise<Response | null>}
 */
export async function route(url, request, env, who) {
	const { pathname } = url;
	if (!pathname.startsWith('/teacher/')) return null;
	const method = request.method;
	const db = env.DB;

	// The Access login is the teacher login: a listed email gets a session, and a teacher row the
	// first time. Rows from the password era are matched by email, so their codes stay theirs.
	if (method === 'POST' && pathname === '/teacher/access-login') {
		if (!isTeacher(who, env)) return fail(403, 'Du står ikke på lærerlisten.');
		let teacher = await db.prepare('SELECT id, name, email FROM teachers WHERE email = ?').bind(who.email).first();
		if (!teacher) {
			teacher = { id: crypto.randomUUID(), name: who.email.split('@')[0], email: who.email };
			await db
				.prepare("INSERT INTO teachers (id, name, email, password_hash, email_verified) VALUES (?, ?, ?, '', 1)")
				.bind(teacher.id, teacher.name, teacher.email)
				.run();
			log('teacher', `ny lærer: ${who.email}`);
		}
		const token = randomHex(24);
		const exp = Date.now() + SESSION_LIFETIME;
		await db.batch([
			db.prepare('DELETE FROM teacher_sessions WHERE exp < ?').bind(Date.now()),
			db.prepare('INSERT INTO teacher_sessions (token, teacher_id, exp) VALUES (?, ?, ?)').bind(token, teacher.id, exp),
		]);
		return json({ ok: true, teacherSession: token, teacher: { name: teacher.name, email: teacher.email, exp } });
	}

	// The rest needs a session.
	if (!['/teacher/session', '/teacher/codes'].includes(pathname)) return null;
	const teacher = await sessionTeacher(env, bearer(request));
	if (!teacher) return fail(401, 'Du er ikke logget inn.');

	if (method === 'GET' && pathname === '/teacher/session') {
		const { name, email, exp } = teacher;
		return json({ ok: true, teacher: { name, email, exp } });
	}

	if (method === 'GET' && pathname === '/teacher/codes') {
		const { results } = await db
			.prepare('SELECT code AS plaintext_code, label, type AS prize_type, value, image AS prize_image, repeatable FROM codes WHERE teacher_id = ? ORDER BY created_at')
			.bind(teacher.id)
			.all();
		const codes = results.map(({ value, repeatable, ...c }) => ({
			...c,
			prize_value: value == null ? null : JSON.parse(String(value)),
			repeatable: Boolean(repeatable),
		}));
		return json({ ok: true, codes });
	}

	if (method === 'POST' && pathname === '/teacher/codes') {
		const { plaintext_code, label, prize_type, prize_value, prize_image, repeatable } = await body(request);
		const key = String(plaintext_code || '').trim().toUpperCase();
		if (!key || !label || !prize_type) return fail(400, 'Kode, beskrivelse og premietype må fylles ut.');
		if (await db.prepare('SELECT 1 FROM codes WHERE code = ?').bind(key).first()) return fail(409, 'Denne koden finnes allerede.');
		// No token limit: the live site rations codes per teacher, a family copy has no need to.
		await db
			.prepare('INSERT INTO codes (code, type, value, label, image, repeatable, teacher_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
			.bind(key, String(prize_type), JSON.stringify(prize_value ?? null), String(label), prize_image ?? null, repeatable ? 1 : 0, teacher.id, Date.now())
			.run();
		log('code', `${teacher.email} laget ${key} (${prize_type})`);
		return json({ ok: true });
	}

	return null;
}
