// ============ AUTH SYSTEM - FINAL FIXED ============
const Auth = {
    apiURL: '/api',
    
    async register(username, email, password, passwordConfirm, name) {
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
            // اول تلاش برای API
            const response = await fetch(`${this.apiURL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password, name: name || username })
            });
            
            if (response.ok) {
                const data = await response.json();
                Storage.currentUser = data.user;
                this.onLoginSuccess();
                Utils.showToast('✅ ثبت‌نام و ورود موفق!');
                return true;
            }
            
            // اگه API کار نکرد، توی localStorage ذخیره کن
            const savedUsers = JSON.parse(localStorage.getItem('serverUsers') || '{}');
            if (savedUsers[username]) {
                Utils.showToast('⚠️ این نام کاربری قبلاً ثبت شده');
                return false;
            }
            
            savedUsers[username] = {
                password, email, name: name || username,
                role: 'user', subscription: 'free',
                createdAt: new Date().toISOString()
            };
            localStorage.setItem('serverUsers', JSON.stringify(savedUsers));
            
            Storage.currentUser = { username, ...savedUsers[username] };
            this.onLoginSuccess();
            Utils.showToast('✅ ثبت‌نام و ورود موفق! (آفلاین)');
            return true;
            
        } catch(e) {
            // Fallback کامل به localStorage
            const savedUsers = JSON.parse(localStorage.getItem('serverUsers') || '{}');
            if (savedUsers[username]) {
                Utils.showToast('⚠️ این نام کاربری قبلاً ثبت شده');
                return false;
            }
            
            savedUsers[username] = {
                password, email, name: name || username,
                role: 'user', subscription: 'free',
                createdAt: new Date().toISOString()
            };
            localStorage.setItem('serverUsers', JSON.stringify(savedUsers));
            
            Storage.currentUser = { username, ...savedUsers[username] };
            this.onLoginSuccess();
            Utils.showToast('✅ ثبت‌نام و ورود موفق! (آفلاین)');
            return true;
        }
    },
    
    async login(username, password) {
        if (!username || !password) {
            Utils.showToast('⚠️ نام کاربری و رمز عبور را وارد کنید');
            return false;
        }
        
        // ۱. چک localStorage اصلی (admin)
        if (Storage.USERS[username] && Storage.USERS[username].password === password) {
            Storage.currentUser = { username, ...Storage.USERS[username] };
            this.onLoginSuccess();
            Utils.showToast(`✅ خوش آمدید ${Storage.USERS[username].name}`);
            return true;
        }
        
        // ۲. چک کاربرای ثبت‌نامی توی localStorage
        const savedUsers = JSON.parse(localStorage.getItem('serverUsers') || '{}');
        if (savedUsers[username] && savedUsers[username].password === password) {
            Storage.currentUser = { username, ...savedUsers[username] };
            this.onLoginSuccess();
            Utils.showToast(`✅ خوش آمدید ${savedUsers[username].name}`);
            return true;
        }
        
        // ۳. تلاش برای API
        try {
            const response = await fetch(`${this.apiURL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            if (response.ok) {
                const data = await response.json();
                Storage.currentUser = data.user;
                this.onLoginSuccess();
                Utils.showToast(`✅ خوش آمدید ${data.user.name}`);
                return true;
            }
        } catch(e) {
            // API در دسترس نیست - قبلاً چک شده
        }
        
        Utils.showToast('❌ نام کاربری یا رمز عبور اشتباه است');
        return false;
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
