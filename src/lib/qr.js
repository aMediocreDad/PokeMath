// QR codes drawn in the browser, so the link they hold is never sent to an outside service.
import QRCode from 'qrcode';

/**
 * A PNG data URL of a QR code for `text`.
 * @param {string} text
 * @param {number} size  width and height in pixels
 */
export const qrDataUrl = (text, size) => QRCode.toDataURL(text, { width: size, margin: 2 });
