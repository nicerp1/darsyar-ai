/** Android-only shell: edge-to-edge chrome, bottom navigation and native back. */
(function () {
    const capacitor = window.Capacitor;
    if (!capacitor?.isNativePlatform?.()) return;
    document.documentElement.classList.add('capacitor-app');
    const plugins = capacitor.Plugins || {};
    const destinations = [
        { view: 'dashboard', icon: 'home', label: 'امروز' },
        { view: 'schedule', icon: 'calendar_month', label: 'برنامه' },
        { view: 'pomodoro', icon: 'timer', label: 'تمرکز', primary: true },
        { view: 'mobile-tools', icon: 'widgets', label: 'ابزارها' },
        { view: 'stats', icon: 'monitoring', label: 'آمار' }
    ];
    const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

    function currentView() { return document.querySelector('.view-section.active')?.id?.replace('view-', '') || 'dashboard'; }
    function syncActiveNavigation(view = currentView()) {
        const toolViews = ['ai-assistant','flashcards','ai-writing','ai-research','gamification','admin'];
        const direct = destinations.some(item => item.view === view) ? view : (toolViews.includes(view) ? 'mobile-tools' : 'dashboard');
        document.querySelectorAll('.android-nav-item').forEach(button => {
            const selected = button.dataset.mobileView === direct;
            button.classList.toggle('active', selected);
            button.setAttribute('aria-current', selected ? 'page' : 'false');
        });
    }
    function closeMoreSheet() {
        document.getElementById('sidebar')?.classList.remove('open');
        document.getElementById('sidebar-overlay')?.classList.remove('active');
        document.body.classList.remove('mobile-sheet-open');
        syncActiveNavigation(currentView());
    }
    function openMoreSheet() {
        document.getElementById('sidebar')?.classList.add('open');
        document.getElementById('sidebar-overlay')?.classList.add('active');
        document.body.classList.add('mobile-sheet-open');
        syncActiveNavigation('more');
    }
    function createBottomNavigation() {
        if (document.getElementById('android-bottom-nav')) return;
        const nav = document.createElement('nav');
        nav.id = 'android-bottom-nav';
        nav.className = 'android-bottom-nav';
        nav.setAttribute('aria-label', 'ناوبری اصلی');
        nav.innerHTML = destinations.map(item => `<button type="button" class="android-nav-item${item.primary ? ' android-nav-primary' : ''}" data-mobile-view="${item.view}" aria-label="${item.label}"><span class="android-nav-icon material-symbols-outlined" aria-hidden="true">${item.icon}</span><span class="android-nav-label">${item.label}</span></button>`).join('');
        nav.addEventListener('click', event => {
            const button = event.target.closest('[data-mobile-view]');
            if (!button) return;
            const view = button.dataset.mobileView;
            App.navigate(view);
            syncActiveNavigation(view);
        });
        document.body.appendChild(nav);
    }
    function decorateHeader() {
        const header = document.querySelector('.top-header');
        if (!header || header.querySelector('.android-brand-title')) return;
        header.innerHTML = `<button class="android-brand-title" type="button" onclick="App.navigate('dashboard')" aria-label="رفتن به صفحه امروز"><span><strong>درسیار</strong><small>همراه هوشمند مطالعه</small></span><img src="icons/icon-64.png" alt="نشان درسیار"></button>
            <div class="android-header-actions">
                <button class="icon-btn" type="button" onclick="App.toggleTheme()" aria-label="تغییر حالت نمایش"><span class="material-symbols-outlined" id="theme-toggle-icon" aria-hidden="true">light_mode</span></button>
                <button class="icon-btn" type="button" onclick="Communications.open('notes')" aria-label="یادداشت‌ها"><span class="material-symbols-outlined" aria-hidden="true">sticky_note_2</span></button>
                <button class="icon-btn" type="button" onclick="Communications.open('chat')" aria-label="گفت‌وگو با مشاور"><span class="material-symbols-outlined" aria-hidden="true">forum</span><span id="header-chat-dot" class="notification-dot hidden"></span></button>
                <button class="android-profile-button" type="button" onclick="App.navigate('profile')" aria-label="پروفایل کاربری"><span class="material-symbols-outlined" aria-hidden="true">person</span><span id="header-user-name" class="sr-only">پروفایل</span><span id="header-user-avatar" class="sr-only"></span></button>
            </div>`;
    }

    function createToolsHub() {
        if (document.getElementById('view-mobile-tools')) return;
        const section = document.createElement('section'); section.id = 'view-mobile-tools'; section.className = 'view-section android-tools-hub';
        section.innerHTML = `<header><small>جعبه‌ابزار هوشمند</small><h1>برای هر مرحله، یک ابزار آماده است</h1><p>یادگیری، مرور و نگارش را از همین‌جا شروع کن.</p></header><div class="android-tools-grid">
            <button id="android-counselor-tool" class="hidden" type="button" onclick="App.navigate('admin')"><span class="material-symbols-outlined" aria-hidden="true">manage_accounts</span><span><strong>پنل مدیریت مشاور</strong><small>دانش‌آموزان، برنامه‌ها و گزارش‌ها</small></span><i class="material-symbols-outlined" aria-hidden="true">chevron_left</i></button>
            <button id="android-league-tool" type="button" onclick="App.navigate('gamification')"><span class="material-symbols-outlined" aria-hidden="true">leaderboard</span><span><strong>لیگ و دوستان</strong><small>رقابت اختیاری و پروفایل دانش‌آموزی</small></span><i class="material-symbols-outlined" aria-hidden="true">chevron_left</i></button>
            <button type="button" onclick="App.navigate('ai-assistant')"><span class="material-symbols-outlined" aria-hidden="true">smart_toy</span><span><strong>دستیار هوشمند</strong><small>پرسش درسی و حل مسئله</small></span><i class="material-symbols-outlined" aria-hidden="true">chevron_left</i></button>
            <button type="button" onclick="App.navigate('flashcards')"><span class="material-symbols-outlined" aria-hidden="true">style</span><span><strong>فلش‌کارت هوشمند</strong><small>مرور نکات و سوال حرفه‌ای</small></span><i class="material-symbols-outlined" aria-hidden="true">chevron_left</i></button>
            <button type="button" onclick="App.navigate('ai-writing')"><span class="material-symbols-outlined" aria-hidden="true">edit_note</span><span><strong>انشانویس</strong><small>نگارش خلاقانه و ساختاریافته</small></span><i class="material-symbols-outlined" aria-hidden="true">chevron_left</i></button>
            <button type="button" onclick="App.navigate('ai-research')"><span class="material-symbols-outlined" aria-hidden="true">science</span><span><strong>تحقیق‌یار</strong><small>تحقیق بلند و مقاله علمی</small></span><i class="material-symbols-outlined" aria-hidden="true">chevron_left</i></button>
            <button type="button" onclick="Communications.open('notes')"><span class="material-symbols-outlined" aria-hidden="true">note_stack</span><span><strong>یادداشت‌های من</strong><small>ثبت نکته و کارهای مهم</small></span><i class="material-symbols-outlined" aria-hidden="true">chevron_left</i></button>
        </div>`;
        document.querySelector('.content-body')?.appendChild(section);
    }

    function updateRoleAccess() {
        const manager = Boolean(window.Storage?.isManager?.());
        document.getElementById('android-counselor-tool')?.classList.toggle('hidden', !manager);
        document.getElementById('android-league-tool')?.classList.toggle('hidden', manager);
    }

    function decorateAiChat() {
        const header = document.querySelector('#view-ai-assistant .ai-chat-header');
        if (!header || header.querySelector('.android-ai-back')) return;
        const back = document.createElement('button'); back.type = 'button'; back.className = 'android-ai-back'; back.setAttribute('aria-label','بازگشت به ابزارها'); back.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>'; back.onclick = () => App.navigate('mobile-tools'); header.prepend(back);
        const avatar = header.querySelector('.ai-avatar'); if (avatar) avatar.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">smart_toy</span>';
    }

    function todayIndex() { return (new Date().getDay() + 1) % 7; }
    function renderMobileDashboard() {
        const view = document.getElementById('view-dashboard');
        if (!view || !window.Storage || !Storage.getCurrentUser()) return;
        let shell = view.querySelector('.android-dashboard');
        if (!shell) { shell = document.createElement('div'); shell.className = 'android-dashboard'; view.prepend(shell); }
        const user = Storage.getCurrentUser();
        const schedule = Storage.get('schedule', []) || [];
        const tasks = schedule[todayIndex()]?.tasks || schedule[todayIndex()]?.slots?.filter(item => item?.subject) || [];
        const complete = tasks.filter(task => task.status === 'completed').length;
        const totalMinutes = tasks.reduce((sum, task) => sum + Number(task.durationMinutes || 0), 0);
        const hour = new Date().getHours();
        const greeting = hour < 12 ? 'صبحِ قشنگت بخیر' : hour < 18 ? 'وقتِ ساختن یک روز عالیه' : 'شبِ آروم و پربازده‌ای داشته باش';
        const taskMarkup = tasks.slice(0, 4).map((task, index) => `<article class="android-today-task">
            <span class="android-task-index">${Utils.toPersianDigits(index + 1)}</span>
            <div><strong>${esc(task.subject)}</strong><small>${esc(task.note || 'تسک برنامه‌ریزی‌شده امروز')}</small></div>
            <span class="android-task-time"><span class="material-symbols-outlined" aria-hidden="true">schedule</span>${Utils.toPersianDigits(task.durationMinutes || 60)} دقیقه</span>
        </article>`).join('');
        const manager = Storage.isManager(), advisor = user.advisor;
        const relationshipCard = manager
            ? `<button class="android-advisor-card" type="button" onclick="App.navigate('admin')"><span class="android-advisor-avatar"><span class="material-symbols-outlined" aria-hidden="true">manage_accounts</span></span><span><small>فضای کاری مشاور</small><strong>مدیریت دانش‌آموزان</strong><em>برنامه، گزارش و گفت‌وگو</em></span><span class="material-symbols-outlined" aria-hidden="true">chevron_left</span></button>`
            : advisor
                ? `<button class="android-advisor-card" type="button" onclick="Communications.open('chat')"><span class="android-advisor-avatar"><span class="material-symbols-outlined" aria-hidden="true">support_agent</span></span><span><small>مشاور شما</small><strong>${esc(advisor.name || advisor.username)}</strong><em><i></i> گفت‌وگوی خصوصی</em></span><span class="material-symbols-outlined" aria-hidden="true">chevron_left</span></button>`
                : `<button class="android-advisor-card android-self-plan" type="button" onclick="App.navigate('schedule')"><span class="android-advisor-avatar"><span class="material-symbols-outlined" aria-hidden="true">edit_calendar</span></span><span><small>مطالعه مستقل</small><strong>برنامه خودت را بساز</strong><em>هر زمان خواستی به مشاور متصل شو</em></span><span class="material-symbols-outlined" aria-hidden="true">chevron_left</span></button>`;
        shell.innerHTML = `<section class="android-welcome"><div class="android-welcome-orbit"><span class="material-symbols-outlined" aria-hidden="true">auto_awesome</span></div><div><small>${greeting}</small><h1>${esc(user.name || user.username)} جان</h1><p>امروز قرار نیست کامل باشی؛ فقط یک قدم جلوتر برو.</p></div></section>
            ${relationshipCard}
            <section class="android-plan-card"><header><div><span class="material-symbols-outlined" aria-hidden="true">calendar_today</span><h2>برنامه امروز</h2></div><small>${Utils.toPersianDigits(tasks.length)} تسک</small></header>
            <div class="android-today-list">${taskMarkup || '<div class="android-empty-plan"><span class="material-symbols-outlined" aria-hidden="true">event_available</span><p>برنامه امروز هنوز خالی است.</p></div>'}</div>
            <button class="android-focus-cta" type="button" onclick="App.navigate('pomodoro')"><span class="material-symbols-outlined" aria-hidden="true">play_arrow</span>شروع تمرکز</button></section>
            <section class="android-progress-card"><div class="android-progress-ring" style="--progress:${tasks.length ? Math.round(complete / tasks.length * 100) : 0}%"><strong>${Utils.toPersianDigits(complete)}/${Utils.toPersianDigits(tasks.length)}</strong></div><div><small>پیشرفت امروز</small><strong>${Utils.toPersianDigits(complete)} تسک انجام‌شده</strong></div><div><strong>${Utils.toPersianDigits(totalMinutes)}</strong><small>دقیقه برنامه</small></div></section>`;
    }

    function setupScheduleDays() {
        const area = document.getElementById('schedule-printable-area');
        const list = document.getElementById('schedule-days-list');
        if (!area || !list) return;
        let picker = document.getElementById('android-day-picker');
        if (!picker) {
            picker = document.createElement('div'); picker.id = 'android-day-picker'; picker.className = 'android-day-picker'; area.before(picker);
            picker.innerHTML = ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'].map((day,index) => `<button type="button" data-day="${index}"><small>${day}</small><strong>${Utils.toPersianDigits(index + 1)}</strong></button>`).join('');
            picker.addEventListener('click', event => { const button = event.target.closest('[data-day]'); if (button) selectScheduleDay(Number(button.dataset.day)); });
        }
        if (!picker.dataset.ready) { picker.dataset.ready = 'true'; new MutationObserver(() => selectScheduleDay(Number(picker.dataset.selected ?? todayIndex()))).observe(list, { childList:true }); }
        selectScheduleDay(Number(picker.dataset.selected ?? todayIndex()));
    }
    function selectScheduleDay(index) {
        const picker = document.getElementById('android-day-picker'); if (!picker) return;
        picker.dataset.selected = String(index);
        picker.querySelectorAll('button').forEach((button, itemIndex) => { const active = itemIndex === index; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
        document.querySelectorAll('#schedule-days-list > .schedule-day-card').forEach((card, itemIndex) => card.classList.toggle('android-day-hidden', itemIndex !== index));
    }

    plugins.StatusBar?.setOverlaysWebView?.({ overlay: true }).catch(() => {});
    plugins.StatusBar?.setBackgroundColor?.({ color: '#00000000' }).catch(() => {});
    plugins.StatusBar?.setStyle?.({ style: 'LIGHT' }).catch(() => {});
    plugins.SplashScreen?.hide?.().catch(() => {});
    plugins.Network?.addListener?.('networkStatusChange', status => {
        if (typeof Utils !== 'undefined') Utils.showToast(status.connected ? 'دوباره آنلاین شدی.' : 'اینترنت قطع است؛ تغییرات پس از اتصال همگام می‌شوند.', status.connected ? 'success' : 'warning');
    });
    plugins.App?.addListener?.('backButton', () => {
        const communications = document.getElementById('communications-drawer');
        if (communications?.classList.contains('open')) return Communications.close();
        const modal = document.querySelector('.modal-overlay.active, .modal-overlay.show');
        if (modal) return Utils.closeModal(modal.id);
        if (document.getElementById('sidebar')?.classList.contains('open')) return closeMoreSheet();
        if (currentView() === 'ai-assistant') { App.navigate('mobile-tools'); return syncActiveNavigation('mobile-tools'); }
        if (currentView() !== 'dashboard') { App.navigate('dashboard'); return syncActiveNavigation('dashboard'); }
        plugins.App.exitApp?.();
    });
    document.addEventListener('DOMContentLoaded', () => {
        createToolsHub(); createBottomNavigation(); decorateHeader(); decorateAiChat(); updateRoleAccess(); renderMobileDashboard(); setupScheduleDays(); syncActiveNavigation();
        document.getElementById('sidebar-overlay')?.addEventListener('click', closeMoreSheet);
        document.querySelectorAll('#sidebar .nav-item').forEach(item => item.addEventListener('click', () => window.setTimeout(closeMoreSheet, 80)));
        const content = document.querySelector('.content-body');
        if (content) new MutationObserver(() => { const view = currentView(); updateRoleAccess(); syncActiveNavigation(view); document.body.classList.toggle('ai-chat-page-open', view === 'ai-assistant'); if (view === 'dashboard') renderMobileDashboard(); if (view === 'schedule') setupScheduleDays(); }).observe(content, { subtree: true, attributes: true, attributeFilter: ['class'] });
    });
})();
