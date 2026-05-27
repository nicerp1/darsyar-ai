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
            const response = await fetch(`${this.apiURL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password, name: name || username })
            });
            
            const data = await response.json();
            console.log('Register response:', data);
            
            if (!response.ok) {
                Utils.showToast('❌ ' + (data.error || 'خطا در ثبت‌نام'));
                return false;
            }
            
            // ذخیره کاربر توی localStorage برای لاگین بعدی
            const savedUsers = JSON.parse(localStorage.getItem('serverUsers') || '{}');
            savedUsers[username] = {
                password, email, name: name || username,
                role: 'user', subscription: 'free',
                createdAt: new Date().toISOString()
            };
            localStorage.setItem('serverUsers', JSON.stringify(savedUsers));
            
            Storage.currentUser = data.user;
            this.onLoginSuccess();
            Utils.showToast('✅ ثبت‌نام و ورود موفق!');
            return true;
        } catch(e) {
            console.error('Register error:', e);
            Utils.showToast('❌ خطا در ارتباط با سرور');
            return false;
        }
    },
    
    async login(username, password) {
        console.log('Login called with:', username, password);
        
        if (!username || !password) {
            Utils.showToast('⚠️ نام کاربری و رمز عبور را وارد کنید');
            return false;
        }
        
        // ۱. چک localStorage اصلی (admin)
        if (Storage.USERS[username] && Storage.USERS[username].password === password) {
            console.log('Found in Storage.USERS');
            Storage.currentUser = { username, ...Storage.USERS[username] };
            this.onLoginSuccess();
            Utils.showToast(`✅ خوش آمدید ${Storage.USERS[username].name}`);
            return true;
        }
        
        // ۲. چک کاربرای ثبت‌نامی توی localStorage
        const savedUsers = JSON.parse(localStorage.getItem('serverUsers') || '{}');
        console.log('Saved users:', Object.keys(savedUsers));
        console.log('Checking for:', username);
        console.log('User found:', savedUsers[username] ? 'YES' : 'NO');
        console.log('Password match:', savedUsers[username] && savedUsers[username].password === password ? 'YES' : 'NO');
        
        if (savedUsers[username] && savedUsers[username].password === password) {
            console.log('Found in localStorage serverUsers');
            Storage.currentUser = { username, ...savedUsers[username] };
            this.onLoginSuccess();
            Utils.showToast(`✅ خوش آمدید ${savedUsers[username].name}`);
            return true;
        }
        
        // ۳. تلاش برای API
        try {
            console.log('Trying API login...');
            const response = await fetch(`${this.apiURL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            console.log('API response status:', response.status);
            const data = await response.json();
            console.log('API response data:', data);
            
            if (response.ok) {
                Storage.currentUser = data.user;
                this.onLoginSuccess();
                Utils.showToast(`✅ خوش آمدید ${data.user.name}`);
                return true;
            } else {
                Utils.showToast('❌ ' + (data.error || 'خطا در ورود'));
                return false;
            }
        } catch(e) {
            console.error('Login API error:', e);
            Utils.showToast('❌ نام کاربری یا رمز عبور اشتباه است');
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
