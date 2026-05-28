// ============ AUTH SYSTEM - DIRECT LOCALSTORAGE ============
const Auth = {
    login: function(username, password) {
        // چک کردن admin
        if (username === 'admin' && password === '1234') {
            // اطلاعات رو توی localStorage ذخیره کن
            localStorage.setItem('currentUser', JSON.stringify({ username: 'admin', name: 'مدیر', role: 'admin' }));
            // مستقیم برو توی سایت
            document.getElementById('loginOverlay').style.display = 'none';
            document.getElementById('appContainer').style.display = 'block';
            // اسم کاربر رو نشون بده
            document.getElementById('userDisplayName').textContent = 'مدیر';
            // App رو اجرا کن
            if (typeof App !== 'undefined') App.init();
        } else {
            alert('نام کاربری یا رمز عبور اشتباه است');
        }
    },
    logout: function() {
        localStorage.removeItem('currentUser');
        document.getElementById('loginOverlay').style.display = 'flex';
        document.getElementById('appContainer').style.display = 'none';
    },
    showRegisterForm: function() {
        alert('بخش ثبت نام به زودی فعال می‌شود.');
    },
    showLoginForm: function() {}
};
