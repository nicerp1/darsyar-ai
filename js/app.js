/**
 * StudyMate Pro - Main Application Router & Controller
 */

const App = (function () {
    let currentView = 'dashboard';
    let routeOwner = null;
    const routeKey = 'ravandRoute';
    const features = Object.freeze({ exams: false, gamification: true, subscription: false });

    function savedRoute(state = history.state) {
        const route = state?.[routeKey];
        return routeOwner && route?.owner === routeOwner ? route : null;
    }

    function saveRoute(view, peer = '', relative = true) {
        if (!routeOwner) return;
        const previous = relative ? savedRoute() : null;
        if (previous?.view === view && previous.peer === peer) return;
        const route = {
            owner: routeOwner, view, peer,
            depth: previous ? previous.depth + 1 : 0,
            chatDepth: peer && previous?.view === 'chat' ? previous.chatDepth + 1 : 0
        };
        history[previous ? 'pushState' : 'replaceState']({...history.state, [routeKey]:route}, '');
    }

    function openConversation(peer) {
        if (currentView === 'chat') saveRoute('chat', peer);
    }

    function back(chatAction) {
        const route = savedRoute();
        if (chatAction === 'list') {
            if (route?.chatDepth) history.go(-route.chatDepth);
            else window.Messenger?.showList();
            return;
        }
        const steps = chatAction === 'exit' ? (route?.chatDepth || 0) + 1 : 1;
        if (route?.depth >= steps) history.go(-steps);
        else if (currentView !== 'dashboard') navigate('dashboard', {replace:true});
    }

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
        const mobileWeb = matchMedia('(max-width: 720px)').matches;
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
        const mobileWeb = matchMedia('(max-width: 720px)').matches;
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
            if (routeOwner) {
                history.replaceState({...history.state, [routeKey]:null}, '');
                currentView = 'dashboard';
            }
            routeOwner = null;
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
            routeOwner = user.username;
            const route = savedRoute();
            if (window.StudyRooms?.hasInvite()) {
                if (!route) saveRoute('dashboard', '', false);
                navigate('study-rooms');
            } else if (route) navigate(route.view, {restore:route});
            else navigate('dashboard', {replace:true});
        }
    }

    function onUserChanged() {
        window.Messenger?.logout();
        window.StudyRooms?.reset();
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

    function navigate(viewName, {restore,replace = false} = {}) {
        if(['ai-writing','ai-research'].includes(viewName))viewName='ai-assistant';
        const previousView = currentView;
        if (!isFeatureEnabled(viewName) || !document.getElementById(`view-${viewName}`)) viewName = 'dashboard';
        if (viewName === 'admin' && !Storage.isManager()) {
            currentView = 'dashboard';
            if (typeof Utils !== 'undefined') Utils.showToast('دسترسی به این بخش فقط برای مدیر اصلی مجاز است.', 'error');
            viewName = 'dashboard';
        }
        if (previousView === 'chat' && viewName !== 'chat') window.Messenger?.leave();
        if (previousView === 'study-rooms' && viewName !== previousView) window.StudyRooms?.exit();
        if (previousView === 'schedule' && viewName !== previousView) window.PlanLog?.close();
        currentView = viewName;
        if (!restore && (viewName !== previousView || !savedRoute())) saveRoute(viewName, '', !replace);
        document.body.classList.toggle('aw-chat-open',viewName==='ai-assistant'&&Boolean(window.WebStudio?.enabled()&&window.AIWorkspace));
        if (viewName==='chat'||window.WebStudio?.enabled()) Communications.close();

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
            case 'study-rooms':
                window.StudyRooms?.enter();
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
                if (window.Messenger) void Messenger.enter(restore?.peer || '', {restore:Boolean(restore)});
                break;
        }

        if (window.WebStudio?.enabled()) WebStudio.enter(viewName);
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
        window.addEventListener('popstate', event => {
            const route = savedRoute(event.state);
            if (route) navigate(route.view, {restore:route});
            else if (routeOwner) navigate('dashboard', {replace:true});
        });
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
        back,
        openConversation,
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
