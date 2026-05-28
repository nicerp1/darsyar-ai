// ============ AUTH SYSTEM - FINAL FIXED ============
const Auth = {
    apiURL: '/api',
    
    login: async function(username, password) {
        console.log('LOGIN CALLED:', username, password);
        
        if (!username || !password || username.trim() === '' || password.trim() === '') {
            alert('⚠️ نام کاربری و رمز عبور را وارد کنید');
            return false;
        }
        
        // اول admin رو چک کن (سریع و قطعی)
        if (username === 'admin' && password === '1234') {
            console.log('Admin login success');
            Storage.currentUser = { username: 'admin', name: 'مدیر', role: 'admin' };
            this.goToApp();
            return true;
        }
        
        // بعد API رو امتحان کن
        try {
            console.log('Trying API...');
            const res = await fetch(`${this.apiURL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username, password: password })
            });
            const data = await res.json();
            console.log('API response:', data);
            
            if (res.ok && data.success) {
                Storage.currentUser = data.user;
                this.goToApp();
                return true;
            }
        } catch(e) {
            console.log('API failed:', e);
        }
        
        // چک localStorage
        try {
            const savedUsers = JSON.parse(localStorage.getItem('serverUsers') || '{}');
            if (savedUsers[username] && savedUsers[username].password === password) {
                Storage.currentUser = savedUsers[username];
                this.goToApp();
                return true;
            }
        } catch(e) {}
        
        alert('❌ نام کاربری یا رمز عبور اشتباه است');
        return false;
    },
    
    register: async function(username, email, password, passwordConfirm, name) {
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
                Storage.currentUser = data.user;
                this.goToApp();
                return true;
            }
            alert('❌ ' + (data.error || 'خطا'));
            return false;
        } catch(e) {
            alert('❌ سرور در دسترس نیست');
            return false;
        }
    },
    
    goToApp: function() {
        document.getElementById('loginOverlay').classList.add('hidden');
        document.getElementById('appContainer').classList.add('active');
        document.getElementById('userDisplayName').textContent = Storage.currentUser.name;
        const badge = document.getElementById('userRoleBadge');
        badge.textContent = Storage.currentUser.role === 'admin' ? 'ادمین' : 'کاربر';
        badge.className = 'badge ' + (Storage.currentUser.role === 'admin' ? 'badge-admin' : 'badge-user');
        document.querySelectorAll('.admin-only').forEach(function(el) { el.style.display = Storage.currentUser.role === 'admin' ? 'block' : 'none'; });
        if (typeof App !== 'undefined') App.init();
    },
    
    logout: function() {
        if (typeof Pomodoro !== 'undefined') Pomodoro.pause();
        Storage.currentUser = null;
        document.getElementById('loginOverlay').classList.remove('hidden');
        document.getElementById('appContainer').classList.remove('active');
    },
    
    showRegisterForm: function() {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
    },
    showLoginForm: function() {
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
    }
};
