// The teacher session and API calls, from static/lærer/teacher.js. The session token lives in
// localStorage under 'teacherSession', as before, so the bingo pages can read it. There is no
// password: the Cloudflare Access login decides who is a teacher (ensureTeacher()).

export function getTeacherSession() {
	return localStorage.getItem('teacherSession') || '';
}

/** @param {string} token */
export function setTeacherSession(token) {
	if (token) localStorage.setItem('teacherSession', token);
	else localStorage.removeItem('teacherSession');
}

/**
 * fetch() that throws the server's message on a non-2xx answer (apiJson() in teacher.js).
 * @param {string} url
 * @param {RequestInit} [opts]
 * @returns {Promise<any>}
 */
export async function apiJson(url, opts) {
	const r = await fetch(url, opts);
	const text = await r.text();
	let data = null;
	try {
		data = JSON.parse(text);
	} catch {
		// Not JSON; the status text is the message.
	}
	if (!r.ok) throw new Error(data?.message ? data.message : text || `${r.status} ${r.statusText}`);
	return data || {};
}

/** Headers for a call that needs the logged-in teacher. */
export const authHeaders = () => ({ Authorization: `Bearer ${getTeacherSession()}` });

/**
 * @typedef {{ name?: string, email?: string, exp?: string | number }} Teacher
 * @returns {Promise<Teacher | null>} the teacher, or null when not logged in or the session expired
 */
export async function validateSession() {
	if (!getTeacherSession()) return null;
	try {
		const data = await apiJson('/teacher/session', { headers: authHeaders() });
		return data.ok ? data.teacher : null;
	} catch {
		return null;
	}
}

/**
 * The teacher, logging in through Access when the stored session is missing or expired.
 * @returns {Promise<Teacher | null>} null when this Access login is not on the teacher list
 */
export async function ensureTeacher() {
	const current = await validateSession();
	if (current) return current;
	try {
		const data = await apiJson('/teacher/access-login', { method: 'POST' });
		setTeacherSession(data.teacherSession);
		return data.teacher;
	} catch {
		setTeacherSession('');
		return null;
	}
}
