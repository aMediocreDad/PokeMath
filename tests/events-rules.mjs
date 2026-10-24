// The Christmas calendar's and the spring event's rules (src/lib/game/xmasCalendar.js, eventClock.js,
// springEvent.js) without a browser. Usage: node tests/events-rules.mjs
import { fakeTime } from '../src/lib/game/eventClock.js';
import { GLOBAL_PRIZES, GLOBAL_STEP, LOCAL_PRIZES, LOCAL_STEP, SEG_COUNT, markClaimed, springWindow, readCaught, readClaimed, readTimestamps, startYear as startSpringYear } from '../src/lib/game/springEvent.js';
import { BONUS_ENTRIES, GRID, doorReward, readOpened, recordOpened, startYear } from '../src/lib/game/xmasCalendar.js';

let failed = 0;
const check = (name, ok, detail = '') => {
	console.log(ok ? 'PASS' : 'FAIL', name, detail);
	if (!ok) failed++;
};

/** A localStorage that lives in memory. @param {Record<string, string>} [start] */
const store = (start = {}) => {
	const data = new Map(Object.entries(start));
	return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, String(v)), data };
};

// ---- ?date= -----------------------------------------------------------------------------------
const noonOn = (y, m, d) => new Date(y, m - 1, d, 12).getTime();
check('?date= is honoured on localhost, at noon', fakeTime('?date=2026-12-10', 'localhost') === noonOn(2026, 12, 10));
check('?date= takes a time of day', fakeTime('?date=2026-04-30T23:59', '127.0.0.1') === new Date(2026, 3, 30, 23, 59).getTime());
check('?date= is ignored anywhere else', fakeTime('?date=2026-12-10', 'pokemath.online') === null && fakeTime('?date=2026-12-10', 'localhost.evil.no') === null);
check('?date= must be a real date', ['', '?date=x', '?date=2026-02-31', '?date=2026-13-01', '?date=2026-1-1'].every((q) => fakeTime(q, 'localhost') === null));

// ---- the doors ----------------------------------------------------------------------------------
check('the picture has all 24 doors once', [...GRID].sort((a, b) => a - b).join() === Array.from({ length: 24 }, (_, i) => i + 1).join());
const gives = (day, owned = []) => doorReward(day, owned);
check('a Pokémon door gives the Pokémon and 1000 coins', gives(1).entry === 'N225-C1' && gives(1).coins === 1000 && gives(16).entry === 'N896-C1');
check('doors 7, 14 and 21 give coins only', [7, 14, 21].every((d) => !gives(d).entry && !gives(d).background) && gives(7).coins === 20000 && gives(14).coins === 30000 && gives(21).coins === 50000);
check('door 17 gives its background once, then 100 000 coins', gives(17).background === 'bg-020' && gives(17).coins === 0 && gives(17, ['bg-020']).background === null && gives(17, ['bg-020']).coins === 100000);
check('door 24 gives its background once, then 500 000 coins', gives(24).background === 'bg-019' && gives(24, ['bg-019']).coins === 500000 && gives(24, ['bg-019']).background === null);
check('every door has a message, an image and a prize', GRID.every((d) => gives(d).message.startsWith(`Luke ${d} `) && gives(d).image.startsWith('/images/') && (gives(d).coins || gives(d).background)));
check('the last door adds four shinies', BONUS_ENTRIES.length === 4 && BONUS_ENTRIES.every((e) => e.startsWith('S')));

// ---- what the save holds -------------------------------------------------------------------------
check('no key: no doors opened', readOpened(store()).length === 0);
check('the array as the legacy page wrote it', readOpened(store({ xmasOpened: '[1,3,5]' })).join() === '1,3,5');
check('the array double-encoded by a backup restore', readOpened(store({ xmasOpened: '"[1,3,5]"' })).join() === '1,3,5');
check('a broken value is no doors', readOpened(store({ xmasOpened: '[1,3' })).length === 0 && readOpened(store({ xmasOpened: 'null' })).length === 0 && readOpened(store({ xmasOpened: '{"a":1}' })).length === 0);
check('only doors 1-24, once each', readOpened(store({ xmasOpened: '[1,1,0,25,"7",2.5,"x"]' })).join() === '1,7');

{
	const save = store({ xmasOpened: '"[1,3]"' });
	check('a door is recorded as a plain JSON array', recordOpened(save, 5) && save.data.get('xmasOpened') === '[1,3,5]');
	check('a door already opened is not recorded, so not paid, again', !recordOpened(save, 3) && save.data.get('xmasOpened') === '[1,3,5]');
}

// ---- a new year ----------------------------------------------------------------------------------
{
	const old = store({ xmasYear: '2025', xmasOpened: '[1,2,3,5,24]' });
	check('a new year starts over', startYear(old, 2026) && old.data.get('xmasYear') === '2026');
	check('a new year opens no door, not even door 1 of the old ones', old.data.get('xmasOpened') === '[]' && readOpened(old).length === 0, old.data.get('xmasOpened'));
	const same = store({ xmasYear: '2026', xmasOpened: '[1,2]' });
	check('the same year keeps its doors', !startYear(same, 2026) && same.data.get('xmasOpened') === '[1,2]');
	const quoted = store({ xmasYear: '"2026"', xmasOpened: '"[1,2]"' });
	check('a year kept in quotes (a restored backup) is the same year', !startYear(quoted, 2026) && quoted.data.get('xmasOpened') === '"[1,2]"');
	const none = store({ xmasOpened: '[4]' });
	check('doors with no year saved start over too', startYear(none, 2026) && none.data.get('xmasOpened') === '[]');
	check('the year is checked once: asking again changes nothing', !startYear(old, 2026) && old.data.get('xmasOpened') === '[]');
}

// ---- the spring event ------------------------------------------------------------------------------
{
	const at = (y, m, d, h = 12, min = 0, sec = 0) => new Date(y, m - 1, d, h, min, sec).getTime();
	const w26 = springWindow(at(2026, 4, 20));
	check('the event is March and April of the year', w26.year === 2026 && w26.start === at(2026, 3, 1, 0) && w26.end === at(2026, 4, 30, 23, 59, 59));
	check('next year\'s event ends on 30 April next year', springWindow(at(2027, 4, 20)).end === at(2027, 4, 30, 23, 59, 59));
	check('the window follows the year of the moment, at both ends of the year', springWindow(at(2026, 12, 31, 23, 59)).year === 2026 && springWindow(at(2027, 1, 1, 0, 0, 1)).year === 2027);
}
check('ten prizes on each bar, steps of 50 and 150 000', LOCAL_PRIZES.length === SEG_COUNT && GLOBAL_PRIZES.length === SEG_COUNT && LOCAL_STEP === 50 && GLOBAL_STEP === 150_000);
{
	const save = store({ easterYear: '2026', easterCaught: '175', easterClaimed: '[0,1]', easterLocalTs: '{"1":5}' });
	check('this year\'s save is read as it is', readCaught(save) === 175 && readClaimed(save, 'easterClaimed').join() === '0,1' && readTimestamps(save)[1] === 5);
	check('a broken list is no prizes taken', readClaimed(store({ easterClaimed: 'x' }), 'easterClaimed').length === 0 && readClaimed(store({ easterClaimed: '{"a":1}' }), 'easterClaimed').length === 0 && readClaimed(store(), 'easterClaimed').length === 0);
	check('broken times are none', Object.keys(readTimestamps(store({ easterLocalTs: '[1]' }))).length === 0 && Object.keys(readTimestamps(store({ easterLocalTs: 'x' }))).length === 0);
	check('a prize is written down once, so it is paid once', markClaimed(save, 'easterClaimed', 2) && !markClaimed(save, 'easterClaimed', 2) && !markClaimed(save, 'easterClaimed', 0) && save.data.get('easterClaimed') === '[0,1,2]');
	check('the three lists are kept apart', markClaimed(save, 'easterGlobalClaimed', 0) && markClaimed(save, 'easterExtraClaimed', 0) && save.data.get('easterClaimed') === '[0,1,2]');
	check('the same year changes nothing', !startSpringYear(save, 2026) && readCaught(save) === 175);
}

process.exit(failed ? 1 : 0);
