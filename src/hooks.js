// The front page is reached both as / and as /index.html (the header, the legacy pages and old
// bookmarks link to /index.html). Both show the route at /. The teacher start page is likewise
// reached as /lærer/ and /lærer/index.html.
/** @type {import('@sveltejs/kit/hooks').Reroute} */
export function reroute({ url }) {
	const path = decodeURI(url.pathname);
	if (path === '/index.html') return '/';
	if (path === '/lærer' || path === '/lærer/') return '/lærer/index.html';
}
