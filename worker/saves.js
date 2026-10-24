// Cloud saves: one copy of the save per login (an email, or a child's code), so a player can move
// between devices. The saves.email column holds the login's id (worker/auth.js).
//
// A PUT names the stored save it was made from (base: that save's updatedAt, or null when the
// device has seen none). When the stored save has changed since, the PUT is refused with it (409),
// so a device left open on old progress never overwrites what was played elsewhere; the page then
// takes the newer save or lets the player choose. updated_at is the version, and only goes up.
//
// A page from before base existed sends none. It gets the old guard: a PUT with fewer Pokémon
// than the stored save is refused, unless the player chose it (force).
//
// Every answer to a GET or a PUT, the refusals with a save too, carries id: whose save it is (the
// login's id), so a page can tell it from one left in the browser by someone else.
import { json, readText } from './http.js';

const MAX_BYTES = 1_000_000;

/** @param {string | undefined} list */
export const countPokemon = (list) => String(list || '').split('|').filter((p) => p.trim()).length;

/**
 * @param {URL} url @param {Request} request @param {Env} env @param {import('./auth.js').Identity} who
 * @returns {Promise<Response | null>}
 */
export async function route(url, request, env, who) {
	if (url.pathname !== '/api/save') return null;
	const db = env.DB;

	// Deleting a save that is not there is as good as deleting one that is.
	if (request.method === 'DELETE') {
		await db.prepare('DELETE FROM saves WHERE email = ?').bind(who.id).run();
		return json({ ok: true });
	}

	const stored = await db.prepare('SELECT data, pokemon, updated_at FROM saves WHERE email = ?').bind(who.id).first();
	const view = (row) => row && { data: JSON.parse(String(row.data)), pokemon: row.pokemon, updatedAt: row.updated_at };

	if (request.method === 'GET') return json({ save: view(stored), id: who.id });

	if (request.method === 'PUT') {
		const text = await readText(request, MAX_BYTES);
		if (text === null) return json({ error: 'Lagringen er for stor.' }, 413);
		let input;
		try {
			input = JSON.parse(text);
		} catch {
			return json({ error: 'Ugyldig lagring.' }, 400);
		}
		const data = input?.data;
		if (!data || typeof data !== 'object' || Array.isArray(data) || Object.values(data).some((v) => typeof v !== 'string')) {
			return json({ error: 'Ugyldig lagring.' }, 400);
		}
		const pokemon = countPokemon(data.pokemonlist);
		const versioned = input && 'base' in input;
		// A base is a version number or null (nothing seen); anything else would be bound as NaN.
		if (versioned && input.base !== null && !Number.isFinite(input.base)) return json({ error: 'Ugyldig lagring.' }, 400);
		if (!versioned && stored && pokemon < Number(stored.pokemon) && input.force !== true) {
			return json({ error: 'Lagringen i skyen har flere Pokémon.', save: view(stored), id: who.id }, 409);
		}
		const updatedAt = Math.max(Date.now(), Number(stored?.updated_at || 0) + 1);
		const body = JSON.stringify(data);
		let written;
		if (!versioned) {
			written = await db
				.prepare('INSERT INTO saves (email, data, pokemon, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (email) DO UPDATE SET data = excluded.data, pokemon = excluded.pokemon, updated_at = excluded.updated_at')
				.bind(who.id, body, pokemon, updatedAt)
				.run();
		} else if (stored) {
			// Only over the save this device last saw; a change in between leaves no row written.
			written = await db
				.prepare('UPDATE saves SET data = ?, pokemon = ?, updated_at = ? WHERE email = ? AND updated_at = ?')
				.bind(body, pokemon, updatedAt, who.id, Number(input.base))
				.run();
		} else {
			// Nothing stored yet (or it was deleted): there is nothing to overwrite, whatever the base.
			written = await db
				.prepare('INSERT INTO saves (email, data, pokemon, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (email) DO NOTHING')
				.bind(who.id, body, pokemon, updatedAt)
				.run();
		}
		if (!written.meta.changes) {
			const current = await db.prepare('SELECT data, pokemon, updated_at FROM saves WHERE email = ?').bind(who.id).first();
			return json({ error: 'Lagringen i skyen er nyere.', save: view(current), id: who.id }, 409);
		}
		return json({ ok: true, pokemon, updatedAt, id: who.id });
	}

	return json({ error: 'Bare GET, PUT og DELETE.' }, 405);
}
