import { spawn } from 'node:child_process';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// The Worker (scripts/dev-worker.sh) answers the API, the login and the class games for `vite dev`.
const API_PORT = 3001;
const api = `http://localhost:${API_PORT}`;

/**
 * Start the local Worker alongside `vite dev`.
 * @returns {import('vite').Plugin}
 */
function devWorker() {
	const shared = /** @type {{ pokemathDevWorker?: import('node:child_process').ChildProcess }} */ (globalThis);

	return {
		name: 'pokemath-dev-worker',
		apply: 'serve',
		configureServer(server) {
			// Vite re-runs this on every config change; keep the one Worker already running.
			if (shared.pokemathDevWorker) return;
			const pageHost = `localhost:${server.config.server.port ?? 5173}`;
			const child = (shared.pokemathDevWorker = spawn('bash', ['scripts/dev-worker.sh'], {
				env: { ...process.env, PORT: String(API_PORT), PAGE_HOST: pageHost },
				stdio: 'inherit'
			}));
			process.on('exit', () => child.kill());
		}
	};
}

export default defineConfig({
	plugins: [
		devWorker(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			prerender: {
				// Pages nothing links to: reached from emails, QR codes or typed in by teachers.
				entries: ['*', '/lærer/index.html', '/lærer/bingo_settings.html', '/bingo_join.html', '/lærer/bingo_host.html'],
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
	server: {
		proxy: {
			// Matched against the URL including its query string.
			'^/(validate-user|update-user-stats|redeem|math-ping|track-[a-z]+|logout|login\\.html)(\\?|$)': api,
			'^/(api|teacher|bingo|login)/': api,
			// images/ and fonts/ are gitignored; the Worker serves the mirrored ones and fetches the rest.
			'^/(images|fonts)/': api,
			'/ws': { target: api, ws: true }
		}
	}
});
