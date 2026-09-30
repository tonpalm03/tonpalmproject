// Explicit, reviewable migration. Defaults to read-only dry run. Uses ADC, never browser credentials.
const fs = require('node:fs');
const path = require('node:path');
const admin = require('../functions/node_modules/firebase-admin');
const args = process.argv.slice(2);
const value = flag => args[args.indexOf(flag) + 1];
const projectId = args.includes('--project') ? value('--project') : '';
if (!projectId) throw new Error('Pass --project explicitly');
const manifestPath = args.includes('--manifest') ? value('--manifest') : 'security-migration.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (manifest.projectId !== projectId || !Array.isArray(manifest.adminUids) || !manifest.adminUids.length) throw new Error('Invalid project/admin manifest');
const apply = args.includes('--apply');
if (apply && (!manifest.merchantMappingsReviewed || !args.includes('--acknowledge-role-reset'))) throw new Error('Review merchant mappings and pass --acknowledge-role-reset before applying');
const uidPattern = /^[^/]{1,128}$/;
const roles = new Map(manifest.adminUids.map(uid => [uid, { role: 'admin' }]));
for (const merchant of manifest.merchants) {
  if (!uidPattern.test(merchant.uid) || !uidPattern.test(merchant.shopId) || roles.has(merchant.uid)) throw new Error('Invalid or duplicate merchant mapping');
  roles.set(merchant.uid, { role: 'merchant', shop_id: merchant.shopId });
}
if ([...roles.keys()].some(uid => !uidPattern.test(uid))) throw new Error('Invalid UID');
let db, deleteField, cleanup = async () => {};
try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({ projectId });
    db = admin.firestore();
    deleteField = () => admin.firestore.FieldValue.delete();
    cleanup = async () => admin.app().delete();
  } else {
    const { Firestore, FieldValue } = require('../functions/node_modules/@google-cloud/firestore');
    const { OAuth2Client } = require('../functions/node_modules/google-auth-library');
    const cliPath = path.join(process.env.USERPROFILE || process.env.HOME || '', '.config', 'configstore', 'firebase-tools.json');
    if (!fs.existsSync(cliPath)) {
      admin.initializeApp({ projectId });
      db = admin.firestore();
      deleteField = () => admin.firestore.FieldValue.delete();
      cleanup = async () => admin.app().delete();
    } else {
      const config = JSON.parse(fs.readFileSync(cliPath, 'utf8'));
      const authClient = new OAuth2Client();
      authClient.setCredentials(config.tokens);
      db = new Firestore({ projectId, authClient });
      deleteField = () => FieldValue.delete();
    }
  }
} catch (err) {
  admin.initializeApp({ projectId });
  db = admin.firestore();
  deleteField = () => admin.firestore.FieldValue.delete();
  cleanup = async () => admin.app().delete();
}
(async () => {
  const [users, shops, access] = await Promise.all(['users', 'shops', 'access'].map(name => db.collection(name).get()));
  const shopIds = new Set(shops.docs.map(d => d.id));
  for (const uid of roles.keys()) if (!users.docs.some(d => d.id === uid)) throw new Error(`Missing reviewed profile: ${uid}`);
  for (const entry of manifest.merchants) if (!shopIds.has(entry.shopId)) throw new Error(`Missing reviewed shop: ${entry.shopId}`);
  console.log(JSON.stringify({ mode: apply ? 'APPLY' : 'DRY RUN', projectId, users: users.size, shops: shops.size, reviewedAdmins: manifest.adminUids.length, reviewedMerchants: manifest.merchants.length, merchantMappingsReviewed: manifest.merchantMappingsReviewed, actions: ['Replace authority from reviewed manifest only', 'Reset unreviewed legacy role mirrors to customer', 'Remove publicly readable FCM tokens; merchants must re-register devices'] }, null, 2));
  if (!apply) return;
  // Backup stays local and git-ignored. Contains private data: do not publish it.
  const backupDir = path.resolve('security-backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backup = path.join(backupDir, `before-${Date.now()}.json`);
  fs.writeFileSync(backup, JSON.stringify({ projectId, users: users.docs.map(d => ({ id: d.id, data: d.data() })), shops: shops.docs.map(d => ({ id: d.id, data: d.data() })), access: access.docs.map(d => ({ id: d.id, data: d.data() })) }, null, 2), { flag: 'wx', mode: 0o600 });
  // Small batches are restartable; keep clients in maintenance during cutover.
  let batch = db.batch(), count = 0;
  const flush = async () => { if (count) await batch.commit(); batch = db.batch(); count = 0; };
  for (const user of users.docs) {
    const authority = roles.get(user.id) || { role: 'customer' };
    batch.set(db.collection('access').doc(user.id), authority);
    batch.update(user.ref, { role: authority.role, shop_id: authority.shop_id || deleteField() });
    count += 2;
    if (count >= 400) await flush();
  }
  for (const existing of access.docs) {
    if (!users.docs.some(d => d.id === existing.id)) { batch.delete(existing.ref); count++; }
    if (count >= 400) await flush();
  }
  for (const shop of shops.docs) {
    const reviewed = manifest.merchants.find(m => m.shopId === shop.id);
    batch.update(shop.ref, { fcmTokens: deleteField(), fcmToken: deleteField(), lastTokenUpdate: deleteField(), ...(reviewed ? { owner_uid: reviewed.uid } : {}) });
    if (++count >= 400) await flush();
  }
  await flush();
  console.log('Migration complete. Verify access before leaving maintenance; re-register merchant devices.');
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => cleanup());
