// ============ AUTH SYSTEM WITH API ============
const Auth = {
    apiURL: '/api', // Vercel Functions path
    
    async register(username, email, password, passwordConfirm, name) {
        // اعتبارسنجی front-end
        if (!username || !email || !password || !passwordConfirm) {
            Utils.showToast('⚠️ همه فیلدهای اجباری را پر کنید');
            return false;
        }
        
        if (username.length < 3) {
            Utils.showToast('⚠️ نام کاربری حداقل ۳ کاراکتر باشد');
            return false;
        }
        
        if (password.length < 4) {
            Utils.showToast('⚠️ رمز عبور حداقل ۴ کاراکتر باشد');
            return false;
        }
        
        if (password !== passwordConfirm) {
            Utils.showToast('⚠️ رمز عبور و تکرار آن مطابقت ندارند');
            return false;
        }
        
        if (!email.includes('@') || !email.includes('.')) {
            Utils.showToast('⚠️ ایمیل معتبر وارد کنید');
            return false;
        }
        
        try {
            const response = await fetch(`${this.apiURL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password, name: name || username })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                Utils.showToast('❌ ' + (data.error || 'خطا در ثبت‌نام'));
                return false;
            }
            
            // ثبت‌نام موفق - مستقیم لاگین کن
            Storage.currentUser = data.user;
            this.onLoginSuccess();
            Utils.showToast('✅ ثبت‌نام و ورود موفق!');
            return true;
        } catch(e) {
            Utils.showToast('❌ خطا در ارتباط با سرور');
            return false;
        }
    },
    
    async login(username, password) {
        if (!username || !password) {
            Utils.showToast('⚠️ نام کاربری و رمز عبور را وارد کنید');
            return false;
        }
        
        try {
            const response = await fetch(`${this.apiURL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                Utils.showToast('❌ ' + (data.error || 'خطا در ورود'));
                return false;
            }
            
            Storage.currentUser = data.user;
            this.onLoginSuccess();
            Utils.showToast(`✅ خوش آمدید ${data.user.name}`);
            return true;
        } catch(e) {
            // Fallback: استفاده از localStorage برای admin
            if (Storage.USERS[username] && Storage.USERS[username].password === password) {
                Storage.currentUser = { username, ...Storage.USERS[username] };
                this.onLoginSuccess();
                Utils.showToast(`✅ خوش آمدید ${Storage.USERS[username].name}`);
                return true;
            }
            Utils.showToast('❌ خطا در ارتباط با سرور');
            return false;
        }
    },
    
    onLoginSuccess() {
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