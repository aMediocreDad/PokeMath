// "Tilpasset nivå", the adaptive level, ported from the live math.js (pokemath.online, 2026-10),
// which is ahead of Tirco's repo. Each operation has 0–999 skill points; every 200 points is a
// level (1–5). Fast correct answers add points, wrong ones take them away, and the problems for
// an operation get bigger as its level rises. Multiplication unlocks once addition and
// subtraction reach level 2, division once multiplication does.

/** @typedef {'add' | 'sub' | 'mul' | 'div'} OpKey */
/** @typedef {Record<OpKey, number>} PerOp */

/** Number ranges per operation and level (index 1–5). */
const RANGES = {
	'+': [null, { min: 0, max: 10, minB: 0, maxB: 10 }, { min: 0, max: 25, minB: 0, maxB: 25 }, { min: 0, max: 50, minB: 0, maxB: 50 }, { min: 10, max: 100, minB: 10, maxB: 100 }, { min: 100, max: 1000, minB: 100, maxB: 1000 }],
	'-': [null, { min: 0, max: 10, minB: 0, maxB: 10 }, { min: 0, max: 25, minB: 0, maxB: 25 }, { min: 0, max: 50, minB: 0, maxB: 50 }, { min: 10, max: 100, minB: 10, maxB: 100 }, { min: 100, max: 1000, minB: 100, maxB: 1000 }],
	x: [null, { minA: 0, maxA: 5, minB: 0, maxB: 5 }, { minA: 0, maxA: 10, minB: 0, maxB: 10 }, { minA: 2, maxA: 12, minB: 2, maxB: 12 }, { minA: 10, maxA: 100, minB: 1, maxB: 10 }, { minA: 10, maxA: 999, minB: 10, maxB: 99 }],
	'/': [null, { quotMin: 1, quotMax: 5, divMin: 1, divMax: 5 }, { quotMin: 1, quotMax: 10, divMin: 1, divMax: 10 }, { quotMin: 1, quotMax: 12, divMin: 1, divMax: 12 }, { quotMin: 1, quotMax: 10, divMin: 1, divMax: 100 }, { quotMin: 10, quotMax: 100, divMin: 10, divMax: 100 }]
};

/** Wrong answers allowed in a round: four, so the fifth starts the round over. */
export const ADAPTIVE_LIVES = 5;

/** @param {string} op */
const opKey = (op) => /** @type {OpKey} */ (op === '+' ? 'add' : op === '-' ? 'sub' : op === 'x' ? 'mul' : 'div');

/** generateNumber(min, max, 0) from math.js. @param {number} min @param {number} max */
const whole = (min, max) => Number((min + Math.random() * (max - min)).toFixed(0));

export function createAdaptive() {
	/** @type {PerOp} */
	let skills = { add: 1, sub: 1, mul: 1, div: 1 };
	/** @type {PerOp} */
	let points = { add: 100, sub: 100, mul: 100, div: 100 };
	let penaltiesThisQuestion = 0;

	// loadAdaptiveSkills(): defaults for missing keys, then clamp and derive the levels.
	try {
		const s = JSON.parse(localStorage.getItem('adaptiveSkills') ?? 'null');
		const p = JSON.parse(localStorage.getItem('adaptivePoints') ?? 'null');
		if (s && typeof s === 'object') skills = { ...skills, ...s };
		if (p && typeof p === 'object') points = { ...points, ...p };
	} catch {
		// A broken value falls back to the defaults.
	}
	for (const key of /** @type {OpKey[]} */ (['add', 'sub', 'mul', 'div'])) {
		points[key] = Math.max(0, Math.min(999, Number(points[key]) || 100));
		skills[key] = Math.floor(points[key] / 200) + 1;
	}

	function save() {
		localStorage.setItem('adaptiveSkills', JSON.stringify(skills));
		localStorage.setItem('adaptivePoints', JSON.stringify(points));
	}

	/** The level coins, catches and the work log use: the average level, rounded up. */
	function stage() {
		const levels = Object.values(skills);
		return Math.min(5, Math.max(1, Math.ceil(levels.reduce((a, b) => a + b, 0) / levels.length)));
	}

	return {
		stage,

		/** A new problem; also starts its clock and resets its penalty count (updateProblem()). */
		generate() {
			penaltiesThisQuestion = 0;
			const ops = ['+', '-'];
			if (skills.add >= 2 && skills.sub >= 2) ops.push('x');
			if (skills.mul >= 2) ops.push('/');
			const operator = ops[Math.floor(Math.random() * ops.length)];
			const level = skills[opKey(operator)];
			let numberOne = 0;
			let numberTwo = 0;
			if (operator === '+' || operator === '-') {
				const r = /** @type {{ min: number, max: number, minB: number, maxB: number }} */ (RANGES[operator][level]);
				numberOne = whole(r.min, r.max);
				numberTwo = whole(r.minB, r.maxB);
				if (operator === '-' && numberOne < numberTwo) [numberOne, numberTwo] = [numberTwo, numberOne];
			} else if (operator === 'x') {
				const r = /** @type {{ minA: number, maxA: number, minB: number, maxB: number }} */ (RANGES.x[level]);
				numberOne = whole(r.minA, r.maxA);
				numberTwo = whole(r.minB, r.maxB);
			} else {
				const r = /** @type {{ quotMin: number, quotMax: number, divMin: number, divMax: number }} */ (RANGES['/'][level]);
				const quotient = whole(r.quotMin, r.quotMax);
				numberTwo = Math.max(1, whole(r.divMin, r.divMax));
				numberOne = quotient * numberTwo;
			}
			return { operator, numberOne, numberTwo, startedAt: Date.now() };
		},

		/**
		 * Five seconds per digit in both numbers, and half again for × and ÷ from level 3.
		 * @param {{ operator: string, numberOne: number, numberTwo: number }} problem
		 */
		timeLimit(problem) {
			const digits = String(Math.abs(Math.round(problem.numberOne))).length + String(Math.abs(Math.round(problem.numberTwo))).length;
			let ms = digits * 5000;
			if ((problem.operator === 'x' || problem.operator === '/') && skills[opKey(problem.operator)] >= 3) ms *= 1.5;
			return ms;
		},

		/**
		 * updateAdaptiveSkill(): fast +10, in time ±0, slow or wrong −15 (at most four times per
		 * problem). Returns the new overall stage.
		 * @param {string} operator
		 * @param {'fast' | 'golden' | 'slow'} zone
		 */
		record(operator, zone) {
			const key = opKey(operator);
			let pts = Number(points[key]) || 100;
			if (zone === 'fast') pts += 10;
			else if (zone === 'slow' && penaltiesThisQuestion < 4) {
				pts -= 15;
				penaltiesThisQuestion++;
			}
			points[key] = Math.max(0, Math.min(999, pts));
			skills[key] = Math.floor(points[key] / 200) + 1;
			save();
			return stage();
		},

		/** The round starts over (resetGame()). */
		resetRound() {
			penaltiesThisQuestion = 0;
		}
	};
}
