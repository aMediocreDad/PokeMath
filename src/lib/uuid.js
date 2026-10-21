// The player's anonymous id, ported from getOrCreateUUID() and validateUUID() in static/global.js.
// The server hands out a token the first time it sees an id; both are kept in localStorage.
import { layout } from '#lib/layoutState.svelte.js';

export function generateUUID() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
	});
}

/**
 * @param {string} uuid
 * @param {string | null} token
 * @returns {Promise<{ valid: boolean, unique: boolean, reassign?: boolean, token?: string }>}
 */
async function validateUUID(uuid, token, retryLimit = 3) {
	const url = `/validate-user?uuid=${uuid}&token=${token || ''}`;
	for (let attempt = 1; ; attempt++) {
		try {
			const response = await fetch(url);
			if (!response.ok) {
				layout.connection = 'disconnected';
				throw new Error(`Server returned status ${response.status}`);
			}
			return await response.json();
		} catch {
			if (attempt >= retryLimit) throw new Error('Failed to validate UUID after multiple attempts.');
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}
	}
}

/** @type {Promise<{ uuid: string, token: string } | null> | null} */
let inflight = null;

/**
 * The player's id and token, validated with the server. Since the live global.js of 2026-10 every
 * page calls this on load, so only one request runs at a time, and an id the server says belongs to
 * someone else (reassign) is replaced by a new one.
 * @returns {Promise<{ uuid: string, token: string } | null>}
 */
export function getOrCreateUUID(retryLimit = 3) {
	inflight ??= create(retryLimit).finally(() => (inflight = null));
	return inflight;
}

/** @returns {Promise<{ uuid: string, token: string } | null>} */
async function create(retryLimit = 3) {
	const uuid = localStorage.getItem('UUID') || generateUUID();
	const token = localStorage.getItem('token');
	try {
		const result = await validateUUID(uuid, token, retryLimit);
		if (result.reassign && retryLimit > 0) {
			localStorage.removeItem('UUID');
			localStorage.removeItem('token');
			return create(retryLimit - 1);
		}
		if (result.unique) {
			localStorage.setItem('UUID', uuid);
			localStorage.setItem('token', result.token ?? '');
			layout.connection = 'good';
			return { uuid, token: result.token ?? '' };
		}
		if (!result.valid) throw new Error('Invalid token');
		layout.connection = 'good';
		return { uuid, token: token ?? '' };
	} catch (error) {
		layout.connection = 'disconnected';
		console.error('Error validating UUID:', error);
		return null;
	}
}
