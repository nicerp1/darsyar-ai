/** Web profile editor. Images and preferences live in the authenticated database. */
const ProfileStudio = (() => {
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const colors = ['#c8baff','#b8e5d0','#ffc7b0','#b5d9fa','#f4d788','#ddbce8'];
    const names = ['خیال‌پرداز','کاوشگر','آفتاب','آرام','پرانرژی','خلاق'];
    let selected = 'avatar:1', busy = false, generation = 0;
    function avatarHTML(value) {
        const match = /^avatar:([1-6])$/.exec(String(value));
        if (match) {
            const n = Number(match[1]) - 1;
            const hair = ['M26 48Q16 9 49 16Q86 8 76 48L66 30Q43 42 32 29Z','M26 43Q17 16 46 14Q77 10 77 44L62 28L30 39Z','M24 67V36Q23 11 49 12Q78 12 78 38V68L65 65V36H36V65Z','M24 45L26 26L36 28L42 14L53 24L70 19L77 45L61 32L29 42Z','M24 65V38Q24 13 51 15Q81 17 77 43L68 31L32 36V65Z','M24 43Q14 25 30 21Q31 6 47 14Q65 3 70 22Q89 26 75 44L64 33L32 36Z'][n];
            return `<svg viewBox="0 0 100 100" role="img" aria-label="آواتار ${names[n]}" class="ps-avatar-art"><rect width="100" height="100" rx="26" fill="${colors[n]}"/><circle cx="83" cy="19" r="7" fill="#fff" opacity=".5"/><path d="M12 100Q12 70 49 71Q87 70 88 100" fill="#34384f"/><path d="M43 65h15v18Q51 91 43 82" fill="#d99572"/><ellipse cx="51" cy="47" rx="24" ry="29" fill="#efb28c"/><path d="${hair}" fill="#343042"/><path d="M40 48v3m21-3v3" stroke="#343042" stroke-width="3" stroke-linecap="round"/><path d="M46 61q6 5 12-1" fill="none" stroke="#9c523f" stroke-width="2" stroke-linecap="round"/>${n % 2 ? '<g fill="none" stroke="#343042" stroke-width="2"><rect x="32" y="43" width="15" height="12" rx="4"/><rect x="55" y="43" width="15" height="12" rx="4"/><path d="M47 47h8"/></g>' : ''}<path d="m30 84 10 16m32-16-10 16" stroke="${colors[n]}" stroke-width="3"/></svg>`;
        }
        if (typeof value === 'string' && value.length <= 200000 && /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(value)) return `<img class="ps-avatar-art" src="${value}" alt="تصویر پروفایل" width="100" height="100">`;
        return `<span class="ps-legacy-avatar">${esc(String(value || '👩‍🎓').slice(0, 16))}</span>`;
    }
    function applyMotion() {
        if (document.documentElement.classList.contains('capacitor-app')) return;
        document.documentElement.dataset.motion = Storage.getSettings().motion === 'off' ? 'off' : 'auto';
    }
    const icon = name => WebStudio.icon(name);
    const gradeBase = ['دوازدهم تجربی','دوازدهم ریاضی','دوازدهم انسانی','یازدهم','دهم','متوسطه اول','دانشجو','سایر'];
    const roleLabel = user => user.accountType === 'advisor' ? 'مشاور تحصیلی' : user.accountType === 'admin' ? 'مدیر' : 'دانش‌آموز';
    const native = () => document.documentElement.classList.contains('capacitor-app');
    const pd = value => Utils.toPersianDigits(value);
    let root = null, sheet = null, pending = 'avatar:1';

    function init() {
        const user = Storage.getCurrentUser(); if (!user) return;
        generation++; busy = false;
        root = document.getElementById('view-profile'); root.classList.add('pf-page');
        render(user);
    }

    function render(user) {
        const stats = [['flame', user.streak, 'روز پیوسته'], ['trophy', user.level, 'سطح'], ['spark', user.xp, 'امتیاز']].filter(item => Number.isFinite(Number(item[1])) && item[1] !== null && item[1] !== undefined);
        const motionOn = Storage.getSettings().motion !== 'off';
        root.innerHTML = `<div class="pf">
            <h1 class="pf-sr">پروفایل من</h1>
            <section class="pf-hero" aria-label="هویت">
                <button type="button" class="pf-avatar" data-open="avatar" aria-label="تغییر تصویر پروفایل"><span class="pf-avatar-img">${avatarHTML(user.avatar)}</span><span class="pf-avatar-edit" aria-hidden="true">${icon('plus')}</span></button>
                <div class="pf-who"><h2>${esc(user.name || user.username)}</h2><span class="pf-handle" dir="ltr">@${esc(user.username)}</span>
                <div class="pf-tags"><b>${roleLabel(user)}</b>${user.grade ? `<b>${esc(user.grade)}</b>` : ''}</div></div>
            </section>
            ${stats.length ? `<section class="pf-stats" aria-label="پیشرفت">${stats.map(([glyph, value, label]) => `<div>${icon(glyph)}<strong>${pd(value)}</strong><span>${label}</span></div>`).join('')}</section>` : ''}
            <section class="pf-group"><h3>حساب کاربری</h3>
                <button type="button" class="pf-row" data-open="info"><span class="pf-ico">${icon('user')}</span><span class="pf-text"><strong>اطلاعات شخصی</strong><small>${esc(user.name || '—')}${user.grade ? ' · ' + esc(user.grade) : ''}</small></span><i class="pf-chev" aria-hidden="true"></i></button>
                <button type="button" class="pf-row" data-open="password"><span class="pf-ico">${icon('shield')}</span><span class="pf-text"><strong>رمز عبور</strong><small>تغییر رمز ورود به حساب</small></span><i class="pf-chev" aria-hidden="true"></i></button>
            </section>
            ${native() ? '' : `<section class="pf-group"><h3>نمایش</h3>
                <div class="pf-row"><span class="pf-ico">${icon('spark')}</span><span class="pf-text"><strong>انیمیشن صفحه‌ها</strong><small>با رعایت تنظیم کاهش حرکت دستگاه</small></span><button type="button" class="pf-switch" role="switch" aria-checked="${motionOn}" aria-label="انیمیشن صفحه‌ها"><i></i></button></div>
            </section>`}
            <section class="pf-group">
                <button type="button" class="pf-row" data-act="logout"><span class="pf-ico">${icon('arrow')}</span><span class="pf-text"><strong>خروج از حساب</strong></span></button>
                <button type="button" class="pf-row pf-danger" data-act="delete"><span class="pf-ico">${icon('close')}</span><span class="pf-text"><strong>حذف حساب</strong><small>حذف حساب و اطلاعات قابل بازگشت نیست.</small></span></button>
            </section>
            <dialog id="pf-sheet" class="pf-sheet" aria-labelledby="pf-sheet-title"></dialog>
        </div>`;
        sheet = root.querySelector('#pf-sheet');
        sheet.addEventListener('click', event => { if (event.target === sheet) sheet.close(); });
        root.querySelector('.pf').addEventListener('click', onClick);
        root.querySelector('.pf-switch')?.addEventListener('click', toggleMotion);
    }

    function onClick(event) {
        const open = event.target.closest('[data-open]'), act = event.target.closest('[data-act]');
        if (open) openSheet(open.dataset.open);
        else if (act?.dataset.act === 'logout') Auth.logout();
        else if (act?.dataset.act === 'delete') Profile.openDeleteAccount();
    }

    function frame(title, body, submitLabel) {
        sheet.innerHTML = `<form class="pf-form" novalidate><header><h2 id="pf-sheet-title">${title}</h2><button type="button" class="pf-close" aria-label="بستن">${icon('close')}</button></header><div class="pf-body">${body}</div><p class="pf-msg" role="alert" aria-live="polite"></p><footer><button type="button" class="pf-cancel">انصراف</button><button type="submit" class="pf-save">${submitLabel}</button></footer></form>`;
        sheet.querySelector('.pf-close').onclick = sheet.querySelector('.pf-cancel').onclick = () => sheet.close();
        if (!sheet.open) sheet.showModal();
        return sheet.querySelector('form');
    }
    const message = (text) => { const box = sheet.querySelector('.pf-msg'); if (box) box.textContent = text || ''; };

    function openSheet(kind) {
        const user = Storage.getCurrentUser(); if (!user) return;
        if (kind === 'avatar') return avatarSheet(user);
        if (kind === 'info') return infoSheet(user);
        if (kind === 'password') return passwordSheet();
    }

    function infoSheet(user) {
        const grades = [...gradeBase]; if (user.grade && !grades.includes(user.grade)) grades.unshift(user.grade);
        const form = frame('اطلاعات شخصی', `<label>نام و نام خانوادگی<input name="name" required maxlength="80" autocomplete="name" value="${esc(user.name)}"></label><label>نام کاربری<input disabled dir="ltr" value="${esc(user.username)}"><small>نام کاربری قابل تغییر نیست.</small></label><label>رشته و مقطع<select name="grade">${grades.map(g => `<option ${g === user.grade ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></label>`, 'ذخیره');
        form.onsubmit = event => { event.preventDefault(); const name = form.elements.name.value.trim(); if (!name) { message('نام خود را وارد کن.'); form.elements.name.focus(); return; } submit(form, { name, grade: form.elements.grade.value }); };
    }

    function passwordSheet() {
        const form = frame('تغییر رمز عبور', `<label>رمز فعلی<input name="current" type="password" autocomplete="current-password" required></label><label>رمز جدید<input name="next" type="password" autocomplete="new-password" minlength="8" required><small>حداقل ۸ نویسه</small></label><label class="pf-check"><input type="checkbox" name="show"> نمایش رمزها</label>`, 'تغییر رمز');
        form.elements.show.onchange = () => { form.elements.current.type = form.elements.next.type = form.elements.show.checked ? 'text' : 'password'; };
        form.onsubmit = event => {
            event.preventDefault();
            if (!form.elements.current.value) { message('برای تغییر رمز، رمز فعلی را وارد کن.'); form.elements.current.focus(); return; }
            if (form.elements.next.value.length < 8) { message('رمز جدید باید حداقل ۸ نویسه باشد.'); form.elements.next.focus(); return; }
            submit(form, { newPassword: form.elements.next.value, currentPassword: form.elements.current.value }, 'رمز عبور تغییر کرد.');
        };
    }

    function avatarSheet(user) {
        pending = user.avatar || 'avatar:1';
        const form = frame('تصویر پروفایل', `<div class="pf-preview" id="pf-preview">${avatarHTML(pending)}</div><label class="pf-upload" for="pf-file">${icon('plus')} آپلود تصویر خودت</label><input id="pf-file" type="file" accept="image/jpeg,image/png,image/webp" class="pf-file"><small class="pf-hint">JPG، PNG یا WebP تا ۵ مگابایت؛ تصویر مربعی برش می‌خورد.</small><h3>یا یک چهره آماده</h3><div class="pf-faces" id="pf-faces"></div><button type="button" class="pf-reset" id="pf-reset">بازگشت به تصویر پیش‌فرض</button>`, 'ذخیره تصویر');
        const paint = () => {
            form.querySelector('#pf-preview').innerHTML = avatarHTML(pending);
            form.querySelector('#pf-faces').innerHTML = names.map((name, i) => `<button type="button" data-face="avatar:${i + 1}" aria-label="${name}" aria-pressed="${pending === `avatar:${i + 1}`}">${avatarHTML(`avatar:${i + 1}`)}</button>`).join('');
        };
        paint();
        form.querySelector('#pf-faces').onclick = event => { const face = event.target.closest('[data-face]'); if (face) { pending = face.dataset.face; paint(); } };
        form.querySelector('#pf-reset').onclick = () => { pending = 'avatar:1'; paint(); };
        form.querySelector('#pf-file').onchange = async event => { const result = await readImage(event); if (result) { pending = result; paint(); message(''); } };
        form.onsubmit = event => { event.preventDefault(); submit(form, { avatar: pending }, 'تصویر پروفایل ذخیره شد.'); };
    }

    async function readImage(event) {
        const file = event.target.files?.[0]; if (!file) return null;
        const token = generation, username = Storage.getCurrentUser()?.username;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { message('یک تصویر JPG، PNG یا WebP با حجم کمتر از ۵ مگابایت انتخاب کن.'); event.target.value = ''; return null; }
        const url = URL.createObjectURL(file);
        try {
            const image = new Image(); image.src = url; await image.decode();
            if (token !== generation || Storage.getCurrentUser()?.username !== username) return null;
            const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
            const ctx = canvas.getContext('2d'); ctx.fillStyle = '#eeeaf5'; ctx.fillRect(0, 0, 256, 256);
            const side = Math.min(image.naturalWidth, image.naturalHeight);
            ctx.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 256, 256);
            const result = canvas.toDataURL('image/jpeg', .85);
            if (result.length > 200000) throw new Error();
            return result;
        } catch { message('این تصویر قابل خواندن نیست؛ یک فایل دیگر انتخاب کن.'); return null; }
        finally { URL.revokeObjectURL(url); event.target.value = ''; }
    }

    async function persist(changes, preferences) {
        const user = Storage.getCurrentUser();
        await Storage.saveProfile({ username: user.username, name: user.name, grade: user.grade || gradeBase[0], avatar: user.avatar || 'avatar:1', ...changes }, preferences);
        if (Storage.getCurrentUser()?.username !== user.username) return false;
        App.renderUserHeader();
        return true;
    }

    async function submit(form, changes, success = 'تغییرات ذخیره شد.') {
        if (busy) return;
        const button = form.querySelector('.pf-save'), label = button.textContent;
        busy = true; button.disabled = true; button.textContent = 'در حال ذخیره…'; message('');
        try {
            if (await persist(changes)) { sheet.close(); render(Storage.getCurrentUser()); Utils.showToast(success, 'success'); }
        } catch (error) { message(error.message || 'ذخیره انجام نشد؛ اتصال اینترنت را بررسی کن.'); }
        finally { busy = false; button.disabled = false; button.textContent = label; }
    }

    async function toggleMotion(event) {
        const toggle = event.currentTarget, next = toggle.getAttribute('aria-checked') !== 'true';
        toggle.setAttribute('aria-checked', String(next)); toggle.disabled = true;
        try { await persist({}, { motion: next ? 'auto' : 'off' }); applyMotion(); }
        catch (error) { toggle.setAttribute('aria-checked', String(!next)); Utils.showToast(error.message || 'ذخیره انجام نشد.', 'error'); }
        finally { toggle.disabled = false; }
    }

    return { init, avatarHTML, applyMotion };
})();
window.ProfileStudio = ProfileStudio;
