/**
 * StudyMate Pro - Authentication & Access Management
 */

const Auth = (function () {
    let currentTab = 'login';
    let loginMethod = 'username';
    let registerStep = 1;
    let registerDraft = { accountType: 'student', name: '', grade: 'دوازدهم تجربی', ageGroup: 'adult', legalAccepted: false, parentalConsent: false };

    function init() {
        renderAuthUI();
        setupKeyListeners();
    }

    function setupKeyListeners() { /* Native form submit handles Enter; avoid duplicate authentication requests. */ }

    function renderAuthUI() {
        const authContainer = document.getElementById('auth-view');
        if (!authContainer) return;

        const heading = currentTab === 'login' ? 'خوش برگشتی' : (registerStep === 1 ? 'حساب تازه بساز' : registerStep === 2 ? 'حریم خصوصی و رضایت' : 'راه ورودت را بساز');
        const intro = currentTab === 'login' ? 'ادامه‌ی مسیرت از همین‌جا شروع می‌شود.' : (registerStep === 1 ? 'برای شروع، چند مشخصات کوتاه ازت می‌گیریم.' : registerStep === 2 ? 'این موارد برای امن و شفاف بودن تجربه ضروری‌اند.' : 'یک نام کاربری و رمز امن انتخاب کن.');
        authContainer.innerHTML = `
            <main class="auth-shell">
                <section class="auth-story" aria-label="درباره روند">
                    <div class="auth-story-brand"><img src="icons/ravand-192.png?v=2" alt="" width="48" height="48"><span><strong>روند</strong><small>همراه مسیر یادگیری</small></span></div>
                    <div class="auth-story-content">
                        <span class="auth-eyebrow"><i></i> مسیر خودت را بساز</span>
                        <h1>هر روز،<br><em>یک قدم جلوتر.</em></h1>
                        <p>برنامه‌ریزی، تمرکز و همراهی تحصیلی؛ همه در یک فضای شخصی برای رشد تو.</p>
                        <div class="auth-story-points"><span><b>01</b> برنامه‌ی منعطف</span><span><b>02</b> تمرکز هوشمند</span><span><b>03</b> پیشرفت قابل‌دیدن</span></div>
                    </div>
                    <div class="auth-story-footer"><span class="auth-orbit" aria-hidden="true"><i></i><i></i><i></i></span><span>مسیر یادگیری،<br><strong>به سبک تو.</strong></span></div>
                </section>
                <section class="auth-panel" aria-labelledby="auth-heading">
                    <div class="auth-mobile-brand"><img src="icons/ravand-192.png?v=2" alt="" width="42" height="42"><strong>روند</strong></div>
                    <div class="auth-panel-heading"><span class="auth-kicker">فضای یادگیری شخصی</span><h2 id="auth-heading">${heading}</h2><p>${intro}</p></div>
                    <div class="auth-tabs" role="tablist" aria-label="نوع دسترسی">
                        <button type="button" role="tab" aria-selected="${currentTab === 'login'}" class="auth-tab-btn ${currentTab === 'login' ? 'active' : ''}" onclick="Auth.switchTab('login')">ورود</button>
                        <button type="button" role="tab" aria-selected="${currentTab === 'register'}" class="auth-tab-btn ${currentTab === 'register' ? 'active' : ''}" onclick="Auth.switchTab('register')">ثبت‌نام</button>
                    </div>
                    ${currentTab === 'register' ? `<div class="auth-step-indicator" aria-label="مرحله ${registerStep} از ۳"><span class="${registerStep >= 1 ? 'active' : ''}"></span><span class="${registerStep >= 2 ? 'active' : ''}"></span><span class="${registerStep >= 3 ? 'active' : ''}"></span><small>${registerStep} / ۳</small></div>` : `
                    <div class="auth-method-tabs" role="tablist" aria-label="روش ورود">
                        <button type="button" role="tab" aria-selected="${loginMethod === 'username'}" class="${loginMethod === 'username' ? 'active' : ''}" onclick="Auth.switchLoginMethod('username')"><span class="material-symbols-outlined" aria-hidden="true">person</span> نام کاربری</button>
                        <button type="button" role="tab" aria-selected="${loginMethod === 'phone'}" class="${loginMethod === 'phone' ? 'active' : ''}" onclick="Auth.switchLoginMethod('phone')"><span class="material-symbols-outlined" aria-hidden="true">smartphone</span> شماره موبایل</button>
                    </div>`}
                    <form id="auth-form" class="auth-form" onsubmit="event.preventDefault(); ${currentTab === 'register' && registerStep < 3 ? `Auth.goToRegisterStep(${registerStep + 1})` : currentTab === 'login' && loginMethod === 'phone' ? 'Auth.handlePhoneContinue()' : 'Auth.handleAuthSubmit()'};">
                        ${currentTab === 'register' && registerStep === 1 ? `
                            <fieldset class="auth-role-picker"><legend>نوع حساب کاربری</legend>
                                <label class="auth-role-option ${registerDraft.accountType === 'student' ? 'active' : ''}"><input type="radio" name="auth-account-type" value="student" ${registerDraft.accountType === 'student' ? 'checked' : ''} onchange="Auth.updateRoleFields()"><span class="material-symbols-outlined" aria-hidden="true">school</span><span><strong>دانش‌آموز</strong><small>برنامه و گزارش مطالعه</small></span></label>
                                <label class="auth-role-option ${registerDraft.accountType === 'advisor' ? 'active' : ''}"><input type="radio" name="auth-account-type" value="advisor" ${registerDraft.accountType === 'advisor' ? 'checked' : ''} onchange="Auth.updateRoleFields()"><span class="material-symbols-outlined" aria-hidden="true">support_agent</span><span><strong>مشاور</strong><small>مدیریت دانش‌آموزان</small></span></label>
                            </fieldset>
                            <div class="form-group"><label class="form-label" for="auth-name">نام و نام خانوادگی</label><input type="text" id="auth-name" class="form-control" value="${escapeHtml(registerDraft.name)}" placeholder="مثلاً علی رضایی" autocomplete="name" required></div>
                            <div id="auth-grade-group" class="form-group"><label id="auth-grade-label" class="form-label" for="auth-grade">رشته و مقطع تحصیلی</label><select id="auth-grade" class="form-control"><option>دوازدهم تجربی</option><option>دوازدهم ریاضی</option><option>دوازدهم انسانی</option><option>دانشجوی کارشناسی</option><option>پایه‌های دهم و یازدهم</option><option>سایر مقاطع</option></select></div>
                            <button type="submit" class="auth-primary-button">ادامه <span class="material-symbols-outlined" aria-hidden="true">arrow_back</span></button>
                        ` : ''}
                        ${currentTab === 'register' && registerStep === 2 ? `<div class="auth-consent-fields">
                            <div class="form-group"><label class="form-label" for="auth-age-group">رده سنی</label><select id="auth-age-group" class="form-control" onchange="Auth.updateConsentFields()"><option value="adult" ${registerDraft.ageGroup === 'adult' ? 'selected' : ''}>۱۸ سال یا بیشتر</option><option value="under18" ${registerDraft.ageGroup === 'under18' ? 'selected' : ''}>کمتر از ۱۸ سال</option></select></div>
                            <label class="auth-check"><input id="auth-legal-accepted" type="checkbox" ${registerDraft.legalAccepted ? 'checked' : ''}><span>قوانین و <a href="privacy.html" target="_blank" rel="noopener">حریم خصوصی روند</a> را خوانده‌ام و می‌پذیرم.</span></label>
                            <label id="auth-parental-consent-row" class="auth-check ${registerDraft.ageGroup === 'under18' ? '' : 'hidden'}"><input id="auth-parental-consent" type="checkbox" ${registerDraft.parentalConsent ? 'checked' : ''}><span>والد یا سرپرست قانونی با ساخت حساب و پردازش داده‌ها موافق است.</span></label>
                            <div class="auth-submit-row"><button type="button" class="auth-back-button" onclick="Auth.goToRegisterStep(1)" aria-label="بازگشت"><span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span></button><button type="submit" class="auth-primary-button">ادامه <span class="material-symbols-outlined" aria-hidden="true">arrow_back</span></button></div>
                        </div>` : ''}
                        ${currentTab === 'login' && loginMethod === 'phone' ? `<div class="auth-field"><label class="form-label" for="auth-phone">شماره موبایل</label><div class="auth-input-wrap"><span class="material-symbols-outlined" aria-hidden="true">call</span><input type="tel" inputmode="tel" id="auth-phone" class="form-control" dir="ltr" placeholder="۰۹۱۲۱۲۳۴۵۶۷" autocomplete="tel" aria-describedby="phone-login-note" required></div><p id="phone-login-note" class="auth-phone-note"><span class="material-symbols-outlined" aria-hidden="true">info</span> ورود پیامکی در مرحله‌ی بعد فعال می‌شود؛ هنوز کدی ارسال نمی‌شود.</p><button type="submit" id="btn-phone-auth" class="auth-primary-button">ادامه با شماره موبایل <span class="material-symbols-outlined" aria-hidden="true">arrow_back</span></button></div>` : ''}
                        ${(currentTab === 'login' && loginMethod === 'username') || (currentTab === 'register' && registerStep === 3) ? `
                            <div class="auth-field"><label class="form-label" for="auth-username">نام کاربری</label><div class="auth-input-wrap"><span class="material-symbols-outlined" aria-hidden="true">person</span><input type="text" id="auth-username" class="form-control" placeholder="نام کاربری‌ات را وارد کن" required autocomplete="username" autocapitalize="none"></div></div>
                            <div class="auth-field"><label class="form-label" for="auth-password">رمز عبور${currentTab === 'register' ? '؛ حداقل ۸ نویسه' : ''}</label><div class="auth-input-wrap"><span class="material-symbols-outlined" aria-hidden="true">lock</span><input type="password" id="auth-password" class="form-control" placeholder="رمز عبور" required minlength="${currentTab === 'register' ? '8' : '1'}" autocomplete="${currentTab === 'login' ? 'current-password' : 'new-password'}"><button type="button" onclick="Auth.togglePassword()" aria-label="نمایش یا پنهان کردن رمز عبور"><span class="material-symbols-outlined" id="auth-password-icon" aria-hidden="true">visibility</span></button></div></div>
                            ${currentTab === 'login' ? '<button class="auth-forgot" type="button" onclick="Utils.showToast(\'برای بازیابی رمز با پشتیبانی روند تماس بگیرید.\', \'info\')">رمز عبور را فراموش کرده‌ای؟</button>' : ''}
                            <div class="auth-submit-row">${currentTab === 'register' ? '<button type="button" class="auth-back-button" onclick="Auth.goToRegisterStep(2)" aria-label="بازگشت"><span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span></button>' : ''}<button type="submit" id="btn-auth-submit" class="auth-primary-button"><span class="material-symbols-outlined" aria-hidden="true">${currentTab === 'login' ? 'login' : 'person_add'}</span>${currentTab === 'login' ? 'ورود به روند' : 'ایجاد حساب'}</button></div>
                        ` : ''}
                    </form>
                    <p class="auth-legal-note">با ادامه، استفاده از روند تابع <a href="privacy.html" target="_blank" rel="noopener">قوانین و حریم خصوصی</a> است.</p>
                </section>
            </main>`;
    }

    function switchTab(tab) {
        currentTab = tab;
        if (tab === 'login') loginMethod = 'username';
        registerStep = 1;
        renderAuthUI();
    }

    function switchLoginMethod(method) {
        loginMethod = method === 'phone' ? 'phone' : 'username';
        renderAuthUI();
        if (loginMethod === 'phone') document.getElementById('auth-phone')?.focus({ preventScroll: true });
    }

    function handlePhoneContinue() {
        const input = document.getElementById('auth-phone');
        const phone = String(input?.value || '')
            .replace(/[۰-۹]/g, digit => String.fromCharCode(digit.charCodeAt(0) - 0x06f0))
            .replace(/[٠-٩]/g, digit => String.fromCharCode(digit.charCodeAt(0) - 0x0660))
            .replace(/[\s()-]/g, '').replace(/^\+98/, '0');
        if (!/^09\d{9}$/.test(phone)) {
            input?.setCustomValidity('شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد.');
            input?.reportValidity();
            input?.addEventListener('input', () => input.setCustomValidity(''), { once: true });
            return;
        }
        if (typeof Utils !== 'undefined') Utils.showToast('ورود پیامکی هنوز فعال نشده است؛ بعد از اتصال سرویس پیامک در دسترس قرار می‌گیرد.', 'info');
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
        switchLoginMethod,
        handlePhoneContinue,
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
