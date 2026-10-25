// The time the seasonal pages go by (the Christmas calendar and the spring event).
//
// It is the device's clock. So that the pages can be tried on any date, `?date=2026-12-10` (noon)
// or `?date=2026-12-10T08:30` stands in for "now" -- on localhost only, so a child cannot open the
// doors early with a link. The clock still runs from there, which the countdown needs.

const FAKE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/;

/**
 * The moment ?date= stands for, in this device's time zone, or null when it is missing, wrong or
 * not on localhost.
 * @param {string} search  location.search
 * @param {string} hostname
 * @returns {number | null}
 */
export function fakeTime(search, hostname) {
	if (hostname !== 'localhost' && hostname !== '127.0.0.1') return null;
	const match = FAKE.exec(new URLSearchParams(search).get('date') ?? '');
	if (!match) return null;
	const [year, month, day] = [match[1], match[2], match[3]].map(Number);
	const hour = match[4] === undefined ? 12 : Number(match[4]);
	const minute = match[5] === undefined ? 0 : Number(match[5]);
	const time = new Date(year, month - 1, day, hour, minute);
	// 2026-02-31 and 2026-13-01 roll over to another date: not a date.
	if (time.getFullYear() !== year || time.getMonth() !== month - 1 || time.getDate() !== day) return null;
	return time.getTime();
}

/**
 * A clock for one page view. Read it from onMount: the prerendered page has no location.
 * @param {Pick<Location, 'search' | 'hostname'>} [place]
 */
export function eventClock(place = location) {
	const fake = fakeTime(place.search, place.hostname);
	const offset = fake === null ? 0 : fake - Date.now();
	return { fake: fake !== null, now: () => Date.now() + offset };
}
