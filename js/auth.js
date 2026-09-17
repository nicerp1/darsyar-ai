/**
 * StudyMate Pro - Authentication & Access Management
 */

const Auth = (function () {
    let currentTab = 'login';

    function init() {
        renderAuthUI();
        setupKeyListeners();
    }

    function setupKeyListeners() {
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                const loginBtn = document.getElementById('btn-auth-submit');
                if (loginBtn && document.getElementById('auth-view') && !document.getElementById('auth-view').classList.contains('hidden')) {
                    handleAuthSubmit();
                }
            }
        });
    }

    function renderAuthUI() {
        const authContainer = document.getElementById('auth-view');
        if (!authContainer) return;

        authContainer.innerHTML = `
            <div class="auth-wrapper">
                <div class="auth-card animate-fade-in">
                    <div class="brand-logo" style="justify-content: center; margin-bottom: 12px;">
                        <div class="brand-icon">
                            <span class="material-symbols-outlined" style="font-size: 28px;">school</span>
                        </div>
                    </div>
                    <h2 style="font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 4px;">سامانه هوشمند درسیار</h2>
                    <p style="font-size: 12px; color: var(--text-muted);">پلتفرم جامع و هوشمند موفقیت تحصیلی و کنکور</p>

                    <div class="auth-tabs">
                        <button class="auth-tab-btn ${currentTab === 'login' ? 'active' : ''}" onclick="Auth.switchTab('login')">ورود به حساب</button>
                        <button class="auth-tab-btn ${currentTab === 'register' ? 'active' : ''}" onclick="Auth.switchTab('register')">ثبت‌نام جدید</button>
                    </div>

                    <form id="auth-form" onsubmit="event.preventDefault(); Auth.handleAuthSubmit();">
                        ${currentTab === 'register' ? `
                            <div class="form-group" style="text-align: right;">
                                <label class="form-label">نام و نام خانوادگی</label>
                                <input type="text" id="auth-name" class="form-control" placeholder="مثال: علی رضایی" required>
                            </div>
                            <div class="form-group" style="text-align: right;">
                                <label class="form-label">رشته و مقطع تحصیلی</label>
                                <select id="auth-grade" class="form-control">
                                    <option value="دوازدهم تجربی">دوازدهم تجربی</option>
                                    <option value="دوازدهم ریاضی">دوازدهم ریاضی</option>
                                    <option value="دوازدهم انسانی">دوازدهم انسانی</option>
                                    <option value="دانشجوی کارشناسی">دانشجوی کارشناسی</option>
                                    <option value="پایه‌های دهم و یازدهم">پایه‌های دهم و یازدهم</option>
                                    <option value="سایر مقاطع">سایر مقاطع</option>
                                </select>
                            </div>
                        ` : ''}

                        <div class="form-group" style="text-align: right;">
                            <label class="form-label">نام کاربری</label>
                            <input type="text" id="auth-username" class="form-control" placeholder="مثال: admin یا user" required autocomplete="username">
                        </div>

                        <div class="form-group" style="text-align: right;">
                            <label class="form-label">رمز عبور</label>
                            <input type="password" id="auth-password" class="form-control" placeholder="رمز عبور خود را وارد کنید" required autocomplete="current-password">
                        </div>

                        <button type="submit" id="btn-auth-submit" class="btn-gold" style="width: 100%; margin-top: 10px;">
                            <span class="material-symbols-outlined">${currentTab === 'login' ? 'login' : 'person_add'}</span>
                            ${currentTab === 'login' ? 'ورود به درسیار' : 'ایجاد حساب کاربری'}
                        </button>
                    </form>

                </div>
            </div>
        `;
    }

    function switchTab(tab) {
        currentTab = tab;
        renderAuthUI();
    }

    function fillDemo(type) {
        const usernameInput = document.getElementById('auth-username');
        const passInput = document.getElementById('auth-password');
        if (usernameInput && passInput) {
            usernameInput.value = type;
            passInput.value = '1234';
            handleAuthSubmit();
        }
    }

    async function handleAuthSubmit() {
        const usernameInput = document.getElementById('auth-username');
        const passInput = document.getElementById('auth-password');

        if (!usernameInput || !passInput) return;

        const username = usernameInput.value.trim();
        const password = passInput.value.trim();

        if (!username || !password) {
            if (typeof Utils !== 'undefined') {
                Utils.showToast('لطفاً نام کاربری و رمز عبور را وارد کنید.', 'warning');
            } else {
                alert('لطفاً نام کاربری و رمز عبور را وارد کنید.');
            }
            return;
        }

        const submitButton = document.getElementById('btn-auth-submit');
        if (submitButton) submitButton.disabled = true;
        try {
            if (currentTab === 'login') {
                const user = await Storage.login(username, password);
                if (typeof Utils !== 'undefined') Utils.showToast(`خوش آمدید، ${user.name}!`, 'success');
            } else {
            const nameInput = document.getElementById('auth-name');
            const gradeInput = document.getElementById('auth-grade');
            const name = nameInput ? nameInput.value.trim() : username;
            const grade = gradeInput ? gradeInput.value : 'دوازدهم تجربی';
                await Storage.register({ username, password, name: name || username, grade });
                if (typeof Utils !== 'undefined') {
                Utils.showToast(`ثبت‌نام شما با موفقیت انجام شد، خوش آمدید ${name}!`, 'success');
                Utils.launchConfetti();
                }
            }
            if (typeof App !== 'undefined') App.onUserChanged();
        } catch (error) {
            if (typeof Utils !== 'undefined') Utils.showToast(error.message, 'error');
            else alert(error.message);
        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    }

    async function logout() {
        await Storage.logout();
        if (typeof Utils !== 'undefined') {
            Utils.showToast('با موفقیت از سیستم خارج شدید.', 'info');
        }
        if (typeof App !== 'undefined') {
            App.onUserChanged();
        }
    }

    return {
        init,
        switchTab,
        fillDemo,
        handleAuthSubmit,
        logout
    };
})();

if (typeof window !== 'undefined') {
    window.Auth = Auth;
}
