// Download the images and fonts the site uses from pokemath.online into static/, where they are
// gitignored, so a deployed copy never fetches from the live site. Files already on disk are kept.
// The live server lists no folders, so the file list comes from the code and the game data.
// Usage: node scripts/mirror-assets.mjs [--dry-run]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BG_ITEMS, ICON_ITEMS } from '../src/lib/data/cosmetics.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATIC = path.join(ROOT, 'static');
const ORIGIN = 'https://pokemath.online';
const DRY = process.argv.includes('--dry-run');
const CONCURRENCY = 6;

const wanted = new Set();
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

// Every literal images/… or fonts/… path in the code, styles and pages.
const LITERAL = /(?:images|fonts)\/[\w./%-]+?\.(?:png|webp|svg|gif|jpe?g|woff2?|ttf)/g;
function scan(dir) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (!['images', 'fonts', 'node_modules', 'audio', 'misc'].includes(entry.name)) scan(full);
		} else if (/\.(svelte|js|mjs|html|css|json)$/.test(entry.name)) {
			for (const m of fs.readFileSync(full, 'utf8').matchAll(LITERAL)) wanted.add(decodeURIComponent(m[0]));
		}
	}
}
scan(path.join(ROOT, 'src'));
scan(STATIC);

// Pokémon: every id with an image, normal and shiny, as .webp and the .png fallback.
const ids = JSON.parse(fs.readFileSync(path.join(STATIC, 'valid_images.json'), 'utf8'));
for (const id of ids) for (const kind of ['normal', 'shiny']) for (const ext of ['webp', 'png']) wanted.add(`images/pokemon/${kind}/${id}.${ext}`);

// Shop cosmetics.
for (const bg of BG_ITEMS) wanted.add(`images/backgrounds/${bg.id}.png`);
for (const icon of ICON_ITEMS) {
	const file = icon.img.replace(/^\/+/, '');
	wanted.add(file);
	// The host page and the header try .webp first and fall back to .png.
	wanted.add(file.replace(/\.(png|webp)$/, (_, ext) => (ext === 'png' ? '.webp' : '.png')));
}

// Numbered families built in code. Misses are skipped, so the ranges can be generous.
for (const n of range(1, 60)) wanted.add(`images/badges/${n}.png`);
for (const n of range(1, 24)) wanted.add(`images/events/christmas/${n}.png`);
for (const n of range(1, 12)) wanted.add(`images/events/christmas/present-${n}.png`);
for (const n of range(1, 9)) wanted.add(`images/events/halloween/halloween-egg-0${n}.png`);
for (const a of range(1, 3)) for (const b of range(1, 5)) wanted.add(`images/starter-${a}-${b}.png`);

const todo = [...wanted].filter((rel) => !fs.existsSync(path.join(STATIC, rel))).sort();
console.log(`${wanted.size} files wanted, ${wanted.size - todo.length} already here, ${todo.length} to fetch`);
if (DRY) process.exit(0);

let done = 0;
const missing = [];
let bytes = 0;
async function worker() {
	for (let rel = todo.shift(); rel; rel = todo.shift()) {
		const result = (await download(rel)) ?? (await download(rel));
		if (typeof result === 'number') {
			bytes += result;
		} else {
			missing.push(`${result ?? 'failed'} ${rel}`);
		}
		if (++done % 250 === 0) console.log(`${done} fetched…`);
	}
}

/** Bytes written, the HTTP status when the live site has no such file, or undefined to retry. */
async function download(rel) {
	try {
		const res = await fetch(`${ORIGIN}/${rel.split('/').map(encodeURIComponent).join('/')}`);
		if (!res.ok) return String(res.status);
		const buf = Buffer.from(await res.arrayBuffer());
		const file = path.join(STATIC, rel);
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(file, buf);
		return buf.length;
	} catch {
		return undefined;
	}
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`fetched ${done - missing.length} files, ${(bytes / 1e6).toFixed(1)} MB; ${missing.length} not on the live site`);
fs.writeFileSync(path.join(ROOT, '.mirror-missing.txt'), missing.join('\n') + '\n');
