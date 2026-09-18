/** Android-only shell: edge-to-edge chrome, bottom navigation and native back. */
(function () {
    const capacitor = window.Capacitor;
    if (!capacitor?.isNativePlatform?.()) return;
    document.documentElement.classList.add('capacitor-app');
    const plugins = capacitor.Plugins || {};
    const destinations = [
        { view: 'dashboard', icon: 'home', label: 'خانه' },
        { view: 'schedule', icon: 'calendar_month', label: 'برنامه' },
        { view: 'pomodoro', icon: 'timer', label: 'تمرکز', primary: true },
        { view: 'stats', icon: 'monitoring', label: 'گزارش' },
        { view: 'more', icon: 'apps', label: 'بیشتر' }
    ];

    function currentView() { return document.querySelector('.view-section.active')?.id?.replace('view-', '') || 'dashboard'; }
    function syncActiveNavigation(view = currentView()) {
        const direct = destinations.some(item => item.view === view) ? view : 'more';
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
            if (view === 'more') return openMoreSheet();
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
        title.innerHTML = '<strong>درسیار</strong><small>همراه هوشمند مطالعه</small>';
        header.prepend(title);
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
        createBottomNavigation(); decorateHeader(); syncActiveNavigation();
        document.getElementById('sidebar-overlay')?.addEventListener('click', closeMoreSheet);
        document.querySelectorAll('#sidebar .nav-item').forEach(item => item.addEventListener('click', () => window.setTimeout(closeMoreSheet, 80)));
        const content = document.querySelector('.content-body');
        if (content) new MutationObserver(() => syncActiveNavigation()).observe(content, { subtree: true, attributes: true, attributeFilter: ['class'] });
    });
})();
