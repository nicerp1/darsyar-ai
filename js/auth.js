// ============ AUTH SYSTEM - FINAL FIXED ============
const Auth = {
    apiURL: '/api',
    
    async register(username, email, password, passwordConfirm, name) {
        if (!username || !email || !password || !passwordConfirm) {
            alert('⚠️ همه فیلدهای اجباری را پر کنید');
            return false;
        }
        if (username.length < 3) { alert('⚠️ نام کاربری حداقل ۳ کاراکتر'); return false; }
        if (password.length < 4) { alert('⚠️ رمز عبور حداقل ۴ کاراکتر'); return false; }
        if (password !== passwordConfirm) { alert('⚠️ رمز و تکرار مطابقت ندارند'); return false; }
        if (!email.includes('@') || !email.includes('.')) { alert('⚠️ ایمیل معتبر وارد کنید'); return false; }
        
        try {
            const res = await fetch(`${this.apiURL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password, name: name || username })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                Storage.currentUser = data.user;
                this.goToApp();
                alert('✅ ثبت‌نام و ورود موفق!');
                return true;
            }
            alert('❌ ' + (data.error || 'خطا'));
            return false;
        } catch(e) {
            alert('❌ سرور در دسترس نیست');
            return false;
        }
    },
    
    async login(username, password) {
        if (!username || !password) {
            alert('⚠️ نام کاربری و رمز عبور را وارد کنید');
            return false;
        }
        
        // اول API رو امتحان کن
        try {
            const res = await fetch(`${this.apiURL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                Storage.currentUser = data.user;
                this.goToApp();
                return true;
            }
            // API گفت اشتباهه - شاید admin باشه
        } catch(e) {}
        
        // چک admin
        if (username === 'admin' && password === '1234') {
            Storage.currentUser = { username: 'admin', name: 'مدیر', role: 'admin' };
            this.goToApp();
            return true;
        }
        
        alert('❌ نام کاربری یا رمز عبور اشتباه است');
        return false;
    },
    
    goToApp() {
        document.getElementById('loginOverlay').classList.add('hidden');
        document.getElementById('appContainer').classList.add('active');
        document.getElementById('userDisplayName').textContent = Storage.currentUser.name;
        const badge = document.getElementById('userRoleBadge');
        badge.textContent = Storage.currentUser.role === 'admin' ? 'ادمین' : 'کاربر';
        badge.className = 'badge ' + (Storage.currentUser.role === 'admin' ? 'badge-admin' : 'badge-user');
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = Storage.currentUser.role === 'admin' ? 'block' : 'none');
        if (typeof App !== 'undefined') App.init();
    },
    
    logout() {
        if (typeof Pomodoro !== 'undefined') Pomodoro.pause();
        Storage.currentUser = null;
        document.getElementById('loginOverlay').classList.remove('hidden');
        document.getElementById('appContainer').classList.remove('active');
    },
    
    showRegisterForm() {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
    },
    showLoginForm() {
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
    }
};
