// Fire-and-forget analytics, the same endpoints trackEvent() in static/global.js posts to.

/**
 * @param {string} endpoint
 * @param {Record<string, unknown>} data
 */
export function trackEvent(endpoint, data) {
	fetch(endpoint, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data),
		keepalive: true
	}).catch(() => {});
}
