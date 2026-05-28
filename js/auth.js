// ============ AUTH SYSTEM - ساده و مستقیم ============
const Auth = {
    login: function(username, password) {
        if (username === 'admin' && password === '1234') {
            localStorage.setItem('currentUser', JSON.stringify({ username: 'admin', name: 'مدیر', role: 'admin' }));
            document.getElementById('loginOverlay').classList.add('hidden');
            document.getElementById('appContainer').classList.add('active');
            document.getElementById('userDisplayName').textContent = 'مدیر';
            if (typeof App !== 'undefined') App.init();
        } else {
            alert('نام کاربری یا رمز عبور اشتباه است');
        }
    },
    logout: function() {
        localStorage.removeItem('currentUser');
        document.getElementById('loginOverlay').classList.remove('hidden');
        document.getElementById('appContainer').classList.remove('active');
    },
    showRegisterForm: function() {
        alert('بخش ثبت نام به زودی');
    },
    showLoginForm: function() {}
};

// اضافه کردن قابلیت Enter برای ورود آسان
document.addEventListener('DOMContentLoaded', function() {
    var usernameInput = document.getElementById('loginUsername');
    var passwordInput = document.getElementById('loginPassword');
    var loginButton = document.getElementById('loginSubmitBtn');

    function doLogin() {
        Auth.login(usernameInput.value, passwordInput.value);
    }

    // رویداد کلیک روی دکمه
    if (loginButton) {
        loginButton.addEventListener('click', doLogin);
    }

    // رویداد فشردن کلید Enter روی فیلد رمز عبور
    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                doLogin();
            }
        });
    }
    
    // رویداد فشردن کلید Enter روی فیلد نام کاربری (برای راحتی)
    if (usernameInput) {
        usernameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                passwordInput.focus(); // بره روی فیلد رمز
            }
        });
    }
});
