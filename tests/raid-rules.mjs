// The raid's damage and HP rules (src/lib/raidConfig.js, worker/raid.js) without a server.
// Usage: node tests/raid-rules.mjs
import { readFileSync } from 'fs';
import { AVERAGE_HIT, BOSS_HP, MAX_HIT, RAID_BOSSES, damageFor, raidHp, raidMinutes } from '../src/lib/raidConfig.js';
import { hit, newRaid, startRaid } from '../worker/raid.js';

let failed = 0;
const check = (name, ok, detail = '') => {
	console.log(ok ? 'PASS' : 'FAIL', name, detail);
	if (!ok) failed++;
};

const info = JSON.parse(readFileSync(new URL('../static/pokemon_info.json', import.meta.url), 'utf8'));
const wrong = RAID_BOSSES.filter((id) => BOSS_HP[id] !== info[String(id)]['0'].base_hp);
check('every boss has its base HP from pokemon_info.json', !wrong.length, wrong.join(', '));

check('level 1: the answer counts half again', damageFor(8, 1) === 12 && damageFor(20, 1) === 30);
check('level 2: the answer counts 0.6', damageFor(20, 2) === 12 && damageFor(50, 2) === 30);
check('level 3: the answer is the damage', damageFor(42, 3) === 42);
check('level 4: the answer is divided by 10', damageFor(420, 4) === 42 && damageFor(740, 4) === 50);
check('level 5: the answer is divided by 1000', damageFor(6098, 5) === 6);
check('a zero answer still hits for 1', damageFor(0, 3) === 1 && damageFor(4, 5) === 1);
check('a negative answer hits as hard as the positive one', damageFor(-12, 4) === damageFor(12, 4));
check(`a huge product hits for at most ${MAX_HIT}`, damageFor(972195, 5) === MAX_HIT && damageFor(1e12, 1) === MAX_HIT);
check('decimals round', damageFor(2.6, 3) === 3);
check('a missing answer counts as an average hit', damageFor(undefined, 3) === AVERAGE_HIT && damageFor('abc', 3) === AVERAGE_HIT);
check('an unknown level counts as level 3, a wild one is clamped', damageFor(42, 'x') === 42 && damageFor(4200, 99) === 4);

check('HP is base HP times children times length', raidHp(150, 2, 'short') === 212 && raidHp(487, 25, 'medium') === 7500);
check('at least one child', raidHp(144, 0, 'long') === 315);
check('a tougher boss takes longer', raidMinutes(487, 6) === 9 && raidMinutes(144, 6) === 5 && raidMinutes('random', 6) === 6);

const room = newRaid({ boss: 150, length: 'short' }, 'ABCDEF');
room.players = { a: { uuid: 'a', name: 'A', catchCount: 0 } };
check('no hits in the lobby', hit(room, 'a', 10_000, 42, 3) === 0);
startRaid(room);
check('one child against Mewtwo, short: 106 HP', room.maxHp === 106 && room.hp === 106);
check('a hit does the answer in damage', hit(room, 'a', 20_000, 42, 3) === 42 && room.hp === 64);
check('a second hit within a second does nothing', hit(room, 'a', 20_500, 42, 3) === 0 && room.hp === 64);
check('the child keeps hits and damage', room.players.a.catchCount === 1 && room.players.a.damage === 42);
check('the last hit does only what is left, and wins', hit(room, 'a', 22_000, 50, 3) === 50 && hit(room, 'a', 24_000, 50, 3) === 14 && room.phase === 'won' && room.hp === 0);
check('the recent hits list the damage', room.recent.map((h) => h.damage).join() === '42,50,14');

process.exit(failed ? 1 : 0);
