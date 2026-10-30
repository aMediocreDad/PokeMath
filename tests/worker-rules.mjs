// The Worker's small rules that need no server: where a login attempt counts from, which year's
// spring event a catch belongs to, which tokens Access may sign with, how big a body may be, and
// which files are served without a login.
// Usage: node tests/worker-rules.mjs
import { createServer } from 'http';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { accessEmail } from '../worker/auth.js';
import { eventName } from '../worker/core.js';
import { cappedBody } from '../worker/http.js';
import { origin, route } from '../worker/login.js';

let failed = 0;
const check = (name, ok, detail = '') => {
	console.log(ok ? 'PASS' : 'FAIL', name, detail);
	if (!ok) failed++;
};

const from = (ip) => origin(new Request('http://localhost/', { headers: { 'CF-Connecting-IP': ip } }));

check('an IPv4 address counts as itself', from('10.1.1.1') === '10.1.1.1');
check('a missing address counts as local', origin(new Request('http://localhost/')) === 'local');
for (const mapped of ['::ffff:10.1.1.1', '::FFFF:10.1.1.1', '0:0:0:0:0:ffff:10.1.1.1', '::ffff:a01:101', '::ffff:0a01:0101', '0:0:0:0:0:ffff:a01:101']) {
	check(`${mapped} counts as 10.1.1.1`, from(mapped) === '10.1.1.1', from(mapped));
}
check('another mapped address counts as its own', from('::ffff:10.1.1.2') === '10.1.1.2' && from('::ffff:255.255.255.255') === '255.255.255.255');
check('an IPv6 address counts by its /64', from('2001:db8:1:2:aaaa::1') === '2001:db8:1:2::/64' && from('2001:db8:1:2:bbbb:cccc:dddd:eeee') === '2001:db8:1:2::/64');
check('another /64 is another bucket', from('2001:db8:1:3::1') === '2001:db8:1:3::/64' && from('2001:db8::1') === '2001:db8:0:0::/64');
check('IPv6 in capitals counts with the same /64', from('2001:DB8:1:2::1') === '2001:db8:1:2::/64');
check('the loopback and the unspecified address stay in their /64', from('::1') === '0:0:0:0::/64' && from('::') === '0:0:0:0::/64');
check('a ::ffff: look-alike with other leading groups is IPv6', from('1::ffff:10.1.1.1') === '1:0:0:0::/64' && from('::1:ffff:a01:101') === '0:0:0:0::/64');

// The spring event restarts on 1 January, Oslo time. 2026's counter was made before the year
// was part of the name and keeps the plain one.
check('2026 keeps the original name', eventName(new Date('2026-04-05T12:00:00Z')) === 'easter' && eventName(new Date('2026-10-24T08:00:00Z')) === 'easter');
check('the last second of 2026 in Oslo is 2026', eventName(new Date('2026-12-31T22:59:59Z')) === 'easter');
check('the first second of 2027 in Oslo is 2027', eventName(new Date('2026-12-31T23:00:00Z')) === 'easter-2027');
check('every later year has its own counter', eventName(new Date('2027-04-10T12:00:00Z')) === 'easter-2027' && eventName(new Date('2028-04-16T12:00:00Z')) === 'easter-2028');

// Access signs with RS256; a token another algorithm signed is not Access's, whatever key it names.
const rs = await generateKeyPair('RS256', { extractable: true });
const ps = await generateKeyPair('PS256', { extractable: true });
const jwks = { keys: [{ ...(await exportJWK(rs.publicKey)), kid: 'rs' }, { ...(await exportJWK(ps.publicKey)), kid: 'ps' }] };
const server = createServer((req, res) => {
	res.setHeader('Content-Type', 'application/json');
	res.end(JSON.stringify(jwks));
}).listen(0);
await new Promise((resolve) => server.once('listening', resolve));
const TEAM_DOMAIN = `http://localhost:${/** @type {import('net').AddressInfo} */ (server.address()).port}`;
const env = { TEAM_DOMAIN, POLICY_AUD: 'aud' };
const url = new URL('http://pokemath.test/login/email');
const sign = (alg, key, kid, audience = 'aud') =>
	new SignJWT({ email: 'Lærer@Skole.no' }).setProtectedHeader({ alg, kid }).setIssuer(TEAM_DOMAIN).setAudience(audience).setExpirationTime('5m').sign(key);
const verified = async (token) => accessEmail(new Request(url, { headers: { 'cf-access-jwt-assertion': token } }), /** @type {any} */ (env), url);

check('an RS256 token from Access gives the email, in lower case', (await verified(await sign('RS256', rs.privateKey, 'rs'))) === 'lærer@skole.no');
check('a token for another audience gives nothing', (await verified(await sign('RS256', rs.privateKey, 'rs', 'annen'))) === null);
check('a token signed with PS256 gives nothing', (await verified(await sign('PS256', ps.privateKey, 'ps'))) === null);
server.close();

// A body over its cap is refused before it is read in full, with or without a Content-Length.
const post = (body, headers = {}) => new Request('http://localhost/', { method: 'POST', body, headers });
const stream = (text, size) => {
	const bytes = new TextEncoder().encode(text);
	return new ReadableStream({
		start(c) {
			for (let i = 0; i < bytes.length; i += size) c.enqueue(bytes.slice(i, i + size));
			c.close();
		},
	});
};
check('a small JSON body is read', (await cappedBody(post('{"a":1}'), 100))?.a === 1);
check('a body of exactly the cap is read', (await cappedBody(post('{"a":"xxxx"}'), 12))?.a === 'xxxx');
check('a body one byte over the cap is refused', (await cappedBody(post('{"a":"xxxxx"}'), 12)) === null);
check('the cap counts bytes, not letters', (await cappedBody(post('{"a":"ææææ"}'), 12)) === null);
check('a broken, null or empty body is {}', JSON.stringify([await cappedBody(post('nope'), 100), await cappedBody(post('null'), 100), await cappedBody(post(''), 100)]) === '[{},{},{}]');
check('a streamed body over the cap is refused', (await cappedBody(new Request('http://localhost/', { method: 'POST', body: stream(`{"a":"${'x'.repeat(5000)}"}`, 512), duplex: 'half' }), 1000)) === null);
check('a streamed body under the cap is read', (await cappedBody(new Request('http://localhost/', { method: 'POST', body: stream('{"a":1}', 2), duplex: 'half' }), 1000))?.a === 1);

// Only the privacy page, its stylesheets and fonts, and the Home Screen icons open without a login.
// Everything else falls through to the session check (null here).
const assets = { fetch: async () => new Response('file') };
const open = async (path, method = 'GET') => (await route(new URL(`https://pokemath.amediocre.dad${path}`), new Request(`https://pokemath.amediocre.dad${path}`, { method }), { ASSETS: assets })) !== null;
for (const path of ['/personvern.html', '/_app/immutable/assets/0.BVO8wiSD.css', '/_app/immutable/assets/lilita-one-latin-400-normal.Bx1RKZ2h.woff2', '/fonts/source-sans-pro-400.woff2', '/favicon.ico', '/manifest.webmanifest']) {
	check(`${path} opens without a login`, await open(path));
}
for (const path of ['/', '/index.html', '/about.html', '/dpa.html', '/dex.html', '/lærer/index.html', '/api/me', '/_app/immutable/chunks/4FORCyyN.js', '/_app/immutable/entry/start.js', '/_app/version.json', '/images/player.png', '/personvern.html/../index.html', '/personvern.htmlx', '/_app/immutable/assets/x.js']) {
	check(`${path} needs a login`, !(await open(path)));
}
check('the privacy page opens only to GET', !(await open('/personvern.html', 'POST')));

process.exit(failed ? 1 : 0);
