// ============ MAIN APP CONTROLLER - FINAL ============
const App = {
    init() {
        if (typeof installDefaultContent === 'function') installDefaultContent();
        
        Pomodoro.init();
        Schedule.render();
        Gamification.render();
        
        this.closeSidebarOnMobile();
        
        if (Storage.currentUser && Storage.currentUser.role === 'admin') {
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
        } else {
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
        }
        
        // فعال کردن section home
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        const homeSection = document.getElementById('section-home');
        if (homeSection) homeSection.classList.add('active');
        
        // ست کردن breadcrumb
        const breadcrumb = document.getElementById('breadcrumbTitle');
        if (breadcrumb) breadcrumb.textContent = 'داشبورد';
        
        // ست کردن sidebar
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.section === 'home') item.classList.add('active');
        });
        
        this.updateThemeIcon();
        
        // رندر داشبورد
        setTimeout(() => {
            if (typeof Dashboard !== 'undefined') {
                Dashboard.render();
            }
        }, 100);
    },
    
    closeSidebarOnMobile() {
        if (window.innerWidth <= 1024) {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('sidebarOverlay');
            if (sidebar) sidebar.classList.remove('open');
            if (overlay) overlay.classList.remove('active');
        }
    },
    
    setActiveSection(section) {
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.section === section) item.classList.add('active');
        });
        
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        const targetSection = document.getElementById(`section-${section}`);
        if (targetSection) targetSection.classList.add('active');
        
        const titles = {
            home: 'داشبورد', pomodoro: 'پومودورو', flashcards: 'فلش‌کارت',
            writing: 'انشانویسی', research: 'تحقیق', stats: 'آمار',
            gamification: 'دستاوردها', 'ai-assistant': 'دستیار هوش مصنوعی',
            schedule: 'برنامه هفتگی', exams: 'آزمون‌ها', calculator: 'محاسبه درصد', admin: 'مدیریت'
        };
        const breadcrumb = document.getElementById('breadcrumbTitle');
        if (breadcrumb) breadcrumb.textContent = titles[section] || section;
        
        switch(section) {
            case 'stats': if (typeof Stats !== 'undefined') Stats.render(); break;
            case 'gamification': if (typeof Gamification !== 'undefined') Gamification.render(); break;
            case 'flashcards': if (typeof Flashcards !== 'undefined') Flashcards.render(); break;
            case 'writing': if (typeof AIWriting !== 'undefined') AIWriting.render(); break;
            case 'research': if (typeof AIResearch !== 'undefined') AIResearch.render(); break;
            case 'ai-assistant': if (typeof AIAssistant !== 'undefined') AIAssistant.init(); break;
            case 'exams': if (typeof Exams !== 'undefined') Exams.renderList(); break;
            case 'admin': if (typeof Admin !== 'undefined') Admin.render(); break;
            case 'schedule': if (typeof Schedule !== 'undefined') Schedule.render(); break;
            case 'home': if (typeof Dashboard !== 'undefined') Dashboard.render(); break;
            case 'pomodoro': if (typeof Pomodoro !== 'undefined') Pomodoro.populateTaskSelect(); break;
        }
        
        this.closeSidebarOnMobile();
    },
    
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        if (!sidebar) return;
        if (sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            if (overlay) overlay.classList.remove('active');
        } else {
            sidebar.classList.add('open');
            if (overlay) overlay.classList.add('active');
        }
    },
    
    toggleTheme() {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        this.updateThemeIcon();
    },
    
    updateThemeIcon() {
        const btn = document.getElementById('themeToggle');
        if (btn) {
            btn.innerHTML = document.body.classList.contains('dark-mode') 
                ? '<span class="material-symbols-outlined">light_mode</span>' 
                : '<span class="material-symbols-outlined">dark_mode</span>';
        }
    }
};

// ============ EVENTS ============
document.getElementById('sidebarNav').addEventListener('click', e => {
    const item = e.target.closest('.sidebar-item');
    if (!item) return;
    const section = item.dataset.section;
    if (section === 'admin' && Storage.currentUser?.role !== 'admin') {
        Utils.showToast('⛔ دسترسی غیرمجاز');
        return;
    }
    App.setActiveSection(section);
});

document.getElementById('sidebarOverlay').addEventListener('click', () => App.toggleSidebar());

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('open')) App.toggleSidebar();
    }
    if (e.key === 'Enter') {
        const overlay = document.getElementById('loginOverlay');
        if (overlay && !overlay.classList.contains('hidden')) Auth.login();
    }
});

// ============ LOAD ============
window.addEventListener('load', () => {
    const isDark = localStorage.getItem('theme') === 'dark';
    if (isDark) document.body.classList.add('dark-mode');
    if (typeof Pomodoro !== 'undefined') Pomodoro.updateDisplay();
    App.updateThemeIcon();
    if (window.innerWidth <= 1024) {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
    }
});

window.addEventListener('resize', () => {
    if (window.innerWidth <= 1024) {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
    }
});