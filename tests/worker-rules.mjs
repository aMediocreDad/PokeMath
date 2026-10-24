// The Worker's small rules that need no server: where a login attempt counts from, which year's
// spring event a catch belongs to, which tokens Access may sign with, and how big a body may be.
// Usage: node tests/worker-rules.mjs
import { createServer } from 'http';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { accessEmail } from '../worker/auth.js';
import { origin } from '../worker/login.js';

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

process.exit(failed ? 1 : 0);
