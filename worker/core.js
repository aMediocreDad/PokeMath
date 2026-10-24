// Player endpoints: UUID validation, stats upload, redeem codes, the spring event and tracking.
// Ported from dev/core.js; the data lives in D1.
import { isTeacher } from './auth.js';
import { body, cappedBody, json, log, randomHex } from './http.js';

const EVENT = 'easter';
const MILESTONE_STEP = 250_000;
/** The state of one player's stats is a few KB (a compressed list of Pokémon and some numbers). */
const MAX_STATS_BYTES = 64 * 1024;
/** One catch per login per second counts for the spring event. */
const CATCH_INTERVAL = 1000;

/**
 * The spring event's counter and milestones are named for the year, so each year starts at zero.
 * The year is Oslo's, so it turns at midnight there. 2026 keeps the plain name, the one its
 * counter was made under.
 * @param {Date} [now]
 */
export function eventName(now = new Date()) {
	const year = Number(new Intl.DateTimeFormat('en', { timeZone: 'Europe/Oslo', year: 'numeric' }).format(now));
	return year === 2026 ? EVENT : `${EVENT}-${year}`;
}

/**
 * Whether the browser's id and token are a pair this server handed out.
 * @param {Env} env @param {unknown} uuid @param {unknown} token
 */
async function knownPlayer(env, uuid, token) {
	const user = uuid && (await env.DB.prepare('SELECT token FROM users WHERE uuid = ?').bind(String(uuid)).first());
	return Boolean(user) && user.token === token;
}

/**
 * @param {URL} url @param {Request} request @param {Env} env @param {import('./auth.js').Identity} who
 * @returns {Promise<Response | null>}
 */
export async function route(url, request, env, who) {
	const { pathname } = url;
	const method = request.method;
	const db = env.DB;

	// Who is logged in, so the pages can show their name and, to teachers, the teacher links.
	if (method === 'GET' && pathname === '/api/me') {
		return json({ id: who.id, name: who.name, kind: who.kind, email: who.email ?? null, teacher: isTeacher(who, env) });
	}

	if (method === 'GET' && pathname === '/validate-user') {
		const uuid = url.searchParams.get('uuid');
		const token = url.searchParams.get('token');
		if (!uuid) return json({ error: 'uuid mangler' }, 400);
		const user = await db.prepare('SELECT token FROM users WHERE uuid = ?').bind(uuid).first();
		if (!user) {
			const newToken = randomHex(16);
			await db.prepare('INSERT INTO users (uuid, token) VALUES (?, ?)').bind(uuid, newToken).run();
			return json({ unique: true, valid: true, token: newToken });
		}
		// The live client (global.js, 2026-10) starts over with a new id when the server answers
		// reassign: the id is someone else's. When the real server sends it is not in the client
		// code; here it is any known id with the wrong token.
		if (user.token !== token) return json({ unique: false, valid: false, reassign: true });
		return json({ unique: false, valid: true });
	}

	if (method === 'POST' && pathname === '/update-user-stats') {
		const input = await cappedBody(request, MAX_STATS_BYTES);
		if (!input) return json({ error: 'Opplastingen er for stor.' }, 413);
		const { uuid, token, state, shopOptions } = input;
		if (!(await knownPlayer(env, uuid, token))) return json({ error: 'Ugyldig token' }, 401);
		await db
			.prepare('UPDATE users SET stats = ?, updated_at = ? WHERE uuid = ?')
			.bind(JSON.stringify({ state, shopOptions }), Date.now(), String(uuid))
			.run();
		log('stats', uuid, `${state?.username} poeng=${state?.totalScore} fanget=${state?.pkmnCaught}`);
		return json({ success: true });
	}

	if (method === 'POST' && pathname === '/redeem') {
		const code = String((await body(request)).code || '').trim().toUpperCase();
		const row = code && (await db.prepare('SELECT type, value, label, image, repeatable FROM codes WHERE code = ?').bind(code).first());
		if (!row) return json({ ok: false, message: 'Ugyldig kode!' });
		// Each login redeems a code once, unless the teacher made it repeatable. The insert is the
		// check, so two requests sent at once cannot both pass.
		const claimed = await db
			.prepare('INSERT INTO redemptions (login_id, code, at) VALUES (?, ?, ?) ON CONFLICT (login_id, code) DO NOTHING')
			.bind(who.id, code, Date.now())
			.run();
		if (!claimed.meta.changes && !row.repeatable) return json({ ok: false, used: true, message: 'Denne koden er allerede brukt.' });
		/** @type {Record<string, unknown>} */
		const prize = { type: row.type, label: row.label };
		if (row.value != null) prize.value = JSON.parse(String(row.value));
		if (row.image != null) prize.image = row.image;
		return json({ ok: true, prize });
	}

	if (method === 'GET' && pathname === '/api/easter/global') {
		const event = eventName();
		const [total, milestones] = await db.batch([
			db.prepare('SELECT value FROM counters WHERE name = ?').bind(event),
			db.prepare('SELECT segment, reached_at FROM event_milestones WHERE event = ? ORDER BY segment').bind(event),
		]);
		return json({ total: total.results[0]?.value ?? 0, milestones: milestones.results });
	}

	if (method === 'POST' && pathname === '/api/easter/catch') {
		const { uuid, token } = await body(request);
		if (!(await knownPlayer(env, uuid, token))) return json({ error: 'Ugyldig token' }, 401);
		// One catch a second per login. The row holds when the login's last catch counted, and the
		// update only goes through when that was long enough ago, so a burst cannot slip past.
		const now = Date.now();
		const turn = await db
			.prepare('INSERT INTO counters (name, value) VALUES (?, ?) ON CONFLICT (name) DO UPDATE SET value = excluded.value WHERE value <= ? RETURNING value')
			.bind(`catch-at:${who.id}`, now, now - CATCH_INTERVAL)
			.first();
		if (!turn) return json({ ok: false, message: 'For fort. Vent litt.' }, 429);
		const event = eventName();
		const row = await db
			.prepare('INSERT INTO counters (name, value) VALUES (?, 1) ON CONFLICT (name) DO UPDATE SET value = value + 1 RETURNING value')
			.bind(event)
			.first();
		const total = Number(row?.value ?? 0);
		if (total % MILESTONE_STEP === 0) {
			await db
				.prepare('INSERT OR IGNORE INTO event_milestones (event, segment, reached_at) VALUES (?, ?, ?)')
				.bind(event, total / MILESTONE_STEP, new Date().toISOString())
				.run();
		}
		return json({ ok: true, total });
	}

	// Fire-and-forget: the client never reads the response.
	if (method === 'POST' && ['/math-ping', '/track-page', '/track-stage', '/track-catch'].includes(pathname)) {
		return new Response(null, { status: 204 });
	}

	// Only the dead host button on the old bingo.html calls this.
	if (method === 'POST' && pathname === '/create-board') {
		return json({ error: 'Bruk lærersiden for å starte bingo.' }, 410);
	}

	return null;
}
