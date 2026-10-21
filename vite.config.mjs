import { spawn } from 'node:child_process';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// dev/server.js stands in for the production server, which is not in this repository.
const API_PORT = 3001;
const api = `http://localhost:${API_PORT}`;

/**
 * Start the stand-in server alongside `vite dev`.
 * @returns {import('vite').Plugin}
 */
function devApiServer() {
	const shared = /** @type {{ pokemathDevApi?: import('node:child_process').ChildProcess }} */ (globalThis);

	return {
		name: 'pokemath-dev-api',
		apply: 'serve',
		configureServer(server) {
			// Serve static/index.html for / (and lærer/index.html for /lærer/), as static hosting does.
			server.middlewares.use((req, _res, next) => {
				const [path, query = ''] = (req.url ?? '').split('?');
				if (path.endsWith('/')) req.url = path + 'index.html' + (query && '?' + query);
				next();
			});

			// Vite re-runs this on every config change; keep the one server already running.
			if (shared.pokemathDevApi) return;
			const child = (shared.pokemathDevApi = spawn(process.execPath, ['dev/server.js'], {
				env: { ...process.env, PORT: String(API_PORT) },
				stdio: 'inherit'
			}));
			process.on('exit', () => child.kill());
		}
	};
}

export default defineConfig({
	plugins: [
		devApiServer(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			prerender: {
				// images/ and fonts/ are not in the repository, so links to them cannot be checked here.
				handleHttpError: ({ path, message }) => {
					if (/^\/(images|fonts)\//.test(path)) return;
					throw new Error(message);
				}
			}
		})
	],
	build: {
		// School iPads are often a few iPadOS versions behind.
		target: ['es2020', 'safari15', 'ios15']
	},
	ssr: {
		// express 4 (used by the production server) hoists cookie@0.7 to the root, which
		// SvelteKit would pick up instead of its own cookie@2. Bundling it resolves the right one.
		noExternal: ['cookie']
	},
	server: {
		proxy: {
			// Matched against the URL including its query string.
			'^/(validate-user|update-user-stats|redeem|math-ping|track-[a-z]+|create-board)(\\?|$)': api,
			'^/(api|teacher|bingo)/': api,
			// images/ and fonts/ are gitignored; the stand-in server fetches and caches them.
			'^/(images|fonts)/': api,
			'/ws': { target: api, ws: true }
		}
	}
});
