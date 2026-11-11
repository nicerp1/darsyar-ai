import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [pkg, gradle, workflow, app, auth, dataApi, chatApi, socialApi, game, index, privacy, sync, capacitor, manifest, stats, mobile, studio, nativeCss] = await Promise.all([
  read('package.json').then(JSON.parse), read('android/app/build.gradle'), read('.github/workflows/android.yml'), read('js/app.js'), read('api/auth.js'), read('api/data.js'), read('api/chat.js'), read('api/social.js'), read('js/gamification.js'), read('index.html'), read('privacy.html'), read('scripts/sync-mobile.mjs'), read('capacitor.config.json').then(JSON.parse), read('android/app/src/main/AndroidManifest.xml'), read('js/stats.js'), read('js/mobile.js'), read('js/web-studio.js'), read('css/native-shell.css')
]);

assert.equal(pkg.version, '1.0.10');
assert.match(gradle, /DARSYAR_VERSION_CODE.*11/);
assert.match(gradle, /DARSYAR_VERSION_NAME.*1\.0\.10/);
assert.match(workflow, /Publish public APK release/);
assert.equal(capacitor.appId, 'ir.darsyar.app');
assert.match(app, /exams: false, gamification: true, subscription: false/);
assert.match(auth, /parentalConsent/);
assert.match(auth, /legal_consent/);
assert.match(dataApi, /chat_reports/);
assert.match(chatApi, /action === 'report'/);
assert.match(chatApi, /action === 'block'/);
assert.match(socialApi, /leagueVisible === true/);
assert.match(socialApi, /یک ماه اشتراک ویژه برای ۳ نفر اول/);
assert.match(socialApi, /action === 'accept'/);
assert.match(dataApi, /league_points/);
assert.doesNotMatch(game, /مهندس رضوانی|سارا محمدی|آرش کیانی/);
assert.match(index, /modal-delete-account/);
assert.match(index, /view-legal/);
assert.match(privacy, /@DarsyarStu/);
assert.match(sync, /privacy\.html/);
assert.doesNotMatch([index, app].join('\n'), /localStorage|sessionStorage/);
assert.doesNotMatch(index, /js\/default-content\.js/);
assert.doesNotMatch(index, /stats-exam-history|تاریخچه آزمون‌های ثبت‌شده/);
assert.doesNotMatch(stats, /3\.5|12\.5, 9\.0|weekHours \* 4\.2/);
assert.match(mobile, /classList\.add\('native-shell'\)/);
assert.doesNotMatch(mobile, /classList\.add\('capacitor-app'\)|android-bottom-nav|android-dashboard/);
assert.match(studio, /window\.DarsyarPlatform\?\.native\s*\?\s*'روند'/);
assert.match(app, /const mobileWeb = matchMedia\('\(max-width: 720px\)'\)\.matches/);
assert.match(index, /css\/native-shell\.css/);
assert.match(nativeCss, /safe-area-inset-top/);
assert.match(nativeCss, /safe-area-inset-bottom/);
assert.match(index, /رقابت اجتماعی/);
assert.match(index, /id="view-gamification"/);
assert.doesNotMatch(stats, /league|leaderboard|لیگ/);
assert.match(manifest, /android\.permission\.INTERNET/);
console.log('Release checks passed for Darsyar 1.0.10 (base versionCode 11).');
