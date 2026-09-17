/**
 * StudyMate Pro - Main Application Router & Controller
 */

const App = (function () {
    let currentView = 'dashboard';

    async function init() {
        try {
            await Storage.init();
        } catch (error) {
            console.error(error);
            if (typeof Utils !== 'undefined') Utils.showToast('اتصال به دیتابیس برقرار نشد.', 'error');
        }

        if (Storage.getCurrentUser() && typeof DefaultContent !== 'undefined') DefaultContent.initStorage();

        // Apply Saved Theme
        applyTheme();

        // Check Auth and Render Layout
        checkAuthAndRender();

        // Setup global search and responsive listeners
        setupEventListeners();
    }

    function applyTheme() {
        const settings = Storage.getSettings();
        const theme = settings.theme || 'dark';
        document.documentElement.setAttribute('data-theme', theme);

        const themeIcon = document.getElementById('theme-toggle-icon');
        if (themeIcon) {
            themeIcon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
        }
    }

    function toggleTheme() {
        const settings = Storage.getSettings();
        const currentTheme = settings.theme || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        settings.theme = newTheme;
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
            if (authView) authView.style.display = 'block';
            if (appLayout) appLayout.style.display = 'none';
            if (typeof Auth !== 'undefined') Auth.init();
        } else {
            if (authView) authView.style.display = 'none';
            if (appLayout) appLayout.style.display = 'flex';

            renderUserHeader();
            renderSidebarRolePermissions();
            navigate(currentView);
        }
    }

    function onUserChanged() {
        checkAuthAndRender();
    }

    function renderUserHeader() {
        const user = Storage.getCurrentUser();
        if (!user) return;

        const headerName = document.getElementById('header-user-name');
        const headerAvatar = document.getElementById('header-user-avatar');
        const headerStreak = document.getElementById('header-streak-count');

        if (headerName) headerName.textContent = user.name || user.username;
        if (headerAvatar) headerAvatar.textContent = user.avatar || '👩‍🎓';
        if (headerStreak && typeof Utils !== 'undefined') {
            headerStreak.textContent = `${Utils.toPersianDigits(user.streak || 5)} روز`;
        }

        if (typeof Gamification !== 'undefined') {
            Gamification.renderLevelProgress();
        }
    }

    function renderSidebarRolePermissions() {
        const user = Storage.getCurrentUser();
        const adminNav = document.getElementById('nav-item-admin');
        if (adminNav) {
            if (user && user.role === 'admin') {
                adminNav.style.display = 'flex';
            } else {
                adminNav.style.display = 'none';
            }
        }
    }

    function navigate(viewName) {
        currentView = viewName;

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
                if (typeof AIAssistant !== 'undefined') AIAssistant.init();
                break;
            case 'ai-writing':
                if (typeof AIWriting !== 'undefined') AIWriting.init();
                break;
            case 'ai-research':
                if (typeof AIResearch !== 'undefined') AIResearch.init();
                break;
            case 'schedule':
                if (typeof Schedule !== 'undefined') Schedule.init();
                break;
            case 'exams':
                if (typeof Exams !== 'undefined') Exams.init();
                break;
            case 'stats':
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
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function toggleMobileSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar && overlay) {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('active');
        }
    }

    function closeMobileSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar && overlay) {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        }
    }

    function setupEventListeners() {
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
                else if (query.includes('آزمون') || query.includes('تست')) navigate('exams');
                else if (query.includes('درصد') || query.includes('آمار') || query.includes('نمودار')) navigate('stats');
                else if (query.includes('نشان') || query.includes('امتیاز') || query.includes('لیدر')) navigate('gamification');
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
