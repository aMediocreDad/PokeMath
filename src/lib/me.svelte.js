// Who the Cloudflare Access login says this visitor is (GET /api/me), so the header and the front
// page can offer the teacher pages to teachers. Asked once per tab.

const KEY = 'pm-me';

export const me = $state({ email: '', teacher: false });

export async function loadMe() {
	try {
		const cached = sessionStorage.getItem(KEY);
		if (cached) return Object.assign(me, JSON.parse(cached));
	} catch {
		// Private browsing can block sessionStorage; ask the server instead.
	}
	try {
		const res = await fetch('/api/me');
		if (!res.ok) return;
		const data = await res.json();
		Object.assign(me, { email: String(data.email || ''), teacher: data.teacher === true });
		try {
			sessionStorage.setItem(KEY, JSON.stringify(me));
		} catch {
			// Not cached; asked again on the next page.
		}
	} catch {
		// Offline: no teacher links, which is the safe side.
	}
}
