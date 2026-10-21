// Math problems, ported from static/math.js. Behaviour, including the order of Math.random()
// calls, is kept identical so the game plays exactly as before.

/**
 * @typedef {object} MathValues
 * @property {string | number} stage  "1"–"5" from ?stage=, a number in custom mode or as fallback.
 * @property {number} additionMin @property {number} additionMax
 * @property {number} additionMinB @property {number} additionMaxB
 * @property {number} subtractionMin @property {number} subtractionMax
 * @property {number} subtractionMinB @property {number} subtractionMaxB
 * @property {boolean} subAllowNegative
 * @property {number} multiplicationMinA @property {number} multiplicationMaxA
 * @property {number} multiplicationMinB @property {number} multiplicationMaxB
 * @property {number} divisionMin @property {number} divisionMax
 * @property {number} divisionMultiplierMin @property {number} divisionMultiplierMax
 * @property {string[]} operations
 * @property {number} additionDecimals @property {number} subtractionDecimals
 * @property {number} multiplicationDecimals @property {number} divisionDecimals
 */

/** @typedef {{ operator: string, numberOne: number, numberTwo: number }} Problem */

/** @returns {MathValues} */
function defaults() {
	return {
		stage: 3,
		additionMin: 0, additionMax: 10, additionMinB: 0, additionMaxB: 10,
		subtractionMin: 0, subtractionMax: 10, subtractionMinB: 0, subtractionMaxB: 10,
		subAllowNegative: true,
		multiplicationMinA: 0, multiplicationMaxA: 10, multiplicationMinB: 0, multiplicationMaxB: 10,
		divisionMin: 0, divisionMax: 10, divisionMultiplierMin: 0, divisionMultiplierMax: 10,
		operations: ['+', '-', 'x', '/'],
		additionDecimals: 0, subtractionDecimals: 0, multiplicationDecimals: 0, divisionDecimals: 0
	};
}

/** Ranges per stage, from the switch in onLoad(). @type {Record<number, Partial<MathValues>>} */
const STAGES = {
	1: {
		additionMin: 0, additionMax: 10, additionMinB: 0, additionMaxB: 10,
		subtractionMin: 0, subtractionMax: 10, subtractionMinB: 0, subtractionMaxB: 10,
		subAllowNegative: false, operations: ['+', '-']
	},
	2: {
		additionMin: 0, additionMax: 25, additionMinB: 0, additionMaxB: 25,
		subtractionMin: 0, subtractionMax: 25, subtractionMinB: 0, subtractionMaxB: 25,
		subAllowNegative: false, operations: ['+', '-']
	},
	3: {
		additionMin: 0, additionMax: 10, additionMinB: 0, additionMaxB: 10,
		subtractionMin: 0, subtractionMax: 10, subtractionMinB: 0, subtractionMaxB: 10,
		multiplicationMinA: 0, multiplicationMaxA: 10, multiplicationMinB: 0, multiplicationMaxB: 10,
		divisionMin: 1, divisionMax: 10, divisionMultiplierMin: 0, divisionMultiplierMax: 10,
		operations: ['+', '-', 'x', '/']
	},
	4: {
		additionMin: 10, additionMax: 100, additionMinB: 10, additionMaxB: 100,
		subtractionMin: 10, subtractionMax: 100, subtractionMinB: 10, subtractionMaxB: 100,
		multiplicationMinA: 10, multiplicationMaxA: 100, multiplicationMinB: 1, multiplicationMaxB: 10,
		divisionMin: 1, divisionMax: 10, divisionMultiplierMin: 1, divisionMultiplierMax: 100,
		operations: ['+', '-', 'x', '/']
	},
	5: {
		additionMin: 1000, additionMax: 10000, additionMinB: 1000, additionMaxB: 10000,
		subtractionMin: 1000, subtractionMax: 10000, subtractionMinB: 1000, subtractionMaxB: 10000,
		multiplicationMinA: 10, multiplicationMaxA: 999, multiplicationMinB: 100, multiplicationMaxB: 999,
		divisionMin: 10, divisionMax: 100, divisionMultiplierMin: 10, divisionMultiplierMax: 1000,
		operations: ['+', '-', 'x', '/']
	}
};

/** @param {unknown} value */
function isInt(value) {
	return (
		!isNaN(/** @type {number} */ (value)) &&
		parseInt(String(Number(value))) == value &&
		!isNaN(parseInt(/** @type {string} */ (value), 10))
	);
}

/**
 * @typedef {object} GameSetup
 * @property {MathValues} values
 * @property {number} winScore  Correct answers needed to catch a Pokémon.
 * @property {boolean} cheated  ?stage= was not a whole number.
 * @property {boolean} custom
 * @property {boolean} [adaptive]  ?adaptive=true: the adaptive level sets the problems (adaptive.js).
 * @property {{ text: string, bad: boolean }[]} messages  Toasts to show.
 */

/**
 * onLoad() from math.js, without the seasonal events: read ?stage= or the custom-mode parameters.
 * @param {URLSearchParams} params
 * @returns {GameSetup}
 */
export function setupGame(params) {
	const values = defaults();
	/** @type {GameSetup['messages']} */
	const messages = [];

	// The adaptive level (live math.js, 2026-10) comes before the other modes and shows no toasts.
	if (params.get('adaptive') === 'true') {
		values.operations = ['+', '-', 'x', '/'];
		return { values, winScore: 5, cheated: false, custom: false, adaptive: true, messages };
	}

	if (params.get('custom') == 'true') {
		values.stage = 3;
		values.operations = [];
		if (params.get('san') == 'f') values.subAllowNegative = false;
		if (params.get('add') == 't') {
			values.additionMin = Number(params.get('amin'));
			values.additionMax = Number(params.get('amax'));
			if (values.additionMin > values.additionMax) [values.additionMin, values.additionMax] = [values.additionMax, values.additionMin];
			values.additionMinB = Number(params.get('aminb'));
			values.additionMaxB = Number(params.get('amaxb'));
			if (values.additionMinB > values.additionMaxB) [values.additionMinB, values.additionMaxB] = [values.additionMaxB, values.additionMinB];
			values.additionDecimals = Number(params.get('adec'));
			values.operations.push('+');
		}
		if (params.get('sub') == 't') {
			values.subtractionMin = Number(params.get('smin'));
			values.subtractionMax = Number(params.get('smax'));
			if (values.subtractionMin > values.subtractionMax) [values.subtractionMin, values.subtractionMax] = [values.subtractionMax, values.subtractionMin];
			values.subtractionMinB = Number(params.get('sminb'));
			values.subtractionMaxB = Number(params.get('smaxb'));
			if (values.subtractionMinB > values.subtractionMaxB) [values.subtractionMinB, values.subtractionMaxB] = [values.subtractionMaxB, values.subtractionMinB];
			values.subtractionDecimals = Number(params.get('sdec'));
			values.operations.push('-');
		}
		if (params.get('mul') == 't') {
			values.multiplicationMinA = Number(params.get('mumina'));
			values.multiplicationMaxA = Number(params.get('mumaxa'));
			values.multiplicationMinB = Number(params.get('muminb'));
			values.multiplicationMaxB = Number(params.get('mumaxb'));
			// The customizer has always written "mudec"; read both so existing links keep working.
			values.multiplicationDecimals = Number(params.get('mudeca') ?? params.get('mudec'));
			values.operations.push('x');
		}
		if (params.get('div') == 't') {
			values.divisionMin = Number(params.get('dmin'));
			values.divisionMax = Number(params.get('dmax'));
			values.divisionMultiplierMin = Number(params.get('dmmin'));
			values.divisionMultiplierMax = Number(params.get('dmmax'));
			values.divisionDecimals = Number(params.get('ddec'));
			values.operations.push('/');
		}
		const { stage, message } = customDifficulty(values);
		values.stage = stage;
		messages.push(message);
		// As in the original, custom mode always needs 5 correct answers.
		return { values, winScore: 5, cheated: false, custom: true, messages };
	}

	let cheated = false;
	/** @type {string | number | null} */
	let stage = params.get('stage');
	if (stage == null || Number(stage) == 0 || Number(stage) > 5 || !isInt(stage)) {
		if (!isInt(stage) && stage != null) {
			messages.push({ text: 'Juksing er jo ikke kult da... Kanskje jeg skal fjerne alt du har gjort?', bad: true });
			cheated = true;
			stage = 5;
		} else {
			stage = 3;
		}
	}
	values.stage = stage;
	Object.assign(values, STAGES[Number(stage)] ?? {});

	const winScore = stage == 4 ? 4 : stage == 5 ? 3 : 5;
	return { values, winScore, cheated, custom: false, messages };
}

/**
 * calculateCustomDifficulty(): the stage (1–5) a custom setup counts as, or 0 if it is too easy.
 * @param {MathValues} v
 */
function customDifficulty(v) {
	/** @type {number[]} */
	const values = [];
	/**
	 * @param {number} size
	 * @param {number[]} limits  Lower bounds for levels 5, 4, 3, 2 and 1.
	 */
	const level = (size, limits) => {
		const index = limits.findIndex((limit) => size > limit);
		return index === -1 ? 0 : 5 - index;
	};
	if (v.operations.includes('+')) {
		const addition = Math.abs(v.additionMaxB - v.additionMinB + (v.additionMax - v.additionMin)) * 10 ** v.additionDecimals;
		values.push(level(addition, [9000, 999, 99, 24, 4]));
	}
	if (v.operations.includes('-')) {
		const subtraction = Math.abs(v.subtractionMaxB - v.subtractionMinB + (v.subtractionMax - v.subtractionMin)) * 10 ** v.subtractionDecimals;
		values.push(level(subtraction, [9000, 999, 99, 24, 2]));
	}
	if (v.operations.includes('x')) {
		const rangeA = Math.abs(v.multiplicationMinA - v.multiplicationMaxA) * 10 ** v.multiplicationDecimals;
		const rangeB = Math.abs(v.multiplicationMinB - v.multiplicationMaxB) * 10 ** v.multiplicationDecimals;
		values.push(level(rangeA * rangeB, [999, 99, 9, 4, 2]));
	}
	if (v.operations.includes('/')) {
		const division = Math.abs(v.divisionMultiplierMax - v.divisionMin) * 10 ** v.divisionDecimals;
		const tooNarrow =
			Math.abs(v.divisionMultiplierMax - v.divisionMultiplierMin) < 2 || Math.abs(v.divisionMax - v.divisionMin) < 2;
		values.push(tooNarrow ? 0 : level(division, [999, 99, 9, 4, 2]));
	}

	if (values.includes(0)) {
		return {
			stage: 0,
			message: {
				text: 'En eller fler av dine egendefinerte valg er for lette, du kan derfor ikke fange pokemon på dette nivået.',
				bad: true
			}
		};
	}
	const average = Math.min(5, Math.max(1, Math.round(values.reduce((a, b) => a + b, 0) / values.length)));
	return { stage: average, message: { text: `Vanskelighetsgraden har blitt kalkulert til nivå ${average}`, bad: false } };
}

/**
 * generateNumber(min, max, decimals): math.js defines it three times; only this last one is used.
 * @param {number} min
 * @param {number} max
 * @param {number} decimals
 */
function generateNumber(min, max, decimals) {
	const num = min + Math.random() * (max - min);
	return Number(num.toFixed(Math.min(decimals, 5)));
}

/** @param {number} number */
function countDecimals(number) {
	if (Math.floor(number.valueOf()) === number.valueOf()) return 0;
	const str = number.toString();
	if (str.indexOf('.') !== -1 && str.indexOf('-') !== -1) return str.split('-')[1] || 0;
	if (str.indexOf('.') !== -1) return str.split('.')[1].length || 0;
	return str.split('-')[1] || 0;
}

/**
 * @param {MathValues} v
 * @returns {Problem}
 */
export function generateProblem(v) {
	const operator = v.operations[Math.floor(Math.random() * v.operations.length)];
	let numberOne = 1;
	let numberTwo = 1;
	switch (operator) {
		case '+':
			numberOne = generateNumber(v.additionMin, v.additionMax, v.additionDecimals);
			numberTwo = generateNumber(v.additionMinB, v.additionMaxB, v.additionDecimals);
			break;
		case '-':
			numberOne = generateNumber(v.subtractionMin, v.subtractionMax, v.subtractionDecimals);
			numberTwo = generateNumber(v.subtractionMinB, v.subtractionMaxB, v.subtractionDecimals);
			break;
		case 'x':
			numberOne = generateNumber(v.multiplicationMinA, v.multiplicationMaxA, v.multiplicationDecimals);
			numberTwo = generateNumber(v.multiplicationMinB, v.multiplicationMaxB, v.multiplicationDecimals);
			break;
		case '/':
			numberOne = generateNumber(v.divisionMultiplierMin, v.divisionMultiplierMax, v.divisionDecimals);
			numberTwo = generateNumber(v.divisionMin, v.divisionMax, v.divisionDecimals);
			if (numberTwo == 0) numberTwo++;
			numberOne = numberOne * numberTwo;
			if (countDecimals(numberOne) != v.divisionDecimals) {
				numberOne = Number(numberOne.toFixed(v.divisionDecimals));
			}
	}
	if (!v.subAllowNegative && operator == '-' && numberOne < numberTwo) {
		[numberOne, numberTwo] = [numberTwo, numberOne];
	}
	return { operator, numberOne, numberTwo };
}

/**
 * The comparison in handleSubmit(): both answers rounded to the operation's decimals.
 * @param {MathValues} v
 * @param {Problem} p
 * @param {number} answer
 */
export function isCorrect(v, p, answer) {
	/** @type {Record<string, [number, number]>} */
	const results = {
		'+': [p.numberOne + p.numberTwo, v.additionDecimals],
		'-': [p.numberOne - p.numberTwo, v.subtractionDecimals],
		x: [p.numberOne * p.numberTwo, v.multiplicationDecimals],
		'/': [p.numberOne / p.numberTwo, v.divisionDecimals]
	};
	const result = results[p.operator];
	if (!result) return false;
	const [exact, decimals] = result;
	const correct = Number(exact.toFixed(decimals));
	return answer == correct || Number(answer.toFixed(decimals)) == correct;
}

/** Coins per correct answer, from addMoney(). @param {string | number} stage */
export function coinsForStage(stage) {
	return /** @type {Record<number, number>} */ ({ 1: 4, 2: 8, 3: 10, 4: 20, 5: 50 })[Number(stage)] ?? 0;
}
