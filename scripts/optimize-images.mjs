// Re-encode the mirrored Pokémon art and player icons in static/images/ as smaller WebP, under the
// same names, so no page changes. Quality 70 is about 40% smaller than the live site's files with
// no visible difference at the size the game shows them (a 240px sprite, 480 pixels on a 2x
// screen); the few images wider than 475px are scaled down to that, as the rest already are.
//
// Re-encoding a lossy file loses a little each time, so each file is done once: .optimized.json
// records the hash of every file this script wrote (or kept). A file whose hash still matches is
// skipped; one the mirror fetched again has a new hash and is done again. Dotfiles are not deployed.
//
// Needs cwebp (brew install webp). AVIF is not used: iOS 15 cannot show it, and it came out no
// smaller than WebP at this quality.
// Usage: node scripts/optimize-images.mjs [--dry-run]
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMAGES = path.join(ROOT, 'static', 'images');
const LEDGER = path.join(IMAGES, '.optimized.json');
const DIRS = ['pokemon/normal', 'pokemon/shiny', 'playericons'];
const MAX_WIDTH = 475;
const DRY = process.argv.includes('--dry-run');

try {
	await run('cwebp', ['-version']);
} catch {
	console.error('cwebp not found: brew install webp');
	process.exit(1);
}

/** @type {Record<string, string>} */
const ledger = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8')) : {};
const hash = (/** @type {Buffer} */ buf) => crypto.createHash('sha1').update(buf).digest('hex');

const todo = [];
for (const dir of DIRS) {
	const full = path.join(IMAGES, dir);
	if (!fs.existsSync(full)) continue;
	for (const name of fs.readdirSync(full)) {
		if (!name.endsWith('.webp')) continue;
		const rel = `${dir}/${name}`;
		if (ledger[rel] !== hash(fs.readFileSync(path.join(IMAGES, rel)))) todo.push(rel);
	}
}
console.log(`${todo.length} images to optimize`);
if (DRY || !todo.length) process.exit(0);

/** The width of a WebP image, from its header. */
function width(/** @type {Buffer} */ buf) {
	const chunk = buf.toString('ascii', 12, 16);
	if (chunk === 'VP8X') return 1 + buf.readUIntLE(24, 3);
	if (chunk === 'VP8 ') return buf.readUInt16LE(26) & 0x3fff;
	if (chunk === 'VP8L') return (buf.readUInt32LE(21) & 0x3fff) + 1;
	return 0;
}

let before = 0;
let after = 0;
let done = 0;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-optimize-'));

async function worker() {
	for (let rel = todo.shift(); rel; rel = todo.shift()) {
		const file = path.join(IMAGES, rel);
		const original = fs.readFileSync(file);
		const out = path.join(tmp, rel.replaceAll('/', '_'));
		const resize = width(original) > MAX_WIDTH ? ['-resize', String(MAX_WIDTH), '0'] : [];
		try {
			await run('cwebp', ['-quiet', '-q', '70', '-alpha_q', '70', '-m', '6', ...resize, file, '-o', out]);
		} catch (err) {
			console.warn(`skipped ${rel}: ${/** @type {Error} */ (err).message.split('\n')[0]}`);
			continue;
		}
		// Keep the original when re-encoding does not make it smaller (and it needs no resize).
		const encoded = fs.readFileSync(out);
		const result = encoded.length < original.length || resize.length ? encoded : original;
		if (result !== original) fs.writeFileSync(file, result);
		fs.rmSync(out);
		ledger[rel] = hash(result);
		before += original.length;
		after += result.length;
		if (++done % 250 === 0) {
			console.log(`${done} done…`);
			fs.writeFileSync(LEDGER, JSON.stringify(ledger));
		}
	}
}

await Promise.all(Array.from({ length: os.availableParallelism() }, worker));
fs.writeFileSync(LEDGER, JSON.stringify(ledger));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`optimized ${done} images: ${(before / 1e6).toFixed(1)} MB → ${(after / 1e6).toFixed(1)} MB`);
