// The only routes open without a session: the login page, the two ways to log in, and logging
// out. The login page is served from here, whole and self-contained, so nothing of the app itself
// (its code, the Pokémon art) is public.
import { accessEmail, endSession, startSession } from './auth.js';
import { body, json, log } from './http.js';

const FAIL_WINDOW = 15 * 60 * 1000;
const MAX_FAILS = 10;

/** Codes look like TOKE-4821: no I, O or Q, so they read aloud and type easily. */
const LETTERS = 'ABCDEFGHJKLMNPRSTUVWXYZ';

export function newCode() {
	const pick = (set, n) => Array.from(crypto.getRandomValues(new Uint32Array(n)), (r) => set[r % set.length]).join('');
	return `${pick(LETTERS, 4)}-${pick('0123456789', 4)}`;
}

/**
 * A code's SHA-256, of its letters and digits only, so case and the dash do not matter. Unsalted
 * on purpose: the hash is how a code is looked up. With about 2.8 × 10⁹ codes and ten wrong tries
 * per address per quarter hour, guessing one is out of reach.
 * @param {string} code
 */
export async function hashCode(code) {
	const clean = String(code).toUpperCase().replace(/[^A-Z0-9]/g, '');
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(clean));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** A path on this site to go back to after logging in; anything else goes to the front page. */
function safeNext(/** @type {string | null} */ next) {
	return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

/** @param {URL} url @param {Request} request @param {Env} env @returns {Promise<Response | null>} */
export async function route(url, request, env) {
	const { pathname } = url;

	if (pathname === '/login.html' && request.method === 'GET') {
		return new Response(PAGE, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
	}

	if (pathname === '/login/code' && request.method === 'POST') {
		const ip = request.headers.get('CF-Connecting-IP') || 'local';
		const now = Date.now();
		const fails = await env.DB.prepare('SELECT count, window_start FROM login_failures WHERE ip = ?').bind(ip).first();
		const recent = fails && now - Number(fails.window_start) < FAIL_WINDOW ? Number(fails.count) : 0;
		if (recent >= MAX_FAILS) return json({ ok: false, message: 'For mange feil forsøk. Vent et kvarter og prøv igjen.' }, 429);

		const kid = await env.DB.prepare('SELECT id, name FROM kids WHERE code_hash = ?').bind(await hashCode((await body(request)).code || '')).first();
		if (!kid) {
			await env.DB
				.prepare('INSERT INTO login_failures (ip, count, window_start) VALUES (?, 1, ?) ON CONFLICT (ip) DO UPDATE SET count = CASE WHEN ? - window_start < ? THEN count + 1 ELSE 1 END, window_start = CASE WHEN ? - window_start < ? THEN window_start ELSE ? END')
				.bind(ip, now, now, FAIL_WINDOW, now, FAIL_WINDOW, now)
				.run();
			return json({ ok: false, message: 'Feil kode. Sjekk at du har skrevet den riktig.' }, 401);
		}
		const setCookie = await startSession(env, url, { subject: `kid:${kid.id}`, kind: 'kid', name: String(kid.name) });
		log('login', `kode: ${kid.name}`);
		return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', 'Set-Cookie': setCookie } });
	}

	// Cloudflare Access covers exactly this path and has checked the email before we get here.
	if (pathname === '/login/email' && request.method === 'GET') {
		const email = await accessEmail(request, env, url);
		if (!email) return new Response('Innloggingen med e-post er ikke satt opp riktig.', { status: 403 });
		const setCookie = await startSession(env, url, { subject: email, kind: 'email', name: email.split('@')[0] });
		log('login', `e-post: ${email}`);
		return new Response(null, { status: 302, headers: { Location: safeNext(url.searchParams.get('next')), 'Set-Cookie': setCookie } });
	}

	if (pathname === '/logout' && request.method === 'POST') {
		return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', 'Set-Cookie': await endSession(request, env, url) } });
	}

	return null;
}

/** The answer to a request without a session: pages go to the login page, everything else is refused. */
export function loginRequired(/** @type {Request} */ request, /** @type {URL} */ url) {
	const page = request.method === 'GET' && (request.headers.get('Accept') || '').includes('text/html');
	if (!page) return json({ ok: false, message: 'Du er ikke logget inn.' }, 401);
	return new Response(null, { status: 302, headers: { Location: `/login.html?next=${encodeURIComponent(url.pathname + url.search)}` } });
}

const PAGE = `<!doctype html>
<html lang="nb">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Logg inn – PokéMath</title>
<style>
	:root { --red: oklch(0.59 0.2 27); --red-deep: oklch(0.46 0.17 27); --ink: oklch(0.28 0.035 265); --soft: oklch(0.45 0.03 265); --cream: oklch(0.96 0.02 85); --paper: oklch(0.99 0.008 85); --line: oklch(0.88 0.02 85); }
	* { box-sizing: border-box; }
	body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; background: var(--cream); color: var(--ink); font: 17px/1.45 system-ui, -apple-system, 'Segoe UI', sans-serif; }
	main { width: min(400px, 100%); padding: 28px 24px; border-radius: 22px; background: var(--paper); box-shadow: 0 8px 24px oklch(0.3 0.03 265 / 0.12), 0 0 0 1px var(--line); text-align: center; }
	h1 { margin: 0 0 4px; font-size: 30px; font-weight: 900; color: var(--red); letter-spacing: -0.5px; }
	p { margin: 0 0 18px; color: var(--soft); }
	label { display: block; margin-bottom: 6px; font-weight: 700; }
	input { width: 100%; min-height: 56px; padding: 0 14px; border: 3px solid var(--ink); border-radius: 14px; background: var(--paper); color: var(--ink); font: 800 26px/1 ui-monospace, Menlo, monospace; letter-spacing: 3px; text-align: center; text-transform: uppercase; }
	button, a.button { display: block; width: 100%; min-height: 52px; margin-top: 12px; border: 0; border-radius: 14px; font: 800 19px/52px system-ui, -apple-system, sans-serif; text-decoration: none; cursor: pointer; }
	button { background: var(--red); color: var(--paper); box-shadow: 0 4px 0 var(--red-deep); }
	button:disabled { opacity: 0.6; }
	a.button { background: var(--paper); color: var(--ink); box-shadow: 0 0 0 2px var(--line), 0 4px 0 var(--line); }
	.or { margin: 22px 0 4px; color: var(--soft); font-size: 15px; }
	#status { min-height: 1.5em; margin: 10px 0 0; color: var(--red-deep); font-weight: 600; }
</style>
</head>
<body>
<main>
	<h1>PokéMath</h1>
	<p>Skriv inn koden din for å spille.</p>
	<form id="form">
		<label for="code">Kode</label>
		<input id="code" name="code" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" placeholder="ABCD-1234" required>
		<button id="go" type="submit">Logg inn</button>
		<div id="status" role="status"></div>
	</form>
	<div class="or">Voksen med e-post?</div>
	<a class="button" id="email" href="/login/email">Logg inn med e-post</a>
</main>
<script>
	const next = new URLSearchParams(location.search).get('next') || '/';
	const target = next.startsWith('/') && !next.startsWith('//') ? next : '/';
	const email = document.getElementById('email');
	email.href = '/login/email?next=' + encodeURIComponent(target);
	email.addEventListener('click', () => { try { sessionStorage.removeItem('pm-me'); } catch {} });
	document.getElementById('form').addEventListener('submit', async (e) => {
		e.preventDefault();
		const go = document.getElementById('go');
		const status = document.getElementById('status');
		go.disabled = true;
		status.textContent = '';
		try {
			const res = await fetch('/login/code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: document.getElementById('code').value }) });
			const data = await res.json();
			if (data.ok) {
				// A new login: the pages must ask again who this is.
				try { sessionStorage.removeItem('pm-me'); } catch {}
				return location.replace(target);
			}
			status.textContent = data.message || 'Det gikk ikke.';
		} catch {
			status.textContent = 'Fikk ikke kontakt. Prøv igjen.';
		}
		go.disabled = false;
	});
</script>
</body>
</html>`;
