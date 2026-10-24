// Who is asking. The Worker is the only lock on pokemath.amediocre.dad: a browser needs a session
// cookie, made by one of two logins.
//
// - Email: /login/email sits behind a Cloudflare Access application that covers only that path.
//   Access checks the email with a one-time code; the Worker checks Access's signed token
//   (TEAM_DOMAIN, POLICY_AUD) and starts a session for that email.
// - Code: children without email get a code from a teacher (kids table) and type it on the login
//   page.
//
// Local development (ACCESS_DISABLED, honoured on localhost only, so a stray setting can never
// open the real site) is DEV_EMAIL or whoever an x-dev-email header names; an x-dev-anonymous
// header makes a request logged out, to test the gate.
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { randomHex } from './http.js';

export const COOKIE = 'pm_session';
const EMAIL_SESSION = 90 * 24 * 60 * 60 * 1000;
const KID_SESSION = 365 * 24 * 60 * 60 * 1000;

/** @typedef {{ id: string, kind: 'email' | 'kid', name: string, email?: string }} Identity */

/** @param {string} email */
export const normalise = (email) => email.trim().toLowerCase();

/** @param {URL} url @param {Env} env */
export const isLocalDev = (url, env) => env.ACCESS_DISABLED === 'true' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');

/** @param {Request} request @param {string} name */
function cookie(request, name) {
	for (const part of (request.headers.get('Cookie') || '').split(';')) {
		const [k, ...v] = part.trim().split('=');
		if (k === name) return v.join('=');
	}
	return '';
}

/** @param {string} email @returns {Identity} */
const emailIdentity = (email) => ({ id: normalise(email), kind: 'email', name: normalise(email).split('@')[0], email: normalise(email) });

/** @param {Request} request @param {Env} env @param {URL} url @returns {Promise<Identity | null>} */
export async function identify(request, env, url) {
	const token = cookie(request, COOKIE);
	if (token) {
		const s = await env.DB.prepare('SELECT subject, kind, name FROM sessions WHERE token = ? AND exp > ?').bind(token, Date.now()).first();
		if (s) {
			const kind = /** @type {'email' | 'kid'} */ (s.kind);
			return kind === 'email' ? { ...emailIdentity(String(s.subject)), name: String(s.name) } : { id: String(s.subject), kind, name: String(s.name) };
		}
	}
	if (isLocalDev(url, env) && !request.headers.get('x-dev-anonymous')) {
		return emailIdentity(request.headers.get('x-dev-email') || env.DEV_EMAIL || 'laerer@test.no');
	}
	return null;
}

/** Whether this person may use the teacher pages: an email login listed in TEACHER_EMAILS. */
export function isTeacher(/** @type {Identity} */ who, /** @type {Env} */ env) {
	if (who.kind !== 'email' || !who.email) return false;
	return String(env.TEACHER_EMAILS || '')
		.split(',')
		.map(normalise)
		.includes(who.email);
}

/** @type {Map<string, ReturnType<typeof createRemoteJWKSet>>} */
const keySets = new Map();

/** The email Access vouches for on /login/email, or null. @param {Request} request @param {Env} env @param {URL} url */
export async function accessEmail(request, env, url) {
	if (isLocalDev(url, env)) return normalise(request.headers.get('x-dev-email') || env.DEV_EMAIL || 'laerer@test.no');
	const { TEAM_DOMAIN, POLICY_AUD } = env;
	const token = request.headers.get('cf-access-jwt-assertion');
	if (!TEAM_DOMAIN || !POLICY_AUD || !token) return null;
	let keys = keySets.get(TEAM_DOMAIN);
	if (!keys) keySets.set(TEAM_DOMAIN, (keys = createRemoteJWKSet(new URL(`${TEAM_DOMAIN}/cdn-cgi/access/certs`))));
	try {
		const { payload } = await jwtVerify(token, keys, { issuer: TEAM_DOMAIN, audience: POLICY_AUD, algorithms: ['RS256'] });
		return typeof payload.email === 'string' && payload.email ? normalise(payload.email) : null;
	} catch {
		return null;
	}
}

/**
 * Start a session and return the Set-Cookie header for it. The cookie is set by the server, so
 * Safari keeps it for its full life (it cuts cookies set from page script to seven days).
 * SameSite=Lax, not Strict: a bingo QR code opened from the camera is a cross-site visit.
 * WebKit drops Secure cookies on http://localhost, so local development leaves Secure off.
 * @param {Env} env @param {URL} url @param {{ subject: string, kind: 'email' | 'kid', name: string }} who
 */
export async function startSession(env, url, who) {
	const token = randomHex(32);
	const life = who.kind === 'kid' ? KID_SESSION : EMAIL_SESSION;
	await env.DB.batch([
		env.DB.prepare('DELETE FROM sessions WHERE exp < ?').bind(Date.now()),
		env.DB.prepare('INSERT INTO sessions (token, subject, kind, name, exp) VALUES (?, ?, ?, ?, ?)').bind(token, who.subject, who.kind, who.name, Date.now() + life),
	]);
	return `${COOKIE}=${token}; ${attributes(env, url)}; Max-Age=${Math.floor(life / 1000)}`;
}

/**
 * End the session in this request's cookie, and with it the teacher sessions of that login, which
 * would stay valid for a week otherwise (worker/teacher.js).
 * @param {Request} request @param {Env} env @param {URL} url
 */
export async function endSession(request, env, url) {
	const token = cookie(request, COOKIE);
	if (token) {
		await env.DB.batch([
			// Before the session row goes: it is where the login's email is read from.
			env.DB
				.prepare("DELETE FROM teacher_sessions WHERE teacher_id IN (SELECT id FROM teachers WHERE email = (SELECT subject FROM sessions WHERE token = ? AND kind = 'email'))")
				.bind(token),
			env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token),
		]);
	}
	return `${COOKIE}=; ${attributes(env, url)}; Max-Age=0`;
}

/** @param {Env} env @param {URL} url */
const attributes = (env, url) => `Path=/; HttpOnly; SameSite=Lax${isLocalDev(url, env) ? '' : '; Secure'}`;
