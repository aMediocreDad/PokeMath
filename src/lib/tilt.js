// How far the device is tilted, for the shiny foil. Off unless switched on in the profile, as
// Safari asks before it hands over the tilt; the choice belongs to the device (DEVICE_KEYS). One
// deviceorientation listener for every mounted Foil, attached only while there is one. Each frame
// the tilt is written as --tilt and --tilt-y on the registered foil layers alone: on the page's
// root it would restyle the whole "Alle arter" grid. The tilt is measured from a resting angle
// that slowly follows the device, so an iPad lying flat or held at 45° both start at the middle,
// and it is clamped to ±RANGE degrees each way, mapped to -1..1, then smoothed so a hand's tremor
// does not shake the card.

export const TILT_KEY = 'foilTilt';
// Degrees from the resting angle to the full turn. At 10 a small wobble swung the card end to end.
const RANGE = 25;
// How much of the gap to the new tilt each event closes: about 100 ms to follow a turn.
const SMOOTH = 0.15;
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
/** When the last tilt came, from performance.now(); 0 before the first. */
let lastEvent = 0;

/** @param {DeviceOrientationEvent} e */
function onOrientation(e) {
	if (e.beta == null || e.gamma == null) return;
	lastEvent = performance.now();
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
	tilt.x += (clamp(x - rest.x) - tilt.x) * SMOOTH;
	tilt.y += (clamp(y - rest.y) - tilt.y) * SMOOTH;
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
	armAsking();
}

function stop() {
	listening = false;
	removeEventListener('deviceorientation', onOrientation);
	rest = null;
	tilt = { x: 0, y: 0 };
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
		else refused = false;
	}
	if (on) localStorage.setItem(TILT_KEY, 'on');
	else localStorage.removeItem(TILT_KEY);
	if (on) listen();
	else stop();
	return on;
}

// Safari forgets the answer when the page is opened again (the Home Screen app on every launch), and
// then sends no tilt without saying so; it can only be asked again inside a tap. So while the tilt
// is on and none is coming, the next tap on a card that follows it asks: a tap on the search field
// or a button should not bring up Safari's question. A Cancel stops the asking until the page is
// opened again. A tap is click or touchend: WebKit does not count pointerdown or touchstart. Asking
// again when the answer is still yes shows nothing.
const TAPS = ['click', 'touchend'];
let armed = false;
let refused = false;

/** Whether a tap landed on a card that follows the tilt: a layer, or the window it sits in. */
const onCard = (/** @type {Event} */ e) =>
	e.target instanceof Node && [...layers].some((layer) => layer.contains(/** @type {Node} */ (e.target)) || !!layer.parentElement?.contains(/** @type {Node} */ (e.target)));
/** Whether no tilt has come this load, or none for a second. */
const quiet = () => lastEvent === 0 || performance.now() - lastEvent > 1000;

function armAsking() {
	if (armed || refused || !listening || !needsAsking()) return;
	armed = true;
	for (const type of TAPS) addEventListener(type, askAgain, { capture: true, passive: true });
}

/** @param {Event} e */
function askAgain(e) {
	if (!onCard(e)) return;
	armed = false;
	for (const type of TAPS) removeEventListener(type, askAgain, { capture: true });
	if (!listening || !quiet()) return;
	/** @type {any} */ (DeviceOrientationEvent).requestPermission().then(
		(/** @type {string} */ answer) => answer === 'granted' || (refused = true),
		() => armAsking()
	);
}

// Back from another app or tab: the resting angle starts over, and if the tilt has stopped coming
// the next tap asks again.
const armIfQuiet = () => setTimeout(() => quiet() && armAsking(), 1000);
if (typeof window !== 'undefined') {
	addEventListener('pageshow', () => listening && armIfQuiet());
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState !== 'visible' || !listening) return;
		rest = null;
		armIfQuiet();
	});
}
