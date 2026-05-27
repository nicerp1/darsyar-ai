// ============ AUTH SYSTEM - ONLINE FIRST ============
const Auth = {
    apiURL: '/api',
    
    async register(username, email, password, passwordConfirm, name) {
        console.log('REGISTER called:', username);
        
        if (!username || !email || !password || !passwordConfirm) {
            alert('⚠️ همه فیلدهای اجباری را پر کنید');
            return false;
        }
        
        if (username.length < 3) {
            alert('⚠️ نام کاربری حداقل ۳ کاراکتر باشد');
            return false;
        }
        
        if (password.length < 4) {
            alert('⚠️ رمز عبور حداقل ۴ کاراکتر باشد');
            return false;
        }
        
        if (password !== passwordConfirm) {
            alert('⚠️ رمز عبور و تکرار آن مطابقت ندارند');
            return false;
        }
        
        if (!email.includes('@') || !email.includes('.')) {
            alert('⚠️ ایمیل معتبر وارد کنید');
            return false;
        }
        
        try {
            console.log('Trying API register...');
            const response = await fetch(`${this.apiURL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password, name: name || username })
            });
            
            console.log('API response status:', response.status);
            const data = await response.json();
            console.log('API response data:', data);
            
            if (response.ok && data.success) {
                // ذخیره توی localStorage هم
                const savedUsers = JSON.parse(localStorage.getItem('serverUsers') || '{}');
                savedUsers[username] = data.user;
                localStorage.setItem('serverUsers', JSON.stringify(savedUsers));
                
                Storage.currentUser = data.user;
                this.goToApp();
                alert('✅ ثبت‌نام و ورود موفق!');
                return true;
            } else {
                alert('❌ ' + (data.error || 'خطا در ثبت‌نام'));
                return false;
            }
        } catch(e) {
            console.error('API error:', e);
            alert('❌ سرور در دسترس نیست. بعداً تلاش کنید.');
            return false;
        }
    },
    
    async login(username, password) {
        console.log('LOGIN called:', username);
        
        if (!username || !password) {
            alert('⚠️ نام کاربری و رمز عبور را وارد کنید');
            return false;
        }
        
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
            
            if (response.ok && data.success) {
                // ذخیره توی localStorage هم
                const savedUsers = JSON.parse(localStorage.getItem('serverUsers') || '{}');
                savedUsers[username] = data.user;
                localStorage.setItem('serverUsers', JSON.stringify(savedUsers));
                
                Storage.currentUser = data.user;
                this.goToApp();
                alert('✅ خوش آمدید ' + data.user.name);
                return true;
            } else {
                alert('❌ ' + (data.error || 'نام کاربری یا رمز عبور اشتباه است'));
                return false;
            }
        } catch(e) {
            console.error('API error, trying localStorage:', e);
            
            // Fallback به localStorage
            const savedUsers = JSON.parse(localStorage.getItem('serverUsers') || '{}');
            if (savedUsers[username] && savedUsers[username].password === password) {
                Storage.currentUser = savedUsers[username];
                this.goToApp();
                alert('✅ خوش آمدید ' + savedUsers[username].name + ' (آفلاین)');
                return true;
            }
            
            // Fallback به admin
            if (Storage.USERS && Storage.USERS[username] && Storage.USERS[username].password === password) {
                Storage.currentUser = { username, ...Storage.USERS[username] };
                this.goToApp();
                alert('✅ خوش آمدید ' + Storage.USERS[username].name);
                return true;
            }
            
            alert('❌ نام کاربری یا رمز عبور اشتباه است');
            return false;
        }
    },
    
    goToApp() {
        document.getElementById('loginOverlay').classList.add('hidden');
        document.getElementById('appContainer').classList.add('active');
        document.getElementById('userDisplayName').textContent = Storage.currentUser.name;
        
        var badge = document.getElementById('userRoleBadge');
        if (badge) {
            badge.textContent = Storage.currentUser.role === 'admin' ? 'ادمین' : 'کاربر';
            badge.className = 'badge ' + (Storage.currentUser.role === 'admin' ? 'badge-admin' : 'badge-user');
        }
        
        var adminEls = document.querySelectorAll('.admin-only');
        for (var i = 0; i < adminEls.length; i++) {
            adminEls[i].style.display = Storage.currentUser.role === 'admin' ? 'block' : 'none';
        }
        
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
