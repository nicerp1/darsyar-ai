/**
 * Darsyar — public mobile preview runtime (NO login, NO server).
 *
 * Provides an isolated, in-browser stand-in for the pieces the real
 * Statistics / Study Plan modules need:
 *   - a `Storage` shim with realistic sample data (today-aware), kept in a
 *     namespaced localStorage key so demo edits survive reloads but never
 *     touch real accounts (the production app is server-backed);
 *   - a `fetch` emulator for `/api/study-progress` mirroring the server's
 *     write semantics against the sample data — every other `/api/*` call
 *     is blocked locally, so the preview performs zero production writes;
 *   - a minimal `App` router that mounts the two redesigned pages with the
 *     same modules the authenticated app uses (StudyWorkspace / Schedule /
 *     StudyFlow / mobile-redesign).
 *
 * Everything else on the page (markup, CSS, renderers) is the real code.
 */
(function () {
    'use strict';

    /* ------------------------------------------------------- sample data */
    const DAY_NAMES = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
    const todayIndex = () => (new Date().getDay() + 1) % 7;
    const iso = date => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
    /* Deterministic PRNG so the demo week looks the same on every device. */
    const mulberry32 = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const rng = mulberry32(14030721);

    function seedSchedule() {
        const task = (subject, note, durationMinutes, color, status) => ({
            id: `demo-${Math.random().toString(36).slice(2, 9)}`, subject, note, durationMinutes, color, status
        });
        const days = DAY_NAMES.map((day, dayIndex) => ({ day, dayIndex, tasks: [] }));
        days[0].tasks = [
            task('زیست‌شناسی', 'فصل ۳ — سفر غذا در دستگاه گوارش', 90, '#2856d8', 'completed'),
            task('ریاضی', 'تست‌های انتگرال معین، سری ۲', 60, '#7c3aed', 'completed'),
            task('زبان انگلیسی', 'واژگان درس ۴ + تست کلوز', 30, '#0e7490', 'completed')
        ];
        days[1].tasks = [
            task('فیزیک', 'حرکت‌شناسی — نمودار مکان‌ـ‌زمان', 75, '#b45309', 'completed'),
            task('شیمی', 'استوکیومتری واکنش‌ها', 60, '#15803d', 'partial'),
            task('ادبیات فارسی', 'آرایه‌های ادبی درس ۶', 45, '#be185d', 'missed')
        ];
        days[2].tasks = [
            task('زیست‌شناسی', 'ژنتیک — قوانین مندل و مسائل احتمالی', 90, '#2856d8', 'completed'),
            task('ریاضی', 'حد و پیوستگی — قضیه فشردگی', 60, '#7c3aed', 'pending'),
            task('عربی', 'قواعد درس ۲ — جمله اسمیه', 40, '#a16207', 'pending')
        ];
        days[3].tasks = [
            task('شیمی', 'اسیدها و بازها — pH', 60, '#15803d', 'pending'),
            task('فیزیک', 'نوسان و موج — تمرین‌های کتاب', 60, '#b45309', 'pending')
        ];
        days[4].tasks = [
            task('زیست‌شناسی', 'مرور فصل ۴ و تست‌های زمان‌دار آزمون آزمایشی هفتهٔ گذشته همراه با تحلیل پاسخ‌نامه', 120, '#2856d8', 'pending'),
            task('زبان انگلیسی', 'گرامر — زمان‌های کامل', 30, '#0e7490', 'pending'),
            task('ریاضی', 'مرور فرمول‌های مشتق', 45, '#7c3aed', 'missed'),
            task('ادبیات فارسی', 'معنی واژه و املای درس ۷', 35, '#be185d', 'pending')
        ];
        days[5].tasks = [
            task('مرور هفتگی', 'جمع‌بندی نکته‌های اشتباه در دفتر خودآموز', 60, '#334155', 'pending'),
            task('شیمی', 'مرور جدول تناوبی و روندها', 45, '#15803d', 'pending')
        ];
        days[6].tasks = []; // جمعه — empty-state day

        /* Make "today" representative whatever weekday the preview opens on:
           one done, one partial, two pending (one with saved timer time). */
        const today = todayIndex();
        days[today].tasks = [
            { id: 'demo-today-bio', subject: 'زیست‌شناسی', note: 'فصل ۵ — از انرژی به ماده (فتوسنتز)', durationMinutes: 90, color: '#2856d8', status: 'completed' },
            { id: 'demo-today-math', subject: 'ریاضی', note: 'تست‌های مشتق — ۳۰ تست زمان‌دار', durationMinutes: 60, color: '#7c3aed', status: 'partial' },
            { id: 'demo-today-chem', subject: 'شیمی', note: 'محلول‌ها و غلظت مولی — مسائل ترکیبی', durationMinutes: 75, color: '#15803d', status: 'pending' },
            { id: 'demo-today-eng', subject: 'زبان انگلیسی', note: 'مرور لغات درس ۳ + فلش‌کارت', durationMinutes: 30, color: '#0e7490', status: 'pending' }
        ];
        return days;
    }

    function seedHistoryAndReports() {
        const subjects = ['زیست‌شناسی', 'ریاضی', 'شیمی', 'فیزیک', 'زبان انگلیسی', 'ادبیات فارسی'];
        const starts = ['07:30', '09:00', '16:00', '17:30', '19:00', '20:30'];
        const history = [], reports = [];
        let reportSeq = 0;
        const pushReport = (date, subject, minutes, start, status = 'completed', notes = '') => {
            const [h, m] = start.split(':').map(Number);
            const endMin = h * 60 + m + minutes;
            const end = `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
            reports.push({ id: `demo-report-${++reportSeq}`, date, subject, start, end, minutes, status, notes, createdAt: new Date().toISOString() });
        };
        /* Days 45..11 ago: timer history. Days 10..0: manual reports so the
           per-subject breakdown has real slices in both 7- and 30-day ranges. */
        for (let ago = 45; ago >= 11; ago--) {
            const weekday = (new Date(daysAgo(ago) + 'T12:00:00').getDay() + 1) % 7;
            if (rng() < 0.1) continue; // a real zero day now and then
            const span = weekday === 6 ? [0.5, 2] : [2.5, 7];
            history.push({ date: daysAgo(ago), hours: Math.round((span[0] + rng() * (span[1] - span[0])) * 10) / 10 });
        }
        for (let ago = 10; ago >= 1; ago--) {
            const date = daysAgo(ago);
            const sessions = 2 + Math.floor(rng() * 3);
            for (let s = 0; s < sessions; s++) {
                pushReport(date, subjects[Math.floor(rng() * subjects.length)], [30, 45, 60, 75, 90][Math.floor(rng() * 5)], starts[(s * 2 + ago) % starts.length], rng() < 0.12 ? 'partial' : 'completed');
            }
            if (ago === 4) pushReport(date, 'ادبیات فارسی', 40, '18:00', 'missed', 'مهمانی بود؛ به فردا منتقل شد.');
            if (ago === 2) reports[reports.length - 1].notes = 'تست‌های فصل ۴ — ۲۸ تست، ۳ غلط.';
        }
        /* Today so far: matches the plan's completed/partial tasks. */
        pushReport(daysAgo(0), 'زیست‌شناسی', 90, '07:30', 'completed', 'فتوسنتز — واکنش‌های نوری و چرخه کالوین.');
        pushReport(daysAgo(0), 'ریاضی', 45, '10:00', 'partial', '۱۸ تست از ۳۰ تست مشتق زده شد.');
        pushReport(daysAgo(0), 'زبان انگلیسی', 25, '12:00', 'completed');
        return { history, reports };
    }

    function seed() {
        const { history, reports } = seedHistoryAndReports();
        const now = new Date();
        const recordAt = (hour, minute) => new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute).toISOString();
        return {
            v: 1,
            seededOn: daysAgo(0),
            schedule: seedSchedule(),
            manual_reports: reports,
            study_history: history,
            task_completions: [],
            focus_records: [
                /* Saved focus time for today's pending chemistry task, so the
                   "complete with timer proof" path can be tried end-to-end. */
                { id: 'demo-focus-1', taskId: 'demo-today-chem', subject: 'شیمی', seconds: 2100, endedAt: recordAt(10, 35) },
                { id: 'demo-focus-2', subject: 'زیست‌شناسی', seconds: 1500, endedAt: recordAt(8, 55) }
            ],
            settings: { theme: 'light', webMobileTheme: 'light', dailyGoalHours: 6, motion: 'on', soundEnabled: false, pomodoroWork: 25, pomodoroShortBreak: 5, pomodoroLongBreak: 15 }
        };
    }

    /* --------------------------------------------------- Storage stand-in */
    const LS_KEY = 'darsyar-mobile-preview-v1';
    let cache;
    try {
        const raw = localStorage.getItem(LS_KEY);
        cache = raw ? JSON.parse(raw) : null;
    } catch (_) { cache = null; }
    if (!cache || cache.v !== 1 || cache.seededOn !== daysAgo(0)) cache = seed(); // fresh, today-aware demo each day
    const persist = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(cache)); } catch (_) { /* private mode */ } };
    persist();

    const demoUser = { username: 'preview', name: 'دانش‌آموز نمایشی', accountType: 'student', grade: 'یازدهم تجربی', xp: 640, level: 3, streak: 11 };
    const Storage = {
        init: async () => {},
        get: (key, fallback = null) => (Object.prototype.hasOwnProperty.call(cache, key) ? cache[key] : fallback),
        set(key, value) { cache[key] = value; persist(); return true; },
        saveConfirmed: async (key, value) => { cache[key] = JSON.parse(JSON.stringify(value)); persist(); },
        remove(key) { delete cache[key]; persist(); return true; },
        getCurrentUser: () => demoUser,
        setCurrentUser() {},
        getUsers: () => [demoUser],
        saveUsers() { return true; },
        updateUser() { return true; },
        saveProfile: async () => {},
        changePassword: async () => {},
        addXP() {},
        getSettings() {
            return { theme: 'light', webMobileTheme: 'light', dailyGoalHours: 6, motion: 'on', soundEnabled: false, pomodoroWork: 25, pomodoroShortBreak: 5, pomodoroLongBreak: 15, ...(cache.settings || {}) };
        },
        saveSettings(settings) { cache.settings = settings; persist(); return true; },
        isManager: () => false,
        applyServerData(data) { Object.assign(cache, data); persist(); },
        flush: async () => {},
        login: async () => demoUser, register: async () => demoUser, logout: async () => {}, deleteAccount: async () => {}
    };
    window.Storage = Storage;

    /* ----------------------------------------- /api/study-progress mirror */
    const jsonResponse = (payload, status = 200) => new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });

    function studyProgress(body) {
        const schedule = JSON.parse(JSON.stringify(cache.schedule || []));
        const reports = JSON.parse(JSON.stringify(cache.manual_reports || []));
        const completions = JSON.parse(JSON.stringify(cache.task_completions || []));
        const dayIndex = Number(body.dayIndex);
        let task = null;
        if (body.taskId) {
            task = (schedule[dayIndex]?.tasks || []).find((item, index) => (item.id || `task-${dayIndex}-${index}`) === body.taskId) || null;
            if (task && !task.id) task.id = body.taskId;
            if (!task) return jsonResponse({ error: 'تسک تغییر کرده است؛ برنامه را دوباره باز کنید.' }, 409);
            if (task.status === 'completed') return jsonResponse({ error: 'این تسک قبلاً تکمیل شده است.' }, 409);
        }
        const writes = {};
        let proof;
        if (body.source === 'timer') {
            if (!task) return jsonResponse({ error: 'ابتدا تسک را انتخاب کنید.' }, 400);
            const records = cache.focus_records || [];
            const used = new Set(completions.flatMap(item => item.recordIds || []));
            const ids = Array.isArray(body.recordIds) ? [...new Set(body.recordIds)] : [];
            const selected = records.filter(record => ids.includes(record.id) && !used.has(record.id) && record.seconds > 0 && (record.taskId === task.id || (!record.taskId && record.subject === task.subject)));
            if (!ids.length || selected.length !== ids.length) return jsonResponse({ error: 'زمان ثبت‌شدهٔ قابل استفاده برای این تسک وجود ندارد.' }, 400);
            proof = { source: 'timer', recordIds: ids, seconds: selected.reduce((sum, record) => sum + record.seconds, 0) };
        } else {
            const { date, start, end } = body;
            const subject = String(task?.subject || body.subject || '').trim().slice(0, 100);
            const validDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date));
            if (!validDate || date > iso(new Date()) || !subject || !/^([01]\d|2[0-3]):[0-5]\d$/.test(start || '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end || '')) {
                return jsonResponse({ error: 'تاریخ و ساعت گزارش معتبر نیست.' }, 400);
            }
            const toMinutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
            const minutes = toMinutes(end) - toMinutes(start);
            if (minutes <= 0) return jsonResponse({ error: 'ساعت پایان باید بعد از شروع، در همان روز باشد.' }, 400);
            const report = {
                id: `demo-${Date.now()}`, date, subject, start, end, minutes,
                status: task ? 'completed' : (['completed', 'partial', 'missed'].includes(body.status) ? body.status : 'completed'),
                notes: String(body.notes || '').slice(0, 500), createdAt: new Date().toISOString(),
                ...(task ? { taskId: task.id } : {})
            };
            reports.push(report);
            writes.manual_reports = reports;
            proof = { source: 'manual', reportId: report.id };
        }
        if (task) {
            task.status = 'completed';
            completions.push({ id: `demo-completion-${Date.now()}`, taskId: task.id, dayIndex, ...proof, createdAt: new Date().toISOString() });
            writes.schedule = schedule;
            writes.task_completions = completions;
        }
        Object.assign(cache, writes);
        persist();
        return jsonResponse({ ok: true, data: writes });
    }

    const nativeFetch = window.fetch.bind(window);
    window.fetch = function (resource, options = {}) {
        const url = typeof resource === 'string' ? resource : (resource?.url || '');
        if (url.includes('/api/study-progress')) {
            try { return Promise.resolve(studyProgress(JSON.parse(options.body || '{}'))); }
            catch (error) { return Promise.resolve(jsonResponse({ error: 'گزارش ذخیره نشد؛ دوباره تلاش کنید.' }, 500)); }
        }
        if (url.includes('/api/')) return Promise.resolve(jsonResponse({ error: 'در پیش‌نمایش نمایشی، اتصال به سرور غیرفعال است.' }, 501));
        return nativeFetch(resource, options);
    };

    /* -------------------------------------------- shells the app expects */
    const previewOnlyToast = () => window.Utils?.showToast('این بخش در پیش‌نمایش فعال نیست؛ دو صفحهٔ «آمار» و «برنامه» را ببینید.', 'info');
    window.Auth = { init() {}, logout: previewOnlyToast };
    window.Communications = { init() {}, open: previewOnlyToast, close() {}, switchTab() {}, showPage() {}, sendMessage() {} };
    window.Pomodoro = { init() {}, setTaskFromExternal() {}, openSettings: previewOnlyToast, addTaskSubmit() {} };

    const setTheme = theme => {
        const next = theme === 'dark' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        const settings = Storage.getSettings();
        settings.webMobileTheme = next;
        Storage.saveSettings(settings);
        const icon = document.getElementById('theme-toggle-icon');
        if (icon) icon.textContent = next === 'dark' ? 'light_mode' : 'dark_mode';
    };

    const App = {
        current: 'dashboard',
        navigate(view) {
            if (view !== 'stats' && view !== 'schedule') { previewOnlyToast(); return; }
            const previous = App.current;
            App.current = view;
            window.WebStudio?.beforeLeave?.(view, previous);
            document.querySelectorAll('.view-section').forEach(section => section.classList.remove('active'));
            document.getElementById(`view-${view}`)?.classList.add('active');
            document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
            document.getElementById(`nav-${view}`)?.classList.add('active');
            App.closeMobileSidebar();
            if (view === 'stats') window.StudyWorkspace?.stats();
            else window.Schedule?.init();
            window.WebStudio?.enter?.(view, previous);
            window.scrollTo({ top: 0, behavior: 'instant' });
        },
        toggleMobileSidebar() {
            const sidebar = document.getElementById('sidebar'), overlay = document.getElementById('sidebar-overlay');
            if (!sidebar || !overlay) return;
            const open = sidebar.classList.toggle('open');
            overlay.classList.toggle('active', open);
            if (matchMedia('(max-width: 720px)').matches) { sidebar.inert = !open; sidebar.setAttribute('aria-hidden', String(!open)); }
        },
        closeMobileSidebar() {
            const sidebar = document.getElementById('sidebar'), overlay = document.getElementById('sidebar-overlay');
            if (!sidebar || !overlay) return;
            sidebar.classList.remove('open'); overlay.classList.remove('active');
            if (matchMedia('(max-width: 720px)').matches) { sidebar.inert = true; sidebar.setAttribute('aria-hidden', 'true'); }
        },
        toggleTheme() { setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); },
        renderUserHeader() {}, onUserChanged() {}, isFeatureEnabled() { return true; }
    };
    window.App = App;

    /* Host-frame controls (width switch stays outside; nav/theme/reset here). */
    window.addEventListener('message', event => {
        const data = event.data;
        if (!data || data.darsyarPreview !== true) return;
        if (event.origin && event.origin !== 'null' && event.origin !== location.origin) return;
        if (data.type === 'navigate') App.navigate(data.view);
        if (data.type === 'theme') setTheme(data.theme);
        if (data.type === 'reset') { try { localStorage.removeItem(LS_KEY); } catch (_) {} location.reload(); }
    });

    window.__previewSetTheme = setTheme;
})();
