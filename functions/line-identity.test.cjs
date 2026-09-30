const { test } = require('node:test');
const assert = require('node:assert/strict');
const { verifyLineIdentity } = require('./line-identity');
const good = { iss: 'https://access.line.me', aud: '12345', sub: 'U' + 'a'.repeat(32), exp: Date.now() / 1000 + 60, name: 'Verified' };
test('identity comes only from verified LINE response', async () => {
  let sent;
  const identity = await verifyLineIdentity('signed-token-'.repeat(5), '12345', async (url, options) => { sent = { url, options }; return { ok: true, json: async () => good }; });
  assert.equal(identity.uid, good.sub);
  assert.equal(sent.url, 'https://api.line.me/oauth2/v2.1/verify');
  assert.equal(sent.options.body.get('client_id'), '12345');
});
test('reject wrong channel, expired token, forged issuer/subject, failed verification', async () => {
  for (const changed of [{ aud: 'other' }, { exp: 0 }, { iss: 'attacker' }, { sub: 'admin' }]) await assert.rejects(verifyLineIdentity('token'.repeat(10), '12345', async () => ({ ok: true, json: async () => ({ ...good, ...changed }) })));
  await assert.rejects(verifyLineIdentity('token'.repeat(10), '12345', async () => ({ ok: false })));
});
test('missing channel or token fail closed without network calls', async () => {
  const network = () => { throw Error('unexpected network call'); };
  await assert.rejects(verifyLineIdentity('token'.repeat(10), '', network), /NOT_CONFIGURED/);
  await assert.rejects(verifyLineIdentity(null, '12345', network), /INVALID_LINE_TOKEN/);
});
