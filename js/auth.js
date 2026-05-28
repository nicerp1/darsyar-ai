// ============ AUTH SYSTEM - FINAL FIXED ============
const Auth = {
    apiURL: '/api',
    
    async login(username, password) {
        if (!username || !password) {
            alert('⚠️ نام کاربری و رمز عبور را وارد کنید');
            return false;
        }
        
        // اول admin رو چک کن (سریع و قطعی)
        if (username === 'admin' && password === '1234') {
            this.setUser({ username: 'admin', name: 'مدیر', role: 'admin' });
            return true;
        }
        
        // بعد API رو امتحان کن
        try {
            const res = await fetch(`${this.apiURL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    this.setUser(data.user);
                    return true;
                }
            }
        } catch(e) {
            console.log('API failed, trying localStorage');
        }
        
        // Fallback به localStorage
        try {
            const savedUsers = JSON.parse(localStorage.getItem('serverUsers') || '{}');
            if (savedUsers[username] && savedUsers[username].password === password) {
                this.setUser(savedUsers[username]);
                return true;
            }
        } catch(e) {}
        
        alert('❌ نام کاربری یا رمز عبور اشتباه است');
        return false;
    },
    
    setUser(user) {
        Storage.currentUser = user;
        document.getElementById('loginOverlay').classList.add('hidden');
        document.getElementById('appContainer').classList.add('active');
        document.getElementById('userDisplayName').textContent = user.name;
        
        const badge = document.getElementById('userRoleBadge');
        if (badge) {
            badge.textContent = user.role === 'admin' ? 'ادمین' : 'کاربر';
            badge.className = 'badge ' + (user.role === 'admin' ? 'badge-admin' : 'badge-user');
        }
        
        document.querySelectorAll('.admin-only').forEach(function(el) {
            el.style.display = user.role === 'admin' ? 'block' : 'none';
        });
        
        if (typeof App !== 'undefined') App.init();
    },
    
    async register(username, email, password, passwordConfirm, name) {
        if (!username || !email || !password || !passwordConfirm) {
            alert('⚠️ همه فیلدهای اجباری را پر کنید');
            return false;
        }
        if (username.length < 3) { alert('⚠️ نام کاربری حداقل ۳ کاراکتر'); return false; }
        if (password.length < 4) { alert('⚠️ رمز عبور حداقل ۴ کاراکتر'); return false; }
        if (password !== passwordConfirm) { alert('⚠️ رمز و تکرار مطابقت ندارند'); return false; }
        
        try {
            const res = await fetch(`${this.apiURL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password, name: name || username })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                this.setUser(data.user);
                return true;
            }
            alert('❌ ' + (data.error || 'خطا'));
            return false;
        } catch(e) {
            alert('❌ سرور در دسترس نیست');
            return false;
        }
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
