// The memory game's rules (worker/memory.js) without a server: turns, the turn store, flips.
// Usage: node tests/memory-rules.mjs
import { answer, flip, memoryPrizes, memoryState, newMemory, startMemory } from '../worker/memory.js';
import { MAX_TURNS } from '../src/lib/memoryConfig.js';

let failed = 0;
const check = (name, ok) => {
	console.log(ok ? 'PASS' : 'FAIL', name);
	if (!ok) failed++;
};

const room = newMemory({ size: 'large' }, 'ABCDEF');
check('a large board has 20 cards in 10 pairs', room.cards.length === 20 && new Set(room.cards.map((c) => c.id)).size === 10);
check('an unknown size is medium', newMemory({ size: 'huge' }, 'X').cards.length === 16);
room.players = Object.fromEntries(['a', 'b', 'c'].map((uuid) => [uuid, { uuid, name: uuid, catchCount: 0 }]));
check('no answers in the lobby', !answer(room, 'a', 10_000));
startMemory(room);
check('a turn costs one answer per child', room.turnCost === 3 && room.turns === 1);
check('an unknown child does not count', !answer(room, 'zz', 10_000));
check('"__proto__" and "constructor" are no children', !answer(room, '__proto__', 10_000) && !answer(room, 'constructor', 10_000) && !('lastHit' in Object.prototype) && room.pool === 0);
check('an answer counts', answer(room, 'a', 10_000) && room.pool === 1);
check('a second answer within a second does not', !answer(room, 'a', 10_500));

let t = 20_000;
for (let i = 0; i < 20; i++) for (const uuid of ['a', 'b', 'c']) answer(room, uuid, (t += 1000));
check(`the class saves up at most ${MAX_TURNS} turns`, room.turns === MAX_TURNS && room.pool === 0);
check('answers beyond that still count for coins', room.players.a.catchCount === 21);

const first = room.cards[0].id;
const twin = room.cards.findIndex((c, i) => i > 0 && c.id === first);
const other = room.cards.findIndex((c) => c.id !== first);
check('the first card opens', flip(room, 0) === 'first' && room.turns === MAX_TURNS);
check('the same card cannot open twice', flip(room, 0) === null);
check('a different Pokémon is a miss and spends the turn', flip(room, other) === 'miss' && room.turns === MAX_TURNS - 1);
check('both stay face up after a miss', memoryState(room).cards[0].id === first && memoryState(room).cards[other].id !== null);
check('the next flip turns them back over', flip(room, twin) === 'first' && memoryState(room).cards[other].id === null);
check('the twin is a match', flip(room, 0) === 'match' && room.cards[0].matched && room.found[0] === first);
check('a matched card cannot be flipped', flip(room, 0) === null);
check('a bad index is refused', flip(room, 99) === null && flip(room, 'x') === null && flip(room, 1.5) === null);

room.turns = 0;
const closed = room.cards.findIndex((c) => !c.matched);
check('no turn, no flip', flip(room, closed) === null);

const prizes = memoryPrizes(room, room.players.a);
check('a child gets a Pokémon from the found pairs and coins', prizes[0].pokedexId === first && prizes[1].amount === 25 * 21);

// Solve the rest of the board.
room.turns = 99;
for (let i = 0; i < room.cards.length; i++) {
	if (room.cards[i].matched) continue;
	const j = room.cards.findIndex((c, k) => k !== i && c.id === room.cards[i].id);
	flip(room, i);
	flip(room, j);
}
check('the last pair wins', room.phase === 'won' && room.found.length === 10);
check('a won board pays the bonus', memoryPrizes(room, room.players.b)[1].amount === 25 * 20 + 1000);
check('no answers after the win', !answer(room, 'a', (t += 5000)));

process.exit(failed ? 1 : 0);
