// Teacher account endpoints under /teacher/*, ported from dev/teacher.js; the data lives in D1.
// Nothing sends email: the site sits behind Cloudflare Access, so new accounts are ready at once,
// and a password reset link is only written to the Worker log (wrangler tail).
import { body, fail, json, log, randomHex } from './http.js';

const SESSION_LIFETIME = 7 * 24 * 60 * 60 * 1000;
const RESET_LIFETIME = 60 * 60 * 1000;
const PBKDF2_ROUNDS = 100_000;

/** @param {Uint8Array} buf */
const hex = (buf) => [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
/** @param {string} s */
const unhex = (s) => new Uint8Array(s.match(/../g)?.map((b) => parseInt(b, 16)) ?? []);

/** @param {string} password @param {Uint8Array} salt @param {number} rounds */
async function derive(password, salt, rounds) {
	const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
	const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: rounds }, key, 256);
	return hex(new Uint8Array(bits));
}

/** Stored as pbkdf2$rounds$salt$hash. @param {string} password */
export async function hashPassword(password) {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	return `pbkdf2$${PBKDF2_ROUNDS}$${hex(salt)}$${await derive(password, salt, PBKDF2_ROUNDS)}`;
}

/** @param {string} password @param {string} stored */
async function checkPassword(password, stored) {
	const [scheme, rounds, salt, hash] = stored.split('$');
	if (scheme !== 'pbkdf2') return false;
	return (await derive(password, unhex(salt), Number(rounds))) === hash;
}

/**
 * The teacher a session token belongs to, or null. The bingo Durable Object uses it too.
 * @param {D1Database} db @param {unknown} token
 */
export async function sessionTeacher(db, token) {
	if (!token || typeof token !== 'string') return null;
	return db
		.prepare('SELECT t.*, s.exp FROM teacher_sessions s JOIN teachers t ON t.id = s.teacher_id WHERE s.token = ? AND s.exp > ?')
		.bind(token, Date.now())
		.first();
}

/** @param {Request} request */
const bearer = (request) => (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');

/** @param {URL} url @param {Request} request @param {Env} env @returns {Promise<Response | null>} */
export async function route(url, request, env) {
	const { pathname } = url;
	if (!pathname.startsWith('/teacher/')) return null;
	const method = request.method;
	const db = env.DB;

	if (method === 'POST' && pathname === '/teacher/register') {
		const input = await body(request);
		const email = String(input.email || '').trim().toLowerCase();
		const name = String(input.name || '').trim();
		const password = String(input.password || '');
		if (!name || !email || !password) return fail(400, 'Fyll ut navn, e-post og passord.');
		if (password.length < 8) return fail(400, 'Passordet må være minst 8 tegn.');
		if (await db.prepare('SELECT 1 FROM teachers WHERE email = ?').bind(email).first()) {
			return fail(409, 'Det finnes allerede en konto med denne e-posten.');
		}
		await db
			.prepare(
				`INSERT INTO teachers (id, name, email, password_hash, county, municipality, school_name, how_found, email_verified)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
			)
			.bind(
				crypto.randomUUID(), name, email, await hashPassword(password),
				String(input.county || ''), String(input.municipality || ''), String(input.schoolName || ''), String(input.howFound || ''),
			)
			.run();
		log('teacher', `registrert: ${email}`);
		return json({ ok: true, message: 'Kontoen er klar. Du kan logge inn.' });
	}

	if (method === 'GET' && pathname === '/teacher/verify-email') {
		const token = url.searchParams.get('token') || '';
		const row = await db
			.prepare("DELETE FROM teacher_tokens WHERE token = ? AND kind = 'verify' RETURNING teacher_id")
			.bind(token)
			.first();
		const teacher = row && (await db.prepare('UPDATE teachers SET email_verified = 1 WHERE id = ? RETURNING name').bind(row.teacher_id).first());
		if (!teacher) return fail(400, 'Ugyldig eller allerede brukt lenke.');
		return json({ ok: true, name: teacher.name });
	}

	if (method === 'POST' && pathname === '/teacher/login') {
		const input = await body(request);
		const email = String(input.email || '').trim().toLowerCase();
		const teacher = await db.prepare('SELECT id, password_hash, email_verified FROM teachers WHERE email = ?').bind(email).first();
		if (!teacher || !(await checkPassword(String(input.password || ''), String(teacher.password_hash)))) {
			return fail(401, 'Feil e-post eller passord.');
		}
		if (!teacher.email_verified) return fail(403, 'Du må bekrefte e-posten din først.');
		const token = randomHex(24);
		await db.batch([
			db.prepare('DELETE FROM teacher_sessions WHERE exp < ?').bind(Date.now()),
			db.prepare('INSERT INTO teacher_sessions (token, teacher_id, exp) VALUES (?, ?, ?)').bind(token, teacher.id, Date.now() + SESSION_LIFETIME),
		]);
		return json({ ok: true, teacherSession: token });
	}

	if (method === 'POST' && pathname === '/teacher/forgot-password') {
		const email = String((await body(request)).email || '').trim().toLowerCase();
		const teacher = await db.prepare('SELECT id FROM teachers WHERE email = ?').bind(email).first();
		if (teacher) {
			const token = randomHex(24);
			await db
				.prepare("INSERT INTO teacher_tokens (token, kind, teacher_id, exp) VALUES (?, 'reset', ?, ?)")
				.bind(token, teacher.id, Date.now() + RESET_LIFETIME)
				.run();
			log('email', `Nytt passord for ${email}: ${url.origin}/lærer/reset-password.html?token=${token}`);
		}
		return json({ ok: true, message: 'Forespørsel registrert. Du vil snart motta en e-post.' });
	}

	if (method === 'POST' && pathname === '/teacher/reset-password') {
		const input = await body(request);
		const token = String(input.token || '');
		const password = String(input.password || '');
		const reset = await db
			.prepare("SELECT teacher_id FROM teacher_tokens WHERE token = ? AND kind = 'reset' AND exp > ?")
			.bind(token, Date.now())
			.first();
		// The page only shows its "invalid link" panel when the message contains "ugyldig".
		if (!reset) return fail(400, 'Lenken er ugyldig eller utløpt.');
		if (password.length < 8) return fail(422, 'Passordet må være minst 8 tegn.');
		await db.batch([
			db.prepare('DELETE FROM teacher_tokens WHERE token = ?').bind(token),
			db.prepare('UPDATE teachers SET password_hash = ? WHERE id = ?').bind(await hashPassword(password), reset.teacher_id),
		]);
		return json({ ok: true, message: 'Passordet er oppdatert. Du kan nå logge inn.' });
	}

	// The rest needs a logged-in teacher.
	if (!['/teacher/session', '/teacher/account', '/teacher/codes'].includes(pathname)) return null;
	const teacher = await sessionTeacher(db, bearer(request));
	if (!teacher) return fail(401, 'Du er ikke logget inn.');

	if (method === 'GET' && pathname === '/teacher/session') {
		const { name, email, code_tokens, exp } = teacher;
		return json({ ok: true, teacher: { name, email, code_tokens, exp } });
	}

	if (method === 'DELETE' && pathname === '/teacher/account') {
		await db.batch([
			db.prepare('DELETE FROM teacher_sessions WHERE teacher_id = ?').bind(teacher.id),
			db.prepare('DELETE FROM teacher_tokens WHERE teacher_id = ?').bind(teacher.id),
			db.prepare('DELETE FROM teachers WHERE id = ?').bind(teacher.id),
		]);
		log('teacher', `konto slettet: ${teacher.email}`);
		return json({ ok: true });
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
		if (Number(teacher.code_tokens) < 1) return fail(403, 'Du har ingen kodepoletter igjen.');
		const [, left] = await db.batch([
			db
				.prepare('INSERT INTO codes (code, type, value, label, image, repeatable, teacher_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
				.bind(key, String(prize_type), JSON.stringify(prize_value ?? null), String(label), prize_image ?? null, repeatable ? 1 : 0, teacher.id, Date.now()),
			db.prepare('UPDATE teachers SET code_tokens = code_tokens - 1 WHERE id = ? RETURNING code_tokens').bind(teacher.id),
		]);
		log('code', `${teacher.email} laget ${key} (${prize_type})`);
		return json({ ok: true, code_tokens: left.results[0]?.code_tokens });
	}

	return null;
}
