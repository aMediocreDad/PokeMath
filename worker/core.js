// Player endpoints: UUID validation, stats upload, redeem codes, the spring event and tracking.
// Ported from dev/core.js; the data lives in D1.
import { body, json, log, randomHex } from './http.js';

const EVENT = 'easter';
const MILESTONE_STEP = 250_000;

/** @param {URL} url @param {Request} request @param {Env} env @returns {Promise<Response | null>} */
export async function route(url, request, env) {
	const { pathname } = url;
	const method = request.method;
	const db = env.DB;

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
		const { uuid, token, state, shopOptions } = await body(request);
		const user = uuid && (await db.prepare('SELECT token FROM users WHERE uuid = ?').bind(String(uuid)).first());
		if (!user || user.token !== token) return json({ error: 'Ugyldig token' }, 401);
		await db
			.prepare('UPDATE users SET stats = ?, updated_at = ? WHERE uuid = ?')
			.bind(JSON.stringify({ state, shopOptions }), Date.now(), String(uuid))
			.run();
		log('stats', uuid, `${state?.username} poeng=${state?.totalScore} fanget=${state?.pkmnCaught}`);
		return json({ success: true });
	}

	if (method === 'POST' && pathname === '/redeem') {
		const code = String((await body(request)).code || '').trim().toUpperCase();
		const row = code && (await db.prepare('SELECT type, value, label, image FROM codes WHERE code = ?').bind(code).first());
		if (!row) return json({ ok: false, message: 'Ugyldig kode!' });
		/** @type {Record<string, unknown>} */
		const prize = { type: row.type, label: row.label };
		if (row.value != null) prize.value = JSON.parse(String(row.value));
		if (row.image != null) prize.image = row.image;
		return json({ ok: true, prize });
	}

	if (method === 'GET' && pathname === '/api/easter/global') {
		const [total, milestones] = await db.batch([
			db.prepare('SELECT value FROM counters WHERE name = ?').bind(EVENT),
			db.prepare('SELECT segment, reached_at FROM event_milestones WHERE event = ? ORDER BY segment').bind(EVENT),
		]);
		return json({ total: total.results[0]?.value ?? 0, milestones: milestones.results });
	}

	if (method === 'POST' && pathname === '/api/easter/catch') {
		const row = await db
			.prepare('INSERT INTO counters (name, value) VALUES (?, 1) ON CONFLICT (name) DO UPDATE SET value = value + 1 RETURNING value')
			.bind(EVENT)
			.first();
		const total = Number(row?.value ?? 0);
		if (total % MILESTONE_STEP === 0) {
			await db
				.prepare('INSERT OR IGNORE INTO event_milestones (event, segment, reached_at) VALUES (?, ?, ?)')
				.bind(EVENT, total / MILESTONE_STEP, new Date().toISOString())
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
