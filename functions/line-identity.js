// Never trust a profile/uid sent by the browser. Verification is delegated to LINE.
async function verifyLineIdentity(idToken, channelId, fetchImpl = fetch) {
  if (!channelId || !/^\d+$/.test(channelId)) throw new Error('LINE_CHANNEL_NOT_CONFIGURED');
  if (typeof idToken !== 'string' || idToken.length < 20 || idToken.length > 16000) throw new Error('INVALID_LINE_TOKEN');
  const response = await fetchImpl('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    console.error('LINE verify endpoint returned error:', response.status, errorBody);
    throw new Error('INVALID_LINE_TOKEN');
  }
  const identity = await response.json();
  const nowInSec = Math.floor(Date.now() / 1000);
  if (identity.iss !== 'https://access.line.me' || String(identity.aud) !== channelId
      || typeof identity.exp !== 'number' || identity.exp <= (nowInSec - 60)
      || typeof identity.sub !== 'string' || !/^U[0-9a-zA-Z]{32,33}$/.test(identity.sub)) {
    console.error('LINE verify token payload mismatch or expired:', JSON.stringify(identity), 'nowInSec:', nowInSec);
    throw new Error('INVALID_LINE_TOKEN');
  }
  return { uid: identity.sub, issuedAt: identity.iat, name: typeof identity.name === 'string' ? identity.name : 'ผู้ใช้งาน LINE', picture: typeof identity.picture === 'string' ? identity.picture : '' };
}
module.exports = { verifyLineIdentity };
