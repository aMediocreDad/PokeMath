// The front page is reached both as / and as /index.html (the header, the legacy pages and old
// bookmarks link to /index.html). Both show the route at /.
/** @type {import('@sveltejs/kit/hooks').Reroute} */
export function reroute({ url }) {
	if (url.pathname === '/index.html') return '/';
}
