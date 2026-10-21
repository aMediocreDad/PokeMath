// The teacher's side of classroom bingo: the pure parts of static/bingo_host_tasks.js, so the host
// page only holds state and markup.

export const DIFF_NO = /** @type {Record<string, string>} */ ({
	easy: 'Enkel',
	medium: 'Middels',
	hard: 'Vanskelig',
	extreme: 'Ekstrem',
	unik: 'Unik'
});
export const BINGO_COINS = /** @type {Record<string, number>} */ ({ easy: 5000, medium: 10000, hard: 25000, extreme: 35000, unik: 50000 });

/** @param {number | string} id */
export const localSprite = (id) => `/images/pokemon/normal/${Number(id)}.png`;

/** @param {string} code */
export const joinUrl = (code) => `${location.protocol}//${location.host}/bingo_join.html?code=${code}`;

/** @param {string} n */
export const nok = (n) => Number(n).toLocaleString('no-NO');

/**
 * @typedef {{ cellId: string, free?: boolean, marked?: boolean, hits?: number, task?: Task }} Cell
 * @typedef {{ name?: string, description?: string, image?: string | null, text?: string | null, textClass?: string | null,
 *   rule?: { kind: string, id?: number, start?: number, end?: number } }} Task
 * @typedef {{ type: string, label: string, intensity: number, indices: number[] }} Milestone
 */

/**
 * Rows, columns, the inner 3×3, the outer frame and the full board, each celebrated once.
 * @param {Cell[]} cells
 * @param {Set<string>} celebrated  keys already celebrated; new ones are added
 * @returns {Milestone[]}
 */
export function checkNewMilestones(cells, celebrated) {
	if (!Array.isArray(cells) || cells.length < 25) return [];
	/** @param {number} i */
	const hit = (i) => cells[i] && (cells[i].free || cells[i].marked);
	/** @type {Milestone[]} */
	const newly = [];
	/** @param {string} key @param {Omit<Milestone, 'indices'>} m @param {number[]} indices */
	const check = (key, m, indices) => {
		if (!celebrated.has(key) && indices.every(hit)) {
			celebrated.add(key);
			newly.push({ ...m, indices });
		}
	};
	const five = [0, 1, 2, 3, 4];
	for (let r = 0; r < 5; r++) check(`row${r}`, { type: 'line', label: `Rad ${r + 1} fullført!`, intensity: 1 }, five.map((c) => r * 5 + c));
	for (let c = 0; c < 5; c++) check(`col${c}`, { type: 'line', label: `Kolonne ${c + 1} fullført!`, intensity: 1 }, five.map((r) => r * 5 + c));
	check('inner', { type: 'inner', label: 'Indre brett fullført!', intensity: 2 }, [6, 7, 8, 11, 12, 13, 16, 17, 18]);
	check('frame', { type: 'frame', label: 'Ytre ramme fullført!', intensity: 2 }, [0, 1, 2, 3, 4, 5, 9, 10, 14, 15, 19, 20, 21, 22, 23, 24]);
	check('full', { type: 'full', label: 'FULLT BRETT! Bingo avsluttet!', intensity: 4 }, Array.from({ length: 25 }, (_, i) => i));
	return newly;
}

/**
 * The prize line on the free space.
 * @param {{ prizeType?: string, prizeSecret?: boolean, difficulty?: string }} settings
 * @param {number} playerCount
 * @param {number} totalCatches
 * @returns {{ text: string, strong?: boolean, pot?: boolean, note?: string }}
 */
export function freeSpacePrize(settings, playerCount, totalCatches) {
	if (settings.prizeSecret) return { text: '🔒 Hemmelig premie' };
	switch (settings.prizeType || 'random') {
		case 'coins':
			return { text: `💰 ${(BINGO_COINS[settings.difficulty ?? ''] || 10000).toLocaleString('no-NO')} mynter`, strong: true };
		case 'participation_coins':
			return { text: `${(2000 * playerCount + 50 * totalCatches).toLocaleString('no-NO')} mynter`, strong: true, pot: true, note: '2 000/elev + 50/fangst' };
		case 'per_catch_coins':
			return { text: '💰 50 mynter/fangst', strong: true };
		case 'legendary':
			return { text: '❓ Tilfeldig Legendarisk' };
		case 'mythic':
			return { text: '❓ Tilfeldig Mytisk' };
		case 'shiny':
			return { text: '✨ Ukjent Shiny Pokémon' };
		case 'stardust':
			return { text: '✨ Stardust ×1' };
		default:
			return { text: '❓ Tilfeldig premie' };
	}
}

/**
 * What the prize modal shows when the full board is locked (showPrizeModal()).
 * @param {any} prize  one prize, or a list (three shiny Pokémon)
 * @param {number} eligibleCount
 * @returns {{ emoji?: string, sprites?: string[], title: string, sub: string }}
 */
export function prizeSummary(prize, eligibleCount) {
	const list = Array.isArray(prize) ? prize : [prize];
	const first = list[0] || {};
	if (first.type === 'coins')
		return { emoji: '💰', title: 'Premie: ' + nok(first.amount) + ' mynter', sub: eligibleCount + ' deltakere som fanget minst én Pokémon får mynter!' };
	if (first.type === 'participation_coins')
		return {
			emoji: '🏦',
			title: 'Deltakelses-premie: ' + nok(first.pot || 0) + ' mynter i potten',
			sub: 'Alle ' + eligibleCount + ' deltakere deler potten basert på hvor mye de deltok!'
		};
	if (first.type === 'pokemon') {
		/** @param {any} p */
		const isShiny = (p) => p.shiny || p.entry?.startsWith('S');
		const allShiny = list.every(isShiny);
		const label = allShiny ? `✨ ${list.length} Shiny Pokémon` : first.legendary ? '⭐ Legendarisk Pokémon' : '🌟 Mytisk Pokémon';
		return {
			sprites: list.map((p) => `/images/pokemon/${isShiny(p) ? 'shiny' : 'normal'}/${p.pokedexId}.png`),
			title: 'Premie: ' + label,
			sub: eligibleCount + ' deltakere som fanget minst én Pokémon får ' + (list.length > 1 ? list.length + ' stk!' : 'denne pokemonen!')
		};
	}
	return { emoji: '🎁', title: 'Premie!', sub: eligibleCount + ' deltakere får premie!' };
}

/**
 * The words before a caught Pokémon's name: "Shiny Mega " and so on (prettyCatch()).
 * @param {Record<string, boolean> | undefined} flags
 */
export function catchPrefix(flags) {
	const parts = [];
	if (flags?.shiny) parts.push('Shiny');
	if (flags?.gmax) parts.push('Gigantamax');
	if (flags?.mega) parts.push('Mega');
	if (flags?.hisuian) parts.push('Hisuian');
	if (flags?.alolan) parts.push('Alolan');
	if (flags?.legendary) parts.push('Legendary');
	if (flags?.mythic) parts.push('Mythic');
	return parts.length ? parts.join(' ') + ' ' : '';
}

/**
 * The tooltip on a log line (buildLogHover()).
 * @param {any} ev
 */
export function logHover(ev) {
	const types = Array.isArray(ev.types) && ev.types.length ? ev.types.join(', ') : '-';
	const flags = ev.flags && typeof ev.flags === 'object' ? Object.entries(ev.flags).filter(([, v]) => v === true).map(([k]) => k) : [];
	return `UUID: ${ev.uuid || '-'}\nTypes: ${types}\nTrue checks: ${flags.length ? flags.join(', ') : '-'}`;
}

/** @param {number | string} ts */
export function fmtTime(ts) {
	try {
		return new Date(ts).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	} catch {
		return '';
	}
}

/**
 * Paper confetti over the whole screen for a few seconds.
 * @param {HTMLCanvasElement} canvas
 * @param {number} intensity
 */
export function launchConfetti(canvas, intensity) {
	const ctx = canvas.getContext('2d');
	if (!ctx) return;
	canvas.width = innerWidth;
	canvas.height = innerHeight;
	const COLORS = ['#cc1a1a', '#2cbb63', '#f7c325', '#3498db', '#ff6b35', '#9b59b6', '#fff'];
	const particles = Array.from({ length: Math.floor(80 * intensity) }, () => ({
		x: Math.random() * canvas.width,
		y: -20,
		vx: (Math.random() - 0.5) * 6,
		vy: Math.random() * 4 + 2,
		rot: Math.random() * 360,
		rs: (Math.random() - 0.5) * 10,
		w: Math.random() * 12 + 5,
		h: Math.random() * 6 + 3,
		color: COLORS[Math.floor(Math.random() * COLORS.length)]
	}));
	const duration = 3500 + intensity * 800;
	const start = Date.now();
	const animate = () => {
		const elapsed = Date.now() - start;
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		if (elapsed > duration) return;
		ctx.globalAlpha = Math.min(1, (duration - elapsed) / 600);
		for (const p of particles) {
			p.x += p.vx;
			p.y += p.vy;
			p.rot += p.rs;
			ctx.save();
			ctx.translate(p.x, p.y);
			ctx.rotate((p.rot * Math.PI) / 180);
			ctx.fillStyle = p.color;
			ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
			ctx.restore();
		}
		ctx.globalAlpha = 1;
		requestAnimationFrame(animate);
	};
	animate();
}
