import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [pkg, gradle, workflow, app, auth, dataApi, chatApi, index, privacy, sync, capacitor, manifest, stats, mobile] = await Promise.all([
  read('package.json').then(JSON.parse), read('android/app/build.gradle'), read('.github/workflows/android.yml'), read('js/app.js'), read('api/auth.js'), read('api/data.js'), read('api/chat.js'), read('index.html'), read('privacy.html'), read('scripts/sync-mobile.mjs'), read('capacitor.config.json').then(JSON.parse), read('android/app/src/main/AndroidManifest.xml'), read('js/stats.js'), read('js/mobile.js')
]);

assert.equal(pkg.version, '1.0.6');
assert.match(gradle, /versionCode 7/);
assert.match(gradle, /versionName "1\.0\.6"/);
assert.match(workflow, /darsyar-1\.0\.6-myket-release/);
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
assert.doesNotMatch(index, /stats-exam-history|تاریخچه آزمون‌های ثبت‌شده/);
assert.doesNotMatch(stats, /3\.5|12\.5, 9\.0|weekHours \* 4\.2/);
assert.match(mobile, /پنل مدیریت مشاور/);
assert.match(mobile, /برنامه خودت را بساز/);
assert.match(manifest, /android\.permission\.INTERNET/);
console.log('Release checks passed for Darsyar 1.0.6 (versionCode 7).');
