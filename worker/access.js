// Every request must carry a valid Cloudflare Access token, so the site stays closed even if
// Access is switched off or not set up yet. TEAM_DOMAIN (https://<team>.cloudflareaccess.com) and
// POLICY_AUD (the Access application's AUD tag) come from the Access application; until both are
// set, nothing is served. Local development passes ACCESS_DISABLED instead.
import { createRemoteJWKSet, jwtVerify } from 'jose';

/** @type {Map<string, ReturnType<typeof createRemoteJWKSet>>} */
const keySets = new Map();

/** @param {Request} request @param {Env} env @returns {Promise<Response | null>} null when the request may pass */
export async function checkAccess(request, env) {
	if (env.ACCESS_DISABLED === 'true') return null;
	const { TEAM_DOMAIN, POLICY_AUD } = env;
	if (!TEAM_DOMAIN || !POLICY_AUD) return new Response('Ikke satt opp ennå.', { status: 403 });
	const token = request.headers.get('cf-access-jwt-assertion');
	if (!token) return new Response('Ingen tilgang.', { status: 403 });
	let keys = keySets.get(TEAM_DOMAIN);
	if (!keys) keySets.set(TEAM_DOMAIN, (keys = createRemoteJWKSet(new URL(`${TEAM_DOMAIN}/cdn-cgi/access/certs`))));
	try {
		await jwtVerify(token, keys, { issuer: TEAM_DOMAIN, audience: POLICY_AUD });
		return null;
	} catch {
		return new Response('Ingen tilgang.', { status: 403 });
	}
}
