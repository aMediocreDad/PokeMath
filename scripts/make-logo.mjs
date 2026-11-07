// Draw the PokéMath logos into static/ as plain-path SVGs: the everyday one, Halloween and Christmas.
// The letters come from the fan font "Pokemon Solid", turned into paths, so the site never loads the font.
// The font is not in the repo: download it (dafont.com, "Pokemon Solid") and pass its .ttf.
// Usage: node scripts/make-logo.mjs "path/to/Pokemon Solid.ttf"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

const fontFile = process.argv[2];
if (!fontFile) {
	console.error('Usage: node scripts/make-logo.mjs "path/to/Pokemon Solid.ttf"');
	process.exit(1);
}
const font = opentype.loadSync(fontFile);
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'static');

const SIZE = 150; // font size in SVG units
const OVERLAP = 8; // letters overlap a little, like the classic lettering
const TEXT = 'Pokémath!';
const BALL_R = 30;
const r = (n) => Math.round(n * 10) / 10;

// Lay the letters out once; every logo shares the same shapes.
let x = 0;
const letters = [...TEXT].map((ch) => {
	const glyph = font.charToGlyph(ch);
	const adv = (glyph.advanceWidth / font.unitsPerEm) * SIZE;
	const p = glyph.getPath(x, 0, SIZE);
	const box = p.getBoundingBox();
	const letter = { ch, d: p.toPathData(1), box, cx: x + adv / 2, cy: (box.y1 + box.y2) / 2 };
	x += adv - OVERLAP;
	return letter;
});
const width = x;
const o = letters[1]; // the "o" becomes a ball, a pumpkin or an ornament
const ball = { cx: r(o.cx), cy: r(o.cy + 8) };
const P = letters[0].box;

const word = (skipO) =>
	letters
		.filter((l) => !(skipO && l === o))
		.map((l) => `<path d="${l.d}"/>`)
		.join('');
const ring = `<circle cx="${ball.cx}" cy="${ball.cy}" r="${BALL_R}"/>`;

function pokeball(edge, { cap = false } = {}) {
	const { cx, cy } = ball;
	const R = BALL_R;
	return `<g>
		${cap ? `<rect x="${cx - 9}" y="${cy - R - 9}" width="18" height="12" rx="3" fill="#f4bf3f" stroke="${edge}" stroke-width="3"/>
		<path d="M${cx - 5} ${cy - R - 9} a5 5 0 0 1 10 0" fill="none" stroke="#f4bf3f" stroke-width="3"/>` : ''}
		<circle cx="${cx}" cy="${cy}" r="${R}" fill="#fff"/>
		<path d="M${cx - R} ${cy} a${R} ${R} 0 0 1 ${2 * R} 0z" fill="#ee3b35"/>
		<rect x="${cx - R}" y="${r(cy - R * 0.11)}" width="${2 * R}" height="${r(R * 0.22)}" fill="#1d2c5e"/>
		<circle cx="${cx}" cy="${cy}" r="${r(R * 0.34)}" fill="#1d2c5e"/>
		<circle cx="${cx}" cy="${cy}" r="${r(R * 0.2)}" fill="#fff"/>
		<path d="M${r(cx - R * 0.62)} ${r(cy - R * 0.42)} a${r(R * 0.75)} ${r(R * 0.75)} 0 0 1 ${r(R * 0.5)} ${r(-R * 0.32)}" stroke="#fff" stroke-width="${r(R * 0.14)}" stroke-linecap="round" fill="none" opacity=".7"/>
		<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${edge}" stroke-width="4"/>
	</g>`;
}

function pumpkin(edge) {
	const { cx, cy } = ball;
	const R = BALL_R;
	return `<g stroke-linejoin="round">
		<path d="M${cx - 2} ${cy - R + 4} q-2 -12 8 -16" fill="none" stroke="#3f7d2c" stroke-width="7" stroke-linecap="round"/>
		<ellipse cx="${cx}" cy="${cy}" rx="${R}" ry="${R * 0.9}" fill="#f7871e" stroke="${edge}" stroke-width="4"/>
		<path d="M${cx - R * 0.55} ${r(cy - R * 0.75)} q${-R * 0.35} ${R * 0.75} 0 ${R * 1.5} M${cx + R * 0.55} ${r(cy - R * 0.75)} q${R * 0.35} ${R * 0.75} 0 ${R * 1.5}" fill="none" stroke="#c75f0a" stroke-width="3"/>
		<path d="M${cx - 15} ${cy - 4} l6 -10 l6 10z M${cx + 3} ${cy - 4} l6 -10 l6 10z" fill="${edge}"/>
		<path d="M${cx - 17} ${cy + 6} q17 16 34 0 l-5 2 l-3 -3 l-4 4 l-4 -4 l-4 4 l-4 -4 l-3 3z" fill="${edge}"/>
	</g>`;
}

// A Santa hat on the P, flopping to the left.
function santaHat() {
	const left = P.x1 - 6;
	const top = P.y1 + 6;
	const w = (P.x2 - P.x1) * 0.95;
	return `<g transform="rotate(-14 ${r(left + w / 2)} ${r(top)})" stroke="#4a0d0d" stroke-width="4" stroke-linejoin="round">
		<path d="M${r(left + 4)} ${r(top - 6)} C${r(left + 8)} ${r(top - 60)} ${r(left - 4)} ${r(top - 78)} ${r(left - 22)} ${r(top - 64)} C${r(left + w * 0.3)} ${r(top - 96)} ${r(left + w * 0.8)} ${r(top - 70)} ${r(left + w + 2)} ${r(top - 6)} Z" fill="#db3834"/>
		<circle cx="${r(left - 24)}" cy="${r(top - 62)}" r="13" fill="#fff"/>
		<rect x="${r(left - 4)}" y="${r(top - 12)}" width="${r(w + 14)}" height="22" rx="11" fill="#fff"/>
	</g>`;
}

const THEMES = {
	logo: { fill: '#ffffff', inner: '#db3834', outer: '#7a1414', shadow: 'rgb(60 10 10 / 0.35)', o: (e) => pokeball(e) },
	'logo-halloween': { fill: '#ffa53d', fillTop: '#ffc46b', inner: '#6a2d9a', outer: '#1a0f24', shadow: 'rgb(20 5 30 / 0.4)', o: pumpkin },
	'logo-christmas': { fill: '#ffffff', inner: '#2e8b47', outer: '#123d22', shadow: 'rgb(10 40 20 / 0.35)', o: (e) => pokeball(e, { cap: true }), extra: santaHat, top: 40, left: 34 },
};

for (const [name, t] of Object.entries(THEMES)) {
	const pad = 40;
	const top = t.top ?? 0;
	const left = t.left ?? 0;
	const vb = [-pad - left, r(-SIZE * 0.95 - pad - top), r(width + 2 * pad + left), r(SIZE * 1.25 + 2 * pad + top)].join(' ');
	const fill = t.fillTop ? `url(#fill)` : t.fill;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="PokéMath">
${t.fillTop ? `<defs><linearGradient id="fill" x1="0" y1="${-SIZE}" x2="0" y2="10" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${t.fillTop}"/><stop offset="1" stop-color="${t.fill}"/></linearGradient></defs>\n` : ''}<g stroke-linejoin="round" stroke-linecap="round">
<g transform="translate(5 9)" fill="${t.shadow}" stroke="${t.shadow}" stroke-width="34">${word(true)}${ring}</g>
<g fill="${t.outer}" stroke="${t.outer}" stroke-width="34">${word(true)}${ring}</g>
<g fill="${t.inner}" stroke="${t.inner}" stroke-width="18">${word(true)}${ring}</g>
<g fill="${fill}">${word(true)}</g>
</g>
${t.o(t.outer)}
${t.extra ? t.extra() : ''}
</svg>
`;
	fs.writeFileSync(path.join(OUT, `${name}.svg`), svg);
}
console.log(`logos written to static/: ${Object.keys(THEMES).map((n) => n + '.svg').join(', ')}`);
