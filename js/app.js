/**
 * StudyMate Pro - Main Application Router & Controller
 */

const App = (function () {
    let currentView = 'dashboard';
    const features = Object.freeze({ exams: false, gamification: true, subscription: false });

    async function init() {
        try {
            await Storage.init();
        } catch (error) {
            console.error(error);
            if (typeof Utils !== 'undefined') Utils.showToast('اتصال به دیتابیس برقرار نشد.', 'error');
        }

        // Apply Saved Theme
        applyTheme();
        applyFeatureVisibility();
        window.WebStudio?.init();

        // Check Auth and Render Layout
        checkAuthAndRender();

        // Setup global search and responsive listeners
        setupEventListeners();
    }

    function isFeatureEnabled(feature) {
        return features[feature] !== false;
    }

    function applyFeatureVisibility() {
        document.querySelectorAll('[data-feature]').forEach(element => {
            element.classList.toggle('hidden', !isFeatureEnabled(element.dataset.feature));
        });
    }

    function applyTheme() {
        const settings = Storage.getSettings();
        const mobileWeb = !window.DarsyarPlatform?.native && matchMedia('(max-width: 720px)').matches;
        const theme = mobileWeb ? (settings.webMobileTheme || 'light') : (settings.theme || 'dark');
        document.documentElement.setAttribute('data-theme', theme);
        window.DarsyarPlatform?.setTheme?.(theme);

        const themeIcon = document.getElementById('theme-toggle-icon');
        if (themeIcon) {
            themeIcon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
        }
    }

    function toggleTheme() {
        const settings = Storage.getSettings();
        const mobileWeb = !window.DarsyarPlatform?.native && matchMedia('(max-width: 720px)').matches;
        const currentTheme = mobileWeb ? (settings.webMobileTheme || 'light') : (settings.theme || 'dark');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        if (mobileWeb) settings.webMobileTheme = newTheme;
        else settings.theme = newTheme;
        Storage.saveSettings(settings);
        applyTheme();

        if (typeof Utils !== 'undefined') {
            Utils.playSound('click');
        }
    }

    function checkAuthAndRender() {
        const user = Storage.getCurrentUser();
        const authView = document.getElementById('auth-view');
        const appLayout = document.getElementById('app-main-layout');

        if (!user) {
            document.body.classList.add('auth-active');
            if (authView) authView.style.display = 'block';
            if (appLayout) appLayout.style.display = 'none';
            if (typeof Auth !== 'undefined') Auth.init();
        } else {
            document.body.classList.remove('auth-active');
            if (authView) authView.style.display = 'none';
            if (appLayout) appLayout.style.display = 'flex';

            renderUserHeader();
            renderSidebarRolePermissions();
            navigate(currentView);
        }
    }

    function onUserChanged() {
        window.Messenger?.logout();
        document.getElementById('sf-completion')?.close();
        window.Community?.init();
        checkAuthAndRender();
    }

    function renderUserHeader() {
        const user = Storage.getCurrentUser();
        if (!user) return;

        const headerName = document.getElementById('header-user-name');
        const headerAvatar = document.getElementById('header-user-avatar');
        const headerStreak = document.getElementById('header-streak-count');

        if (headerName) headerName.textContent = user.name || user.username;
        if (headerAvatar) headerAvatar.innerHTML = window.ProfileStudio ? ProfileStudio.avatarHTML(user.avatar) : '👩‍🎓';
        window.ProfileStudio?.applyMotion();
        if (headerStreak && typeof Utils !== 'undefined') {
            headerStreak.textContent = `${Utils.toPersianDigits(user.streak || 0)} روز`;
        }

        if (typeof Gamification !== 'undefined') {
            Gamification.renderLevelProgress();
        }
        if (typeof Communications !== 'undefined') Communications.init();
        window.Community?.init();
    }

    function renderSidebarRolePermissions() {
        const user = Storage.getCurrentUser();
        const adminNav = document.getElementById('nav-admin');
        if (adminNav) {
            if (user && ['admin', 'advisor'].includes(user.accountType)) {
                adminNav.style.display = 'flex';
                const label = adminNav.querySelector('span:last-child'); if (label) label.textContent = user.accountType === 'advisor' ? 'پنل مشاوره' : 'مدیریت پلتفرم';
            } else {
                adminNav.style.display = 'none';
            }
        }
    }

    function navigate(viewName) {
        if(['ai-writing','ai-research'].includes(viewName))viewName='ai-assistant';
        if(viewName!=='chat')window.Messenger?.leave();
        const previousView = currentView;
        if (viewName === 'chat' && !window.WebStudio?.enabled()) { Communications.open('chat'); return; }
        if (!isFeatureEnabled(viewName)) viewName = 'dashboard';
        if (viewName === 'admin' && !Storage.isManager()) {
            currentView = 'dashboard';
            if (typeof Utils !== 'undefined') Utils.showToast('دسترسی به این بخش فقط برای مدیر اصلی مجاز است.', 'error');
            viewName = 'dashboard';
        }
        if (window.WebStudio?.enabled()) WebStudio.beforeLeave(viewName, previousView);
        currentView = viewName;
        if (window.WebStudio?.enabled()) {
            const fullChat=viewName==='ai-assistant';
            document.body.classList.toggle('aw-chat-open',fullChat);
            document.querySelectorAll('#sidebar,.top-header').forEach(element=>{element.inert=fullChat;});
        }
        if (window.WebStudio?.enabled()) Communications.close();

        // Hide all views
        document.querySelectorAll('.view-section').forEach(section => {
            section.classList.remove('active');
        });

        // Show target view
        const targetView = document.getElementById(`view-${viewName}`);
        if (targetView) {
            targetView.classList.add('active');
        }

        // Update nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        const activeNav = document.getElementById(`nav-${viewName}`);
        if (activeNav) {
            activeNav.classList.add('active');
        }

        // Close mobile sidebar if open
        closeMobileSidebar();

        // Trigger module specific initializer
        switch (viewName) {
            case 'dashboard':
                if (typeof Dashboard !== 'undefined') Dashboard.init();
                break;
            case 'pomodoro':
                if (typeof Pomodoro !== 'undefined') Pomodoro.init();
                break;
            case 'flashcards':
                if (typeof Flashcards !== 'undefined') Flashcards.init();
                break;
            case 'ai-assistant':
                if (window.WebStudio?.enabled() && window.AIWorkspace) { AIWorkspace.enter('chat'); break; }
                if (typeof AIAssistant !== 'undefined') AIAssistant.init();
                break;
            case 'ai-writing':
                if (window.WebStudio?.enabled() && window.AIWorkspace) { AIWorkspace.enter('writing'); break; }
                if (typeof AIWriting !== 'undefined') AIWriting.init();
                break;
            case 'ai-research':
                if (window.WebStudio?.enabled() && window.AIWorkspace) { AIWorkspace.enter('research'); break; }
                if (typeof AIResearch !== 'undefined') AIResearch.init();
                break;
            case 'schedule':
                if (typeof Schedule !== 'undefined') Schedule.init();
                break;
            case 'exams':
                if (typeof Exams !== 'undefined') Exams.init();
                break;
            case 'stats':
                if (window.WebStudio?.enabled() && window.StudyWorkspace) { StudyWorkspace.stats(); break; }
                if (typeof Stats !== 'undefined') Stats.init();
                break;
            case 'gamification':
                if (typeof Gamification !== 'undefined') Gamification.init();
                break;
            case 'subscription':
                if (typeof Subscription !== 'undefined') Subscription.init();
                break;
            case 'admin':
                if (typeof Admin !== 'undefined') Admin.init();
                break;
            case 'profile':
                if (typeof Profile !== 'undefined') Profile.init();
                break;
            case 'chat':
                if(window.Messenger && window.WebStudio?.enabled())Messenger.enter();
                else if (typeof Communications !== 'undefined') Communications.showPage();
                break;
        }

        if (window.WebStudio?.enabled()) WebStudio.enter(viewName, previousView);
        window.scrollTo({ top: 0, behavior: 'instant' });
        if (window.WebStudio?.enabled()) document.body.scrollTo({ top: 0, behavior: 'instant' });
    }

    function toggleMobileSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar && overlay) {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('active');
            syncMobileSidebarPresentation(sidebar.classList.contains('open'));
        }
    }

    function closeMobileSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar && overlay) {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
            syncMobileSidebarPresentation(false);
        }
    }

    function syncMobileSidebarPresentation(open) {
        const html = document.documentElement;
        const isWebMobile = !html.classList.contains('capacitor-app') && matchMedia('(max-width: 720px)').matches;
        const menuButton = document.querySelector('.menu-toggle-btn');
        const sidebar = document.getElementById('sidebar');
        const closeHadFocus = document.activeElement?.closest('.studio-drawer-close');
        document.body.classList.toggle('web-mobile-drawer-open', isWebMobile && open);
        if (menuButton) menuButton.setAttribute('aria-expanded', String(isWebMobile && open));
        if (sidebar) {
            sidebar.setAttribute('aria-hidden', String(isWebMobile && !open));
            sidebar.inert = isWebMobile && !open;
        }
        if (isWebMobile && open) document.querySelector('.studio-drawer-close')?.focus({ preventScroll: true });
        else if (isWebMobile && closeHadFocus) menuButton?.focus({ preventScroll: true });
    }

    function setupEventListeners() {
        matchMedia('(max-width: 720px)').addEventListener('change', applyTheme);
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && document.body.classList.contains('web-mobile-drawer-open')) closeMobileSidebar();
        });
        // Global search input
        const searchInput = document.getElementById('global-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', function (e) {
                const query = e.target.value.trim().toLowerCase();
                if (!query) return;

                if (query.includes('پومو') || query.includes('تایمر')) navigate('pomodoro');
                else if (query.includes('هوش') || query.includes('چت') || query.includes('فرمول')) navigate('ai-assistant');
                else if (query.includes('فلش') || query.includes('لایتنر') || query.includes('کارت')) navigate('flashcards');
                else if (query.includes('انشا') || query.includes('نگارش')) navigate('ai-writing');
                else if (query.includes('تحقیق') || query.includes('مقاله')) navigate('ai-research');
                else if (query.includes('برنامه') || query.includes('جدول')) navigate('schedule');
                else if (query.includes('درصد') || query.includes('آمار') || query.includes('نمودار')) navigate('stats');
            });
        }
    }

    return {
        init,
        toggleTheme,
        navigate,
        toggleMobileSidebar,
        closeMobileSidebar,
        renderUserHeader,
        isFeatureEnabled,
        onUserChanged
    };
})();

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

if (typeof window !== 'undefined') {
    window.App = App;
}
