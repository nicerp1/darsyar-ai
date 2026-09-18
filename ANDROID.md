# اپلیکیشن Android درسیار

پروژه Native در پوشه `android/` با Capacitor ساخته شده و محتوای امن production را از `https://darsyar-ai.vercel.app` بارگذاری می‌کند.

## پیش‌نیاز ساخت

- Android Studio با Android SDK 35
- JDK 21
- Node.js 20 یا جدیدتر

## اجرای پروژه

```powershell
npm install
npm run android:sync
npm run android:open
```

برای APK آزمایشی:

```powershell
npm run android:debug
```

خروجی در `android/app/build/outputs/apk/debug/app-debug.apk` قرار می‌گیرد.

برای انتشار Google Play باید keystore اختصاصی ساخته و تنظیمات signing در `android/app/build.gradle` اضافه شود؛ فایل keystore نباید وارد Git شود.
