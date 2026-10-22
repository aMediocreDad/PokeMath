// Every request must carry a valid Cloudflare Access token, so the site stays closed even if
// Access is switched off or not set up yet. TEAM_DOMAIN (https://<team>.cloudflareaccess.com) and
// POLICY_AUD (the Access application's AUD tag) come from the Access application; until both are
// set, nothing is served.
//
// The token's email, verified by Access, is who the visitor is: it picks their cloud save and
// decides whether they are a teacher. Local development passes ACCESS_DISABLED instead, and is
// DEV_EMAIL, or whoever an x-dev-email header names, so tests can be several people.
import { createRemoteJWKSet, jwtVerify } from 'jose';

/** @type {Map<string, ReturnType<typeof createRemoteJWKSet>>} */
const keySets = new Map();

/** @typedef {{ email: string }} Identity */

/** @param {Request} request @param {Env} env @returns {Promise<Identity | Response>} who is asking, or the refusal */
export async function identify(request, env) {
	if (env.ACCESS_DISABLED === 'true') {
		return { email: normalise(request.headers.get('x-dev-email') || env.DEV_EMAIL || 'laerer@test.no') };
	}
	const { TEAM_DOMAIN, POLICY_AUD } = env;
	if (!TEAM_DOMAIN || !POLICY_AUD) return new Response('Ikke satt opp ennå.', { status: 403 });
	const token = request.headers.get('cf-access-jwt-assertion');
	if (!token) return new Response('Ingen tilgang.', { status: 403 });
	let keys = keySets.get(TEAM_DOMAIN);
	if (!keys) keySets.set(TEAM_DOMAIN, (keys = createRemoteJWKSet(new URL(`${TEAM_DOMAIN}/cdn-cgi/access/certs`))));
	try {
		const { payload } = await jwtVerify(token, keys, { issuer: TEAM_DOMAIN, audience: POLICY_AUD });
		if (typeof payload.email !== 'string' || !payload.email) return new Response('Ingen tilgang.', { status: 403 });
		return { email: normalise(payload.email) };
	} catch {
		return new Response('Ingen tilgang.', { status: 403 });
	}
}

/** @param {string} email */
const normalise = (email) => email.trim().toLowerCase();

/** Whether this person may use the teacher pages: TEACHER_EMAILS is a comma-separated list. */
export function isTeacher(/** @type {Identity} */ who, /** @type {Env} */ env) {
	return String(env.TEACHER_EMAILS || '')
		.split(',')
		.map(normalise)
		.includes(who.email);
}
