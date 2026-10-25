// The math game's setup and difficulty rating in src/lib/game/problems.js, without a browser:
// a custom level with no operation, and how a custom multiplication or division is rated.
// Usage: node tests/problems-rules.mjs
import { setupGame, generateProblem } from '../src/lib/game/problems.js';

const results = [];
const check = (name, ok, detail = '') => {
	results.push(ok);
	console.log(ok ? 'PASS' : 'FAIL', name, detail);
};
const custom = (query) => setupGame(new URLSearchParams('custom=true&' + query));
const stageOf = (query) => custom(query).values.stage;
const mul = (a0, a1, b0, b1, dec = 0) => `mul=t&mumina=${a0}&mumaxa=${a1}&muminb=${b0}&mumaxb=${b1}&mudec=${dec}`;
const div = (divMin, divMax, quoMin, quoMax, dec = 0) => `div=t&dmin=${divMin}&dmax=${divMax}&dmmin=${quoMin}&dmmax=${quoMax}&ddec=${dec}`;

// No operation switched on: the setup must still be safe to play (the customizer refuses it, but
// a hand-edited link gets here).
{
	const setup = custom('');
	const { values } = setup;
	check('no operation: the stage is a number', Number.isFinite(Number(values.stage)), String(values.stage));
	check('no operation: it earns nothing', Number(values.stage) === 0, String(values.stage));
	check('no operation: something to ask about', values.operations.length > 0, values.operations.join());
	check('no operation: the player is told', setup.messages.length > 0 && setup.messages[0].bad, setup.messages[0]?.text);
	const problem = generateProblem(values);
	check('no operation: a real problem', ['+', '-', 'x', '/'].includes(problem.operator) && Number.isFinite(problem.numberOne) && Number.isFinite(problem.numberTwo), JSON.stringify(problem));
}
// Even with an empty operation list handed straight to the generator.
{
	const values = { ...custom('add=t&amin=0&amax=50&aminb=0&amaxb=50&adec=0').values, operations: [] };
	const problem = generateProblem(values);
	check('an empty operation list still makes a problem', ['+', '-', 'x', '/'].includes(problem.operator), JSON.stringify(problem));
}

// Multiplication is rated from the sizes of the numbers, not from how wide each range is.
check('x 1: too easy', stageOf(mul(0, 10000, 1, 1)) === 0, String(stageOf(mul(0, 10000, 1, 1))));
check('x 0-1: too easy', stageOf(mul(0, 10000, 0, 1)) === 0, String(stageOf(mul(0, 10000, 0, 1))));
check('0-10000 x 1-2 is not level 5', stageOf(mul(0, 10000, 1, 2)) <= 2, String(stageOf(mul(0, 10000, 1, 2))));
check('1-10 x 1-10 is level 3', stageOf(mul(1, 10, 1, 10)) === 3, String(stageOf(mul(1, 10, 1, 10))));
check("stage 4's own multiplication is level 4", stageOf(mul(10, 100, 1, 10)) === 4, String(stageOf(mul(10, 100, 1, 10))));
check("stage 5's own multiplication is level 5", stageOf(mul(10, 999, 100, 999)) === 5, String(stageOf(mul(10, 999, 100, 999))));
check('x 0-1 is too easy, but not with two decimals', stageOf(mul(0, 10, 0, 1)) === 0 && stageOf(mul(0, 10, 0, 1, 2)) > 0, `${stageOf(mul(0, 10, 0, 1))} ${stageOf(mul(0, 10, 0, 1, 2))}`);

// Division is rated from the quotient and the divisor separately.
check('divisor 1-3 with a big quotient is not level 5', stageOf(div(1, 3, 0, 10000)) <= 3, String(stageOf(div(1, 3, 0, 10000))));
check('divisor 1-1 is too easy', stageOf(div(1, 1, 0, 10000)) === 0, String(stageOf(div(1, 1, 0, 10000))));
check("stage 3's own division is level 3", stageOf(div(1, 10, 0, 10)) === 3, String(stageOf(div(1, 10, 0, 10))));
check("stage 4's own division is level 4", stageOf(div(1, 10, 1, 100)) === 4, String(stageOf(div(1, 10, 1, 100))));
check("stage 5's own division is level 5", stageOf(div(10, 100, 10, 1000)) === 5, String(stageOf(div(10, 100, 10, 1000))));
check('a big divisor counts too', stageOf(div(90, 100, 0, 10)) >= 3, String(stageOf(div(90, 100, 0, 10))));

// The normal stages are not rated at all: they are the stage in the link.
for (const [stage, operations, winScore] of [[1, 2, 5], [2, 2, 5], [3, 4, 5], [4, 4, 4], [5, 4, 3]]) {
	const setup = setupGame(new URLSearchParams(`stage=${stage}`));
	check(`stage ${stage} is unchanged`, setup.values.stage == stage && setup.values.operations.length === operations && setup.winScore === winScore && !setup.custom);
}

const failed = results.filter((ok) => !ok).length;
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
