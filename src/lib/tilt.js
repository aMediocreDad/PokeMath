// How far the device is tilted, for the shiny foil. Off unless switched on in the profile, as
// Safari asks before it hands over the tilt; the choice belongs to the device (DEVICE_KEYS). One
// deviceorientation listener for every mounted Foil, attached only while there is one. Each frame
// the tilt is written as --tilt and --tilt-y on the registered foil layers alone: on the page's
// root it would restyle the whole "Alle arter" grid. The tilt is measured from a resting angle
// that slowly follows the device, so an iPad lying flat or held at 45° both start at the middle,
// and it is clamped to ±RANGE degrees each way, mapped to -1..1.

export const TILT_KEY = 'foilTilt';
const RANGE = 10;
// How much of the gap to the current angle the resting angle closes per event: about two seconds
// to settle at the 60 events a second iOS sends.
const FOLLOW = 0.01;

/** @type {Set<HTMLElement>} */
const layers = new Set();
/** @type {{ x: number, y: number } | null} */
let rest = null;
let tilt = { x: 0, y: 0 };
let frame = 0;
let listening = false;

/** @param {DeviceOrientationEvent} e */
function onOrientation(e) {
	if (e.beta == null || e.gamma == null) return;
	// beta tilts front to back, gamma side to side, both measured against the device held upright.
	// Turned into landscape, the screen's left-right is the device's front-back.
	const angle = screen.orientation?.angle ?? 0;
	const [x, y] = angle === 90 ? [e.beta, -e.gamma] : angle === 270 ? [-e.beta, e.gamma] : angle === 180 ? [-e.gamma, -e.beta] : [e.gamma, e.beta];
	if (!rest) {
		rest = { x, y };
		document.documentElement.dataset.tilt = '';
	}
	rest.x += (x - rest.x) * FOLLOW;
	rest.y += (y - rest.y) * FOLLOW;
	const clamp = (/** @type {number} */ t) => Math.max(-1, Math.min(1, t / RANGE));
	tilt = { x: clamp(x - rest.x), y: clamp(y - rest.y) };
	frame ||= requestAnimationFrame(write);
}

function write() {
	frame = 0;
	for (const layer of layers) show(layer);
}

/** @param {HTMLElement} layer */
function show(layer) {
	layer.style.setProperty('--tilt', tilt.x.toFixed(3));
	layer.style.setProperty('--tilt-y', tilt.y.toFixed(3));
}

function listen() {
	if (listening || layers.size === 0 || !tiltOn() || !('DeviceOrientationEvent' in window)) return;
	listening = true;
	addEventListener('deviceorientation', onOrientation);
}

function stop() {
	listening = false;
	removeEventListener('deviceorientation', onOrientation);
	rest = null;
	delete document.documentElement.dataset.tilt;
	for (const layer of layers) {
		layer.style.removeProperty('--tilt');
		layer.style.removeProperty('--tilt-y');
	}
}

/**
 * Register a foil layer to follow the tilt; returns its unregister.
 * @param {HTMLElement} layer
 */
export function followTilt(layer) {
	layers.add(layer);
	listen();
	if (rest) show(layer);
	return () => {
		layers.delete(layer);
		if (layers.size === 0) stop();
	};
}

/** Whether the foil follows the tilt on this device. */
export const tiltOn = () => localStorage.getItem(TILT_KEY) === 'on';

/** Whether this device can report its tilt at all: a phone or tablet. */
export const canTilt = () => 'DeviceOrientationEvent' in window && matchMedia('(pointer: coarse)').matches;

/** Whether this browser makes the page ask before it gets the tilt: Safari on iPhone and iPad. */
const needsAsking = () => typeof (/** @type {any} */ (globalThis.DeviceOrientationEvent))?.requestPermission === 'function';

/**
 * Switch following the tilt on or off. Must run inside a tap: switching it on asks Safari, which
 * refuses without asking otherwise. Resolves to whether it is on.
 * @param {boolean} on
 */
export async function setTilt(on) {
	if (on && needsAsking()) {
		const answer = await /** @type {any} */ (DeviceOrientationEvent).requestPermission().catch(() => 'denied');
		if (answer !== 'granted') on = false;
	}
	if (on) localStorage.setItem(TILT_KEY, 'on');
	else localStorage.removeItem(TILT_KEY);
	if (on) listen();
	else stop();
	return on;
}

let asked = false;
/**
 * Ask Safari again, once a page load, if the tilt is switched on but no tilt has come: Safari may
 * forget the answer between visits. Must run inside a tap.
 */
export function askAgainForTilt() {
	if (asked || rest || !tiltOn() || !needsAsking()) return;
	asked = true;
	/** @type {any} */ (DeviceOrientationEvent).requestPermission().catch(() => {});
}
