// Cloud saves: one copy of the save per login (an email, or a child's code), so a player can move
// between devices. The saves.email column holds the login's id (worker/auth.js).
//
// The Worker never lets a save lose Pokémon by accident: a PUT with fewer Pokémon than the stored
// save is refused with the stored save, unless the page says the player chose it (force). That
// stops a fresh device's empty save from replacing a real one, whatever the page gets wrong.
import { json } from './http.js';

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
	const stored = await db.prepare('SELECT data, pokemon, updated_at FROM saves WHERE email = ?').bind(who.id).first();
	const view = (row) => row && { data: JSON.parse(String(row.data)), pokemon: row.pokemon, updatedAt: row.updated_at };

	if (request.method === 'GET') return json({ save: view(stored) });

	if (request.method === 'PUT') {
		const text = await request.text();
		if (text.length > MAX_BYTES) return json({ error: 'Lagringen er for stor.' }, 413);
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
		if (stored && pokemon < Number(stored.pokemon) && input.force !== true) {
			return json({ error: 'Lagringen i skyen har flere Pokémon.', save: view(stored) }, 409);
		}
		const updatedAt = Date.now();
		await db
			.prepare('INSERT INTO saves (email, data, pokemon, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (email) DO UPDATE SET data = excluded.data, pokemon = excluded.pokemon, updated_at = excluded.updated_at')
			.bind(who.id, JSON.stringify(data), pokemon, updatedAt)
			.run();
		return json({ ok: true, pokemon, updatedAt });
	}

	return json({ error: 'Bare GET og PUT.' }, 405);
}
