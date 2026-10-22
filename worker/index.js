// The Cloudflare Worker behind the private copy of PokeMath.
//
// The Worker runs before every request, files included, so that nothing is served without a
// Cloudflare Access login. After that check, files in build/ are served as they are.
import { checkAccess } from './access.js';
import * as core from './core.js';
import * as teacher from './teacher.js';

export { BingoHub } from './bingo.js';

export default {
	/** @param {Request} request @param {Env} env */
	async fetch(request, env) {
		const denied = await checkAccess(request, env);
		if (denied) return denied;
		const url = new URL(request.url);

		if (url.pathname === '/ws' || url.pathname === '/bingo/claim-prizes') {
			// BINGO_JURISDICTION ("eu") keeps the lobbies in the EU, as the teacher pages say. Local
			// development leaves it empty: workerd does not implement jurisdictions.
			const ns = env.BINGO_JURISDICTION ? env.BINGO.jurisdiction(env.BINGO_JURISDICTION) : env.BINGO;
			return ns.get(ns.idFromName('hub')).fetch(request);
		}

		const response = (await core.route(url, request, env)) ?? (await teacher.route(url, request, env));
		if (response) return response;

		const file = await env.ASSETS.fetch(request);
		if (file.status !== 404) return file;

		// html_handling is "none", so links keep their .html names and no redirect rewrites them;
		// a folder still serves its index.html.
		if (url.pathname.endsWith('/')) {
			const index = await env.ASSETS.fetch(new URL(url.pathname + 'index.html', url));
			if (index.ok) return index;
		}

		// Local development only: images and fonts not mirrored yet come from the live site.
		if (env.ASSET_ORIGIN && request.method === 'GET' && /^\/(images|fonts)\//.test(url.pathname)) {
			return fetch(env.ASSET_ORIGIN + url.pathname);
		}

		const notFound = await env.ASSETS.fetch(new URL('/notfound.html', url));
		return new Response(notFound.body, { status: 404, headers: notFound.headers });
	},
};
