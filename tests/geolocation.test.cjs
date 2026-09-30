const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync('src/lib/geolocation.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
function setup({ native = true, available = true, permissions = { location: 'prompt', coarseLocation: 'prompt' }, requested = { location: 'granted', coarseLocation: 'granted' }, failure } = {}) {
  const calls = [];
  const plugin = {
    checkPermissions: async () => permissions,
    requestPermissions: async () => { calls.push('request'); return requested; },
    getCurrentPosition: async options => { calls.push(options); if (failure) throw failure; return { coords: { latitude: 0, longitude: 102 } }; },
  };
  const sandbox = { exports: {}, navigator: { geolocation: { getCurrentPosition: success => { calls.push('web'); success({ coords: { latitude: 15, longitude: 102 } }); } } }, require: name => name === '@capacitor/core' ? { Capacitor: { isNativePlatform: () => native, isPluginAvailable: () => available } } : { Geolocation: plugin } };
  vm.runInNewContext(code, sandbox);
  return { ...sandbox.exports, calls };
}
test('native GPS requests permission then returns even zero coordinates', async () => {
  const s = setup(); const result = await s.getCurrentLocation();
  assert.equal(result.lat, 0); assert.equal(s.calls[0], 'request'); assert.equal(s.calls[1].enableHighAccuracy, true);
});
test('approximate permission works without another prompt', async () => {
  const s = setup({ permissions: { location: 'denied', coarseLocation: 'granted' } });
  await s.getCurrentLocation(); assert.equal(s.calls.length, 1); assert.equal(s.calls[0].enableHighAccuracy, false);
});
test('denied permission and old APK never attempt to locate or silently fall back', async () => {
  const s = setup({ requested: { location: 'denied', coarseLocation: 'denied' } });
  await assert.rejects(s.getCurrentLocation(), { code: 'OS-PLUG-GLOC-0003' }); assert.equal(s.calls.length, 1);
  const old = setup({ available: false }); await assert.rejects(old.getCurrentLocation(), { code: 'APP_UPDATE_REQUIRED' }); assert.equal(old.calls.length, 0);
});
test('browser uses browser API and native failures retain actionable messages', async () => {
  const web = setup({ native: false }); assert.equal((await web.getCurrentLocation()).lat, 15); assert.equal(web.calls[0], 'web');
  const native = setup({ failure: { code: 'OS-PLUG-GLOC-0010' } });
  await assert.rejects(native.getCurrentLocation(), { code: 'OS-PLUG-GLOC-0010' });
  assert.match(native.locationErrorMessage({ code: 'OS-PLUG-GLOC-0003' }), /Android/);
  assert.match(native.locationErrorMessage({ code: 'OS-PLUG-GLOC-0007' }), /เปิดตำแหน่ง/);
  assert.match(native.locationErrorMessage({ code: 'OS-PLUG-GLOC-0010' }), /หาพิกัดไม่ทัน/);
});
