// ============ AUTH SYSTEM - FINAL FIXED ============
const Auth = {
    apiURL: '/api',
    
    async register(username, email, password, passwordConfirm, name) {
        console.log('REGISTER called:', username, email);
        
        if (!username || !email || !password || !passwordConfirm) {
            if (typeof Utils !== 'undefined') Utils.showToast('⚠️ همه فیلدهای اجباری را پر کنید');
            return false;
        }
        
        if (username.length < 3) {
            if (typeof Utils !== 'undefined') Utils.showToast('⚠️ نام کاربری حداقل ۳ کاراکتر باشد');
            return false;
        }
        
        if (password.length < 4) {
            if (typeof Utils !== 'undefined') Utils.showToast('⚠️ رمز عبور حداقل ۴ کاراکتر باشد');
            return false;
        }
        
        if (password !== passwordConfirm) {
            if (typeof Utils !== 'undefined') Utils.showToast('⚠️ رمز عبور و تکرار آن مطابقت ندارند');
            return false;
        }
        
        if (!email.includes('@') || !email.includes('.')) {
            if (typeof Utils !== 'undefined') Utils.showToast('⚠️ ایمیل معتبر وارد کنید');
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
                if (typeof Utils !== 'undefined') Utils.showToast('❌ ' + (data.error || 'خطا در ثبت‌نام'));
                return false;
            }
            
            // ذخیره توی localStorage
            const savedUsers = JSON.parse(localStorage.getItem('serverUsers') || '{}');
            savedUsers[username] = { password, email, name: name || username, role: 'user', subscription: 'free', createdAt: new Date().toISOString() };
            localStorage.setItem('serverUsers', JSON.stringify(savedUsers));
            
            if (typeof Storage !== 'undefined') Storage.currentUser = { username, ...savedUsers[username] };
            this.onLoginSuccess();
            if (typeof Utils !== 'undefined') Utils.showToast('✅ ثبت‌نام و ورود موفق!');
            return true;
        } catch(e) {
            // Fallback به localStorage
            const savedUsers = JSON.parse(localStorage.getItem('serverUsers') || '{}');
            if (savedUsers[username]) {
                if (typeof Utils !== 'undefined') Utils.showToast('⚠️ این نام کاربری قبلاً ثبت شده');
                return false;
            }
            savedUsers[username] = { password, email, name: name || username, role: 'user', subscription: 'free', createdAt: new Date().toISOString() };
            localStorage.setItem('serverUsers', JSON.stringify(savedUsers));
            if (typeof Storage !== 'undefined') Storage.currentUser = { username, ...savedUsers[username] };
            this.onLoginSuccess();
            if (typeof Utils !== 'undefined') Utils.showToast('✅ ثبت‌نام و ورود موفق! (آفلاین)');
            return true;
        }
    },
    
    async login(username, password) {
        console.log('LOGIN called:', username, password);
        
        if (!username || !password) {
            if (typeof Utils !== 'undefined') Utils.showToast('⚠️ نام کاربری و رمز عبور را وارد کنید');
            return false;
        }
        
        // ۱. چک localStorage اصلی (admin)
        if (typeof Storage !== 'undefined' && Storage.USERS && Storage.USERS[username] && Storage.USERS[username].password === password) {
            console.log('Found in Storage.USERS');
            Storage.currentUser = { username, ...Storage.USERS[username] };
            this.onLoginSuccess();
            if (typeof Utils !== 'undefined') Utils.showToast('✅ خوش آمدید ' + Storage.USERS[username].name);
            return true;
        }
        
        // ۲. چک کاربرای ثبت‌نامی
        const savedUsers = JSON.parse(localStorage.getItem('serverUsers') || '{}');
        console.log('Saved users:', Object.keys(savedUsers));
        if (savedUsers[username] && savedUsers[username].password === password) {
            console.log('Found in serverUsers');
            if (typeof Storage !== 'undefined') Storage.currentUser = { username, ...savedUsers[username] };
            this.onLoginSuccess();
            if (typeof Utils !== 'undefined') Utils.showToast('✅ خوش آمدید ' + savedUsers[username].name);
            return true;
        }
        
        if (typeof Utils !== 'undefined') Utils.showToast('❌ نام کاربری یا رمز عبور اشتباه است');
        return false;
    },
    
    onLoginSuccess() {
        console.log('onLoginSuccess called');
        document.getElementById('loginOverlay').classList.add('hidden');
        document.getElementById('appContainer').classList.add('active');
        
        if (typeof Storage !== 'undefined' && Storage.currentUser) {
            document.getElementById('userDisplayName').textContent = Storage.currentUser.name;
            const badge = document.getElementById('userRoleBadge');
            badge.textContent = Storage.currentUser.role === 'admin' ? 'ادمین' : 'کاربر';
            badge.className = 'badge ' + (Storage.currentUser.role === 'admin' ? 'badge-admin' : 'badge-user');
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = Storage.currentUser.role === 'admin' ? 'block' : 'none');
        }
        
        if (typeof App !== 'undefined') App.init();
    },
    
    logout() {
        if (typeof Pomodoro !== 'undefined') Pomodoro.pause();
        if (typeof Storage !== 'undefined') Storage.currentUser = null;
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

// ============ DIRECT LOGIN FIX ============
console.log('Auth module loaded');
console.log('Auth.login type:', typeof Auth.login);
console.log('Auth.register type:', typeof Auth.register);

// درست کردن دکمه لاگین با addEventListener
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded fired');
    
    var loginBtn = document.getElementById('loginSubmitBtn');
    if (loginBtn) {
        console.log('loginBtn found, binding click');
        loginBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Login button clicked via addEventListener');
            var username = document.getElementById('loginUsername').value;
            var password = document.getElementById('loginPassword').value;
            console.log('Calling Auth.login with:', username);
            Auth.login(username, password);
        });
    } else {
        console.log('loginBtn NOT found');
    }
    
    var registerBtn = document.getElementById('registerSubmitBtn');
    if (registerBtn) {
        console.log('registerBtn found, binding click');
        registerBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Register button clicked via addEventListener');
            var username = document.getElementById('regUsername').value;
            var email = document.getElementById('regEmail').value;
            var password = document.getElementById('regPassword').value;
            var passwordConfirm = document.getElementById('regPasswordConfirm').value;
            var name = document.getElementById('regName').value;
            Auth.register(username, email, password, passwordConfirm, name);
        });
    }
});
