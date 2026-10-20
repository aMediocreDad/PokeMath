// The "Arbeidsoversikt" (work overview): solved problems per day and stage, stored under
// 'mathProblems' as { "YYYY-MM-DD": { [stage]: count } }. Ported from static/math.js.

function today() {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** @returns {Record<string, Record<string, number>>} */
function read() {
	return JSON.parse(localStorage.getItem('mathProblems') || '{}');
}

/**
 * saveData() from math.js: count one solved problem for today.
 * @param {string | number} stage
 */
export function logSolved(stage) {
	const data = read();
	const date = today();
	data[date] ??= {};
	data[date][stage] = (data[date][stage] || 0) + 1;
	localStorage.setItem('mathProblems', JSON.stringify(data));
}

/**
 * @param {number} year
 * @param {number} month
 */
function isOlderThanOneMonth(year, month) {
	const now = new Date();
	const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
	return new Date(year, month - 1, 1) < lastMonth;
}

/**
 * fetchDataForPeriod() from math.js: totals for today, this week and this month.
 * Like the original, it also deletes entries older than a month.
 */
export function workOverview() {
	const now = new Date();
	const date = today();
	const data = read();

	/** @type {Record<'today' | 'week' | 'month', Record<string, number>>} */
	const levels = { today: {}, week: {}, month: {} };

	const dayOfWeek = now.getDay();
	const startOfWeek = new Date(now);
	startOfWeek.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
	const endOfWeek = new Date(startOfWeek);
	endOfWeek.setDate(startOfWeek.getDate() + 6);

	for (const day in data) {
		const [year, month, dayOfMonth] = day.split('-').map(Number);
		const dataDate = new Date(year, month - 1, dayOfMonth);
		for (const level in data[day]) {
			const count = data[day][level];
			if (now.getMonth() === dataDate.getMonth() && now.getFullYear() === dataDate.getFullYear()) {
				levels.month[level] = (levels.month[level] || 0) + count;
			}
			if (dataDate >= startOfWeek && dataDate <= endOfWeek) {
				levels.week[level] = (levels.week[level] || 0) + count;
			}
			if (day === date) {
				levels.today[level] = (levels.today[level] || 0) + count;
			}
		}
	}

	for (const day in data) {
		const [year, month] = day.split('-').map(Number);
		if (isOlderThanOneMonth(year, month)) delete data[day];
	}
	localStorage.setItem('mathProblems', JSON.stringify(data));

	return levels;
}
