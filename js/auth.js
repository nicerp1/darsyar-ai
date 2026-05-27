// ============ AUTHENTICATION ============
const Auth = {
    login() {
        const u = document.getElementById('usernameInput')?.value?.trim();
        const p = document.getElementById('passwordInput')?.value?.trim();
        
        if (!u || !p) return Utils.showToast('⚠️ فیلدها را پر کنید');
        
        if (Storage.USERS[u] && Storage.USERS[u].password === p) {
            Storage.currentUser = { username: u, ...Storage.USERS[u] };
            document.getElementById('loginOverlay').classList.add('hidden');
            document.getElementById('appContainer').classList.add('active');
            document.getElementById('userDisplayName').textContent = Storage.currentUser.name;
            
            const badge = document.getElementById('userRoleBadge');
            badge.textContent = Storage.currentUser.role === 'admin' ? 'ادمین' : 'کاربر';
            badge.className = `badge ${Storage.currentUser.role === 'admin' ? 'badge-admin' : 'badge-user'}`;
            
            document.querySelectorAll('.admin-only').forEach(el => 
                el.style.display = Storage.currentUser.role === 'admin' ? 'block' : 'none'
            );
            
            App.init();
            Utils.showToast(`✅ خوش آمدید ${Storage.currentUser.name}`);
        } else {
            Utils.showToast('❌ اطلاعات نادرست');
        }
    },
    
    logout() {
        Pomodoro.pause();
        Storage.currentUser = null;
        document.getElementById('loginOverlay').classList.remove('hidden');
        document.getElementById('appContainer').classList.remove('active');
    }
};

// اتصال دکمه لاگین
document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', Auth.login);
    }
    
    // Enter برای لاگین
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const overlay = document.getElementById('loginOverlay');
            if (overlay && !overlay.classList.contains('hidden')) {
                Auth.login();
            }
        }
    });
});