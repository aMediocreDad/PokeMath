// Small helpers shared by the Worker's routes.

/** @param {unknown} body @param {number} [status] */
export const json = (body, status = 200) => Response.json(body, { status });

/** @param {number} status @param {string} message */
export const fail = (status, message) => json({ ok: false, message }, status);

/** The request body as JSON, or {} when it is missing or broken, like express.json() left it. */
export async function body(request) {
	try {
		const parsed = await request.json();
		return parsed && typeof parsed === 'object' ? parsed : {};
	} catch {
		return {};
	}
}

/** @param {number} bytes */
export function randomHex(bytes) {
	const buf = crypto.getRandomValues(new Uint8Array(bytes));
	return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** @param {string} kind @param {...unknown} parts */
export function log(kind, ...parts) {
	console.log(`${kind.padEnd(7)}`, ...parts);
}
