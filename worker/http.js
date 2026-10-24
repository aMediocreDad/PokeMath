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

/**
 * The request body as text, or null when it is over maxBytes. A Content-Length over the cap is
 * refused without reading anything; a body that sends none, or sends a wrong one, is read in
 * pieces and dropped as soon as it passes the cap, so the Worker never holds more than that.
 * @param {Request} request @param {number} maxBytes
 */
export async function readText(request, maxBytes) {
	if (Number(request.headers.get('Content-Length')) > maxBytes) return null;
	if (!request.body) return '';
	const reader = request.body.getReader();
	/** @type {Uint8Array[]} */
	const chunks = [];
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.byteLength;
		if (size > maxBytes) {
			await reader.cancel();
			return null;
		}
		chunks.push(value);
	}
	return new Blob(chunks).text();
}

/** Like body(), but null when the request is bigger than maxBytes, for the caller to answer 413. @param {Request} request @param {number} maxBytes */
export async function cappedBody(request, maxBytes) {
	const text = await readText(request, maxBytes);
	if (text === null) return null;
	try {
		const parsed = JSON.parse(text);
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
