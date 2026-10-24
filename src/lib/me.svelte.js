// Who is logged in (GET /api/me): an email login or a child's code. The header and the front page
// use it for the teacher links and logging out, and the cloud save to know whose save this is.
// Asked once per tab.

const KEY = 'pm-me';

export const me = $state({ id: '', name: '', kind: '', email: '', teacher: false });

/** @type {Promise<void> | null} */
let loading = null;

/** Resolves once `me` is filled in, or left empty when the server could not be asked. */
export function loadMe() {
	return (loading ??= load());
}

async function load() {
	try {
		const cached = sessionStorage.getItem(KEY);
		if (cached) return void Object.assign(me, JSON.parse(cached));
	} catch {
		// Private browsing can block sessionStorage; ask the server instead.
	}
	try {
		const res = await fetch('/api/me');
		if (!res.ok) return void (loading = null);
		const data = await res.json();
		Object.assign(me, {
			id: String(data.id || ''),
			name: String(data.name || ''),
			kind: String(data.kind || ''),
			email: String(data.email || ''),
			teacher: data.teacher === true
		});
		try {
			sessionStorage.setItem(KEY, JSON.stringify(me));
		} catch {
			// Not cached; asked again on the next page.
		}
	} catch {
		// Offline: no teacher links, which is the safe side. Asked again when called again.
		loading = null;
	}
}

/** Forget who this was, for logging out. */
export function forgetMe() {
	try {
		sessionStorage.removeItem(KEY);
	} catch {
		// Nothing was cached.
	}
}

/**
 * Ask the server who is logged in now, past what this tab cached: the cookie is shared by every
 * tab, so another login in this one (or in another) leaves the cached id out of date. Leaves `me`
 * empty when the server cannot be asked.
 */
export function refreshMe() {
	forgetMe();
	Object.assign(me, { id: '', name: '', kind: '', email: '', teacher: false });
	loading = null;
	return loadMe();
}
