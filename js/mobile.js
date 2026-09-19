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
        { view: 'ai-assistant', icon: 'auto_awesome', label: 'ابزارها' },
        { view: 'profile', icon: 'person', label: 'پروفایل' }
    ];
    const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

    function currentView() { return document.querySelector('.view-section.active')?.id?.replace('view-', '') || 'dashboard'; }
    function syncActiveNavigation(view = currentView()) {
        const direct = destinations.some(item => item.view === view) ? view : 'ai-assistant';
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
        const title = document.createElement('div');
        title.className = 'android-brand-title';
        title.innerHTML = '<img src="icons/icon-64.png" alt=""><span><strong>درسیار</strong><small>همراه مسیر پیشرفت</small></span>';
        header.prepend(title);
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
        const taskMarkup = tasks.slice(0, 4).map((task, index) => `<article class="android-today-task">
            <span class="android-task-index">${Utils.toPersianDigits(index + 1)}</span>
            <div><strong>${esc(task.subject)}</strong><small>${esc(task.note || 'تسک برنامه‌ریزی‌شده امروز')}</small></div>
            <span class="android-task-time"><span class="material-symbols-outlined" aria-hidden="true">schedule</span>${Utils.toPersianDigits(task.durationMinutes || 60)} دقیقه</span>
        </article>`).join('');
        shell.innerHTML = `<section class="android-welcome"><small>سلام،</small><h1>${esc(user.name || user.username)}</h1><p>امروز یک قدم به هدفت نزدیک‌تر شو.</p></section>
            <button class="android-advisor-card" type="button" onclick="Communications.open('chat')"><span class="android-advisor-avatar"><span class="material-symbols-outlined" aria-hidden="true">support_agent</span></span><span><small>مشاور شما</small><strong>گفت‌وگو با مشاور</strong><em><i></i> آماده گفت‌وگو</em></span><span class="material-symbols-outlined" aria-hidden="true">chevron_left</span></button>
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
        if (currentView() !== 'dashboard') { App.navigate('dashboard'); return syncActiveNavigation('dashboard'); }
        plugins.App.exitApp?.();
    });
    document.addEventListener('DOMContentLoaded', () => {
        createBottomNavigation(); decorateHeader(); renderMobileDashboard(); setupScheduleDays(); syncActiveNavigation();
        document.getElementById('sidebar-overlay')?.addEventListener('click', closeMoreSheet);
        document.querySelectorAll('#sidebar .nav-item').forEach(item => item.addEventListener('click', () => window.setTimeout(closeMoreSheet, 80)));
        const content = document.querySelector('.content-body');
        if (content) new MutationObserver(() => { syncActiveNavigation(); if (currentView() === 'dashboard') renderMobileDashboard(); if (currentView() === 'schedule') setupScheduleDays(); }).observe(content, { subtree: true, attributes: true, attributeFilter: ['class'] });
    });
})();
