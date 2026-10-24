// Bingo's rules in worker/bingo.js without a server: which games an End still pays, what a catch
// message may say, and what a prize counts. The Worker runtime is stubbed, as its module is only
// there inside workerd. Usage: node tests/bingo-rules.mjs
import { register } from 'node:module';

register(
	'data:text/javascript,' +
		encodeURIComponent(`export function resolve(specifier, context, next) {
			if (specifier === 'cloudflare:workers') return { url: 'data:text/javascript,export class DurableObject {}', shortCircuit: true };
			return next(specifier, context);
		}`)
);
const { catchFacts, computePrize, unfinished } = await import('../worker/bingo.js');
const { MAX_PAID_ANSWERS, MAX_PAID_CATCHES, isUuid, paidCount, playerOf } = await import('../worker/players.js');
const { raidPrizes } = await import('../worker/raid.js');
const { memoryPrizes } = await import('../worker/memory.js');

let failed = 0;
const check = (name, ok, detail = '') => {
	console.log(ok ? 'PASS' : 'FAIL', name, detail);
	if (!ok) failed++;
};

// Who counts as a child.
check('a uuid is an id', isUuid(crypto.randomUUID()) && isUuid('00000000-0000-4000-8000-00000000d3c5'));
check('prototype keys and junk are not ids', ['__proto__', 'constructor', 'toString', '', 'a', null, undefined, 5, ['x']].every((v) => !isUuid(v)));
const room = { players: { 'ab': { name: 'A' } } };
check('only a child who is in the room is found', playerOf(room, 'ab')?.name === 'A' && !playerOf(room, '__proto__') && !playerOf(room, 'constructor') && !playerOf(room, 'toString') && !playerOf(room, ['ab']));
check('looking never touches Object.prototype', !('catchCount' in Object.prototype));

// Which games an End still pays.
const bingo = (extra = {}) => ({ code: 'ABCDEF', settings: {}, players: {}, phase: 'play', locked: false, ...extra });
check('a bingo that is being played is unfinished', unfinished(bingo()));
check('a bingo from before the lobby existed (no phase) is too', unfinished(bingo({ phase: undefined })));
check('a bingo still in the lobby is not: nobody can have caught anything', !unfinished(bingo({ phase: 'lobby' })));
check('a bingo whose prize was handed out is not', !unfinished(bingo({ locked: true })));
check('a game that has paid is not, however it ended', !unfinished(bingo({ awarded: true })) && !unfinished({ kind: 'raid', phase: 'fight', awarded: true }));
check('a raid being fought and a memory game being played are', unfinished({ kind: 'raid', phase: 'fight' }) && unfinished({ kind: 'memory', phase: 'play' }));
check('a raid or memory game that is won or waiting is not', !unfinished({ kind: 'raid', phase: 'won' }) && !unfinished({ kind: 'raid', phase: 'lobby' }) && !unfinished({ kind: 'memory', phase: 'won' }));

// What a catch message may say.
const facts = catchFacts({ pokemonCode: 'S25-1', pokedexId: 150, pokemonName: 'Pikachu', difficulty: 'stage3', types: ['electric'], flags: { shiny: true, mega: 'yes', evil: true } });
check('the Pokémon is the one in the code, whatever the message says', facts?.pokedexId === 25 && facts.pokemonCode === 'S25-1');
check('flags are the known ones, true or false', facts && Object.keys(facts.flags).join() === 'shiny,mega,gmax,hisuian,alolan,legendary,mythic' && facts.flags.shiny === true && facts.flags.mega === false);
check('event forms and alternate forms parse', catchFacts({ pokemonCode: 'N25-H1' })?.pokedexId === 25 && catchFacts({ pokemonCode: 'N1025' })?.pokedexId === 1025 && catchFacts({ pokemonCode: 'n7' })?.pokedexId === 7);
check('a code that is not a Pokémon is refused', ['', 'N0', 'N1026', 'N-1', 'garbage', 'N25-', 'N25 ', 'X25', 'N12345', 'N25-ABCDEFGHI', null, 5, {}].every((c) => catchFacts({ pokemonCode: c }) === null));
const big = catchFacts({ pokemonCode: 'N25', pokemonName: 'x'.repeat(1e5), difficulty: 'y'.repeat(1e5), types: Array(500).fill('z'.repeat(1e3)) });
check('long text is cut down', big && big.pokemonName.length === 40 && big.difficulty.length === 12 && big.types.length === 4 && big.types.every((t) => t.length === 20));
check('what is not a list or an object is harmless', catchFacts({ pokemonCode: 'N25', types: 'fire', flags: 'shiny' })?.types.length === 0);

// What a prize counts.
const kids = (count) => ({ a: { uuid: 'a', catchCount: count }, b: { uuid: 'b', catchCount: count }, c: { uuid: 'c', catchCount: 0 } });
const prize = (prizeType, players) => computePrize({ board: { difficulty: 'easy' }, totalCatches: 10 ** 6, settings: { prizeType }, players });
check('per catch pays 50 a catch', prize('per_catch_coins', kids(10)).perPlayer({ catchCount: 10 })[0].amount === 500);
check(`per catch pays for at most ${MAX_PAID_CATCHES} catches from one child`, prize('per_catch_coins', kids(1e6)).perPlayer({ catchCount: 1e6 })[0].amount === 50 * MAX_PAID_CATCHES);
const pot = (count) => prize('participation_coins', kids(count)).prize.pot;
check('the pot is 2000 a child and 50 a catch', pot(10) === 2000 * 3 + 50 * 20);
check('…and a child adds at most the catches a child can make, however many the room counted', pot(1e6) === 2000 * 3 + 50 * 2 * MAX_PAID_CATCHES);
check('a raid and a memory game pay 25 a hit, up to the most a child can answer', raidPrizes({ phase: 'fight' }, { catchCount: 4 })[0].amount === 100 && raidPrizes({ phase: 'fight' }, { catchCount: 1e6 })[0].amount === 25 * MAX_PAID_ANSWERS && memoryPrizes({ phase: 'play', found: [] }, { catchCount: 1e6 })[0].amount === 25 * MAX_PAID_ANSWERS);
check('a count that is not a number pays nothing', paidCount(NaN, 5) === 0 && paidCount(-3, 5) === 0 && paidCount(undefined, 5) === 0);

process.exit(failed ? 1 : 0);
