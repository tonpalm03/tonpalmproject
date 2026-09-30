// One-time, explicitly scoped test-sales reset. Dry run by default; local backup before writes.
const fs = require('node:fs');
const path = require('node:path');
const { Firestore } = require('../functions/node_modules/@google-cloud/firestore');
const { OAuth2Client } = require('../functions/node_modules/google-auth-library');
const args = process.argv.slice(2);
const projectId = args[args.indexOf('--project') + 1];
if (!args.includes('--project') || projectId !== 'tonpalmproject') throw Error('Explicit --project tonpalmproject required');
const apply = args.includes('--apply');
let options = { projectId };
const cliPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(cliPath)) {
  const authClient = new OAuth2Client();
  authClient.setCredentials(JSON.parse(fs.readFileSync(cliPath, 'utf8')).tokens);
  options.authClient = authClient;
}
const db = new Firestore(options);
async function descendants(doc) {
  const result = [];
  for (const col of await doc.ref.listCollections()) {
    for (const child of (await col.get()).docs) result.push(child, ...await descendants(child));
  }
  return result;
}
(async () => {
  const names = ['orders', 'weekly_settlements', 'credit_transactions', 'shops', 'menu_items'];
  const snapshots = await Promise.all(names.map(name => db.collection(name).get()));
  const [orders, settlements, credits, shops, menus] = snapshots;
  const orderIds = new Set(orders.docs.map(d => d.id));
  const testCharges = credits.docs.filter(d => d.data().type === 'gp_deduct' && orderIds.has(d.data().order_id));
  const children = (await Promise.all(orders.docs.map(descendants))).flat();
  const deletes = [...children, ...orders.docs, ...settlements.docs, ...testCharges];
  const counters = [...shops.docs, ...menus.docs].filter(d => (d.data().sales_count ?? 0) !== 0);
  const summary = { projectId, mode: apply ? 'APPLY' : 'DRY RUN', orders: orders.size, nestedOrderDocuments: children.length, weeklySettlements: settlements.size, testGpCharges: testCharges.length, salesCounters: counters.length, preservedShops: shops.size, preservedMenus: menus.size, preservedCreditBalances: true, orderStatuses: orders.docs.reduce((r, d) => { const status = d.data().status; r[status] = (r[status] || 0) + 1; return r; }, {}) };
  console.log(JSON.stringify(summary, null, 2));
  if (!apply) return;
  if (!args.includes('--all-existing-orders-are-tests')) throw Error('Explicit test-data acknowledgment required');
  if (deletes.length + counters.length > 450) throw Error('Too many writes for this atomic reset; review a larger migration');
  const backupDir = path.resolve('sales-backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `before-reset-${Date.now()}.json`);
  const allDocs = [...snapshots.flatMap(s => s.docs), ...children];
  // Firestore wire fields preserve timestamps, numbers and reference types for restoration.
  const backup = { projectId, createdAt: new Date().toISOString(), summary, documents: allDocs.map(d => ({ path: d.ref.path, fields: d._fieldsProto })), deletedPaths: deletes.map(d => d.ref.path), resetCounterPaths: counters.map(d => d.ref.path) };
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), { flag: 'wx', mode: 0o600 });
  if (JSON.parse(fs.readFileSync(backupPath)).documents.length !== allDocs.length) throw Error('Backup verification failed');
  const batch = db.batch();
  for (const doc of deletes) batch.delete(doc.ref, { lastUpdateTime: doc.updateTime });
  for (const doc of counters) batch.update(doc.ref, { sales_count: 0 }, { lastUpdateTime: doc.updateTime });
  await batch.commit();
  const after = await Promise.all(names.map(name => db.collection(name).get()));
  const balancesUnchanged = shops.docs.every(before => after[3].docs.find(d => d.id === before.id)?.data().credit_balance === before.data().credit_balance);
  const remainingOrders = after[0].size;
  const countersZero = [...after[3].docs, ...after[4].docs].every(d => (d.data().sales_count ?? 0) === 0);
  console.log(JSON.stringify({ backupPath, remainingOrders, weeklySettlements: after[1].size, balancesUnchanged, countersZero, shops: after[3].size, menus: after[4].size }, null, 2));
  if (remainingOrders || !balancesUnchanged || !countersZero) throw Error('Post-reset verification needs review');
})().catch(err => { console.error(err.message); process.exitCode = 1; }).finally(() => db.terminate());
