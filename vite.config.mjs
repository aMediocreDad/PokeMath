import { spawn } from 'node:child_process';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// dev/server.js stands in for the production server, which is not in this repository.
const API_PORT = 3001;
const api = `http://localhost:${API_PORT}`;

/** Start the stand-in server alongside `vite dev`. */
function devApiServer() {
	return {
		name: 'pokemath-dev-api',
		apply: 'serve',
		configureServer() {
			const child = spawn(process.execPath, ['dev/server.js'], {
				env: { ...process.env, PORT: String(API_PORT) },
				stdio: 'inherit'
			});
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
			adapter: adapter()
		})
	],
	ssr: {
		// express 4 (used by the production server) hoists cookie@0.7 to the root, which
		// SvelteKit would pick up instead of its own cookie@2. Bundling it resolves the right one.
		noExternal: ['cookie']
	},
	server: {
		proxy: {
			'^/(validate-user|update-user-stats|redeem|math-ping|track-[a-z]+|create-board)$': api,
			'^/(api|teacher|bingo)/': api,
			// images/ and fonts/ are gitignored; the stand-in server fetches and caches them.
			'^/(images|fonts)/': api,
			'/ws': { target: api, ws: true }
		}
	}
});
