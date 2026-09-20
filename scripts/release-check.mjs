import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [pkg, gradle, workflow, app, auth, dataApi, chatApi, index, privacy, sync, capacitor, manifest] = await Promise.all([
  read('package.json').then(JSON.parse), read('android/app/build.gradle'), read('.github/workflows/android.yml'), read('js/app.js'), read('api/auth.js'), read('api/data.js'), read('api/chat.js'), read('index.html'), read('privacy.html'), read('scripts/sync-mobile.mjs'), read('capacitor.config.json').then(JSON.parse), read('android/app/src/main/AndroidManifest.xml')
]);

assert.equal(pkg.version, '1.0.5');
assert.match(gradle, /versionCode 6/);
assert.match(gradle, /versionName "1\.0\.5"/);
assert.match(workflow, /darsyar-1\.0\.5-myket-release/);
assert.equal(capacitor.appId, 'ir.darsyar.app');
assert.match(app, /exams: false, gamification: false, subscription: false/);
assert.match(auth, /parentalConsent/);
assert.match(auth, /legal_consent/);
assert.match(dataApi, /chat_reports/);
assert.match(chatApi, /action === 'report'/);
assert.match(chatApi, /action === 'block'/);
assert.match(index, /modal-delete-account/);
assert.match(index, /view-legal/);
assert.match(privacy, /@DarsyarStu/);
assert.match(sync, /privacy\.html/);
assert.doesNotMatch([index, app].join('\n'), /localStorage|sessionStorage/);
assert.doesNotMatch(index, /js\/default-content\.js/);
assert.match(manifest, /android\.permission\.INTERNET/);
console.log('Release checks passed for Darsyar 1.0.5 (versionCode 6).');
