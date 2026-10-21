// Toast notifications and prize pop-ups, rendered and styled by Toaster.svelte.

/** @typedef {{ id: number, text: string, bad: boolean, canClose: boolean }} ToastItem */

/** @type {ToastItem[]} */
export const toasts = $state([]);

let nextId = 1;

/**
 * @param {string} text
 * @param {{ bad?: boolean, canClose?: boolean }} [options]
 */
export function toast(text, { bad = false, canClose = true } = {}) {
	toasts.push({ id: nextId++, text, bad, canClose });
}

/** @param {number} id */
export function dismissToast(id) {
	const index = toasts.findIndex((t) => t.id === id);
	if (index >= 0) toasts.splice(index, 1);
}

// Badge unlocks and similar big announcements, shown in #notification-container for 8 seconds.

/** @typedef {{ id: number, image: string, text: string }} Notification */

/** @type {Notification[]} */
export const notifications = $state([]);

/**
 * @param {string} image
 * @param {string} text
 */
export function notify(image, text) {
	const id = nextId++;
	notifications.push({ id, image, text });
	setTimeout(() => {
		const index = notifications.findIndex((n) => n.id === id);
		if (index >= 0) notifications.splice(index, 1);
	}, 8000);
}
