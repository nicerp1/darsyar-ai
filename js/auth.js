/**
 * StudyMate Pro - Authentication & Access Management
 */

const Auth = (function () {
    let currentTab = 'login';
    let registerStep = 1;
    let registerDraft = { accountType: 'student', name: '', grade: 'دوازدهم تجربی', ageGroup: 'adult', legalAccepted: false, parentalConsent: false };

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
                    <div class="brand-logo auth-brand" style="justify-content: center; margin-bottom: 12px;">
                        <div class="brand-icon">
                            <img src="icons/icon-192.png" alt="نشان درسیار" width="58" height="58">
                        </div>
                    </div>
                    <h1 class="auth-title">درسیار</h1>
                    <p class="auth-subtitle">همراه هوشمند مسیر مطالعه و موفقیت</p>
                    <div class="auth-welcome-copy">
                        <h2>${currentTab === 'login' ? 'خوش آمدید!' : (registerStep === 1 ? 'حساب مناسب خودت را بساز' : registerStep === 2 ? 'امنیت و حریم خصوصی' : 'اطلاعات ورود')}</h2>
                        <p>${currentTab === 'login' ? 'با تمرکز بیشتر، به نسخه بهتر خودت نزدیک‌تر شو.' : (registerStep === 1 ? 'فقط چند قدم کوتاه تا شروع مسیر پیشرفت.' : registerStep === 2 ? 'شرایط استفاده متناسب با سن را تأیید کن.' : 'یک نام کاربری و رمز امن انتخاب کن.')}</p>
                    </div>

                    <div class="auth-tabs">
                        <button class="auth-tab-btn ${currentTab === 'login' ? 'active' : ''}" onclick="Auth.switchTab('login')">ورود به حساب</button>
                        <button class="auth-tab-btn ${currentTab === 'register' ? 'active' : ''}" onclick="Auth.switchTab('register')">ثبت‌نام جدید</button>
                    </div>

                    ${currentTab === 'register' ? `<div class="auth-step-indicator"><span class="active"></span><span class="${registerStep >= 2 ? 'active' : ''}"></span><span class="${registerStep === 3 ? 'active' : ''}"></span><small>مرحله ${registerStep} از ۳</small></div>` : ''}
                    <form id="auth-form" onsubmit="event.preventDefault(); ${currentTab === 'register' && registerStep < 3 ? `Auth.goToRegisterStep(${registerStep + 1})` : 'Auth.handleAuthSubmit()'};">
                        ${currentTab === 'register' && registerStep === 1 ? `
                            <fieldset class="auth-role-picker">
                                <legend>نوع حساب کاربری</legend>
                                <label class="auth-role-option ${registerDraft.accountType === 'student' ? 'active' : ''}"><input type="radio" name="auth-account-type" value="student" ${registerDraft.accountType === 'student' ? 'checked' : ''} onchange="Auth.updateRoleFields()"><span class="material-symbols-outlined" aria-hidden="true">school</span><span><strong>دانش‌آموز</strong><small>برنامه و گزارش مطالعه</small></span></label>
                                <label class="auth-role-option ${registerDraft.accountType === 'advisor' ? 'active' : ''}"><input type="radio" name="auth-account-type" value="advisor" ${registerDraft.accountType === 'advisor' ? 'checked' : ''} onchange="Auth.updateRoleFields()"><span class="material-symbols-outlined" aria-hidden="true">supervisor_account</span><span><strong>مشاور</strong><small>مدیریت دانش‌آموزان</small></span></label>
                            </fieldset>
                            <div class="form-group" style="text-align: right;">
                                <label class="form-label">نام و نام خانوادگی</label>
                                <input type="text" id="auth-name" class="form-control" value="${escapeHtml(registerDraft.name)}" placeholder="مثال: علی رضایی" required>
                            </div>
                            <div id="auth-grade-group" class="form-group" style="text-align: right;">
                                <label id="auth-grade-label" class="form-label">رشته و مقطع تحصیلی</label>
                                <select id="auth-grade" class="form-control">
                                    <option value="دوازدهم تجربی">دوازدهم تجربی</option>
                                    <option value="دوازدهم ریاضی">دوازدهم ریاضی</option>
                                    <option value="دوازدهم انسانی">دوازدهم انسانی</option>
                                    <option value="دانشجوی کارشناسی">دانشجوی کارشناسی</option>
                                    <option value="پایه‌های دهم و یازدهم">پایه‌های دهم و یازدهم</option>
                                    <option value="سایر مقاطع">سایر مقاطع</option>
                                </select>
                            </div>
                            <button type="submit" class="btn-gold auth-next-button"><span>ادامه</span><span class="material-symbols-outlined">arrow_back</span></button>
                        ` : ''}
                        ${currentTab === 'register' && registerStep === 2 ? `<div class="auth-consent-fields">
                                <label class="form-label" for="auth-age-group">رده سنی</label>
                                <select id="auth-age-group" class="form-control" onchange="Auth.updateConsentFields()"><option value="adult" ${registerDraft.ageGroup === 'adult' ? 'selected' : ''}>۱۸ سال یا بیشتر</option><option value="under18" ${registerDraft.ageGroup === 'under18' ? 'selected' : ''}>کمتر از ۱۸ سال</option></select>
                                <label class="auth-check"><input id="auth-legal-accepted" type="checkbox" ${registerDraft.legalAccepted ? 'checked' : ''}><span>قوانین و <a href="privacy.html" target="_blank" rel="noopener">حریم خصوصی درسیار</a> را خوانده‌ام و می‌پذیرم.</span></label>
                                <label id="auth-parental-consent-row" class="auth-check ${registerDraft.ageGroup === 'under18' ? '' : 'hidden'}"><input id="auth-parental-consent" type="checkbox" ${registerDraft.parentalConsent ? 'checked' : ''}><span>والد یا سرپرست قانونی با ساخت حساب و پردازش داده‌ها موافق است.</span></label>
                                <div class="auth-submit-row"><button type="button" class="auth-back-button" onclick="Auth.goToRegisterStep(1)" aria-label="بازگشت"><span class="material-symbols-outlined">arrow_forward</span></button><button type="submit" class="btn-gold auth-next-button"><span>ادامه</span><span class="material-symbols-outlined">arrow_back</span></button></div>
                            </div>
                        ` : ''}

                        ${currentTab === 'login' || registerStep === 3 ? `
                        <div class="form-group auth-field" style="text-align: right;">
                            <label class="form-label">نام کاربری</label>
                            <div class="auth-input-wrap"><span class="material-symbols-outlined" aria-hidden="true">person</span><input type="text" id="auth-username" class="form-control" placeholder="نام کاربری خود را وارد کنید" required autocomplete="username"></div>
                        </div>

                        <div class="form-group auth-field" style="text-align: right;">
                            <label class="form-label">رمز عبور${currentTab === 'register' ? '؛ حداقل ۸ نویسه' : ''}</label>
                            <div class="auth-input-wrap"><span class="material-symbols-outlined" aria-hidden="true">lock</span><input type="password" id="auth-password" class="form-control" placeholder="رمز عبور خود را وارد کنید" required autocomplete="${currentTab === 'login' ? 'current-password' : 'new-password'}"><button type="button" onclick="Auth.togglePassword()" aria-label="نمایش یا پنهان کردن رمز عبور"><span class="material-symbols-outlined" id="auth-password-icon" aria-hidden="true">visibility</span></button></div>
                        </div>
                        ` : ''}

                        ${currentTab === 'login' ? '<button class="auth-forgot" type="button" onclick="Utils.showToast(\'برای بازیابی رمز با پشتیبانی درسیار تماس بگیرید.\', \'info\')">رمز عبور را فراموش کرده‌اید؟</button>' : ''}

                        ${currentTab === 'login' || registerStep === 3 ? `<div class="auth-submit-row">
                        ${currentTab === 'register' ? '<button type="button" class="auth-back-button" onclick="Auth.goToRegisterStep(2)" aria-label="بازگشت"><span class="material-symbols-outlined">arrow_forward</span></button>' : ''}
                        <button type="submit" id="btn-auth-submit" class="btn-gold" style="width: 100%; margin-top: 10px;">
                            <span class="material-symbols-outlined">${currentTab === 'login' ? 'login' : 'person_add'}</span>
                            ${currentTab === 'login' ? 'ورود به درسیار' : 'ایجاد حساب کاربری'}
                        </button>
                        </div>` : ''}
                    </form>

                </div>
            </div>
        `;
    }

    function switchTab(tab) {
        currentTab = tab;
        registerStep = 1;
        renderAuthUI();
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    }

    function goToRegisterStep(step) {
        if (step === 2 && registerStep === 1) {
            const name = document.getElementById('auth-name')?.value.trim();
            if (!name) {
                if (typeof Utils !== 'undefined') Utils.showToast('نام و نام خانوادگی را وارد کنید.', 'warning');
                return;
            }
            registerDraft = {
                accountType: document.querySelector('input[name="auth-account-type"]:checked')?.value || 'student',
                name,
                grade: document.getElementById('auth-grade')?.value || 'سایر مقاطع', ageGroup: registerDraft.ageGroup, legalAccepted: registerDraft.legalAccepted, parentalConsent: registerDraft.parentalConsent
            };
        }
        if (step === 3 && registerStep === 2) {
            const ageGroup = document.getElementById('auth-age-group')?.value === 'under18' ? 'under18' : 'adult';
            const legalAccepted = document.getElementById('auth-legal-accepted')?.checked === true;
            const parentalConsent = document.getElementById('auth-parental-consent')?.checked === true;
            if (!legalAccepted) return Utils.showToast('پذیرش قوانین و حریم خصوصی الزامی است.', 'warning');
            if (ageGroup === 'under18' && !parentalConsent) return Utils.showToast('تأیید رضایت والد یا سرپرست قانونی الزامی است.', 'warning');
            Object.assign(registerDraft, { ageGroup, legalAccepted, parentalConsent });
        }
        registerStep = step;
        renderAuthUI();
    }

    function updateRoleFields() {
        const type = document.querySelector('input[name="auth-account-type"]:checked')?.value || 'student';
        document.querySelectorAll('.auth-role-option').forEach(label => label.classList.toggle('active', label.querySelector('input')?.checked));
        const label = document.getElementById('auth-grade-label');
        const select = document.getElementById('auth-grade');
        if (label) label.textContent = type === 'advisor' ? 'حوزه تخصص مشاوره' : 'رشته و مقطع تحصیلی';
        if (select && type === 'advisor') select.innerHTML = '<option value="مشاور تحصیلی">مشاور تحصیلی</option><option value="مشاور کنکور">مشاور کنکور</option><option value="برنامه‌ریز درسی">برنامه‌ریز درسی</option><option value="مشاور دانشگاهی">مشاور دانشگاهی</option>';
        else if (select) select.innerHTML = '<option value="دوازدهم تجربی">دوازدهم تجربی</option><option value="دوازدهم ریاضی">دوازدهم ریاضی</option><option value="دوازدهم انسانی">دوازدهم انسانی</option><option value="دانشجوی کارشناسی">دانشجوی کارشناسی</option><option value="پایه‌های دهم و یازدهم">پایه‌های دهم و یازدهم</option><option value="سایر مقاطع">سایر مقاطع</option>';
    }

    function updateConsentFields() {
        const under18 = document.getElementById('auth-age-group')?.value === 'under18';
        document.getElementById('auth-parental-consent-row')?.classList.toggle('hidden', !under18);
    }

    function togglePassword() {
        const input = document.getElementById('auth-password'), icon = document.getElementById('auth-password-icon');
        if (!input) return;
        const visible = input.type === 'text'; input.type = visible ? 'password' : 'text';
        if (icon) icon.textContent = visible ? 'visibility' : 'visibility_off';
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
            const accountType = registerDraft.accountType;
            const name = registerDraft.name || username;
            const grade = registerDraft.grade;
                await Storage.register({ username, password, name: name || username, grade, accountType, ageGroup: registerDraft.ageGroup, legalAccepted: registerDraft.legalAccepted, parentalConsent: registerDraft.parentalConsent });
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
        updateRoleFields,
        updateConsentFields,
        goToRegisterStep,
        togglePassword,
        fillDemo,
        handleAuthSubmit,
        logout
    };
})();

if (typeof window !== 'undefined') {
    window.Auth = Auth;
}
