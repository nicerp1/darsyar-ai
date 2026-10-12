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
    function init() {
        const user = Storage.getCurrentUser(); if (!user) return;
        generation++; busy = false; selected = user.avatar || 'avatar:1';
        const gradeOptions = ['دوازدهم تجربی','دوازدهم ریاضی','دوازدهم انسانی','یازدهم','دهم','متوسطه اول','دانشجو','سایر'];
        if (user.grade && !gradeOptions.includes(user.grade)) gradeOptions.unshift(user.grade);
        document.getElementById('view-profile').innerHTML = `<div class="ps-workspace"><header class="ps-heading" data-reveal><span>فضای شخصی شما</span><h1>به سلیقهٔ خودت.</h1><p>هویت، ظاهر و امنیت حسابت؛ همه در یک جای آرام.</p></header><form id="ps-form" class="ps-layout"><aside class="ps-card ps-identity" data-reveal><div class="ps-cover" aria-hidden="true"></div><div id="ps-preview" class="ps-portrait">${avatarHTML(selected)}</div><h2>${esc(user.name || user.username)}</h2><span class="ps-handle" dir="ltr">@${esc(user.username)}</span><p>${user.accountType === 'advisor' ? 'مشاور تحصیلی' : user.accountType === 'admin' ? 'مدیر' : 'دانش‌آموز'}</p><label class="ps-upload" for="ps-upload">${WebStudio.icon('plus')} آپلود تصویر خودت</label><input id="ps-upload" type="file" accept="image/jpeg,image/png,image/webp" class="ps-file"><small>JPG، PNG یا WebP، حداکثر ۵ مگابایت<br>تصویر به‌صورت مربعی برش می‌خورد.</small><h3>یا یکی از این چهره‌ها</h3><div id="ps-avatars" class="ps-avatar-grid"></div><button type="button" id="ps-remove" class="ps-text-button">بازگشت به تصویر پیش‌فرض</button></aside><div class="ps-sections"><section class="ps-card" data-reveal><div class="ps-section-title">${WebStudio.icon('user')}<div><h2>اطلاعات شخصی</h2><p>نامی که درسیار با آن صدایت می‌کند.</p></div></div><div class="ps-fields"><label>نام و نام خانوادگی<input id="ps-name" required maxlength="80" autocomplete="name" value="${esc(user.name)}"></label><label>نام کاربری<input disabled dir="ltr" value="${esc(user.username)}"><small>نام کاربری قابل تغییر نیست.</small></label><label class="ps-wide">رشته و مقطع<select id="ps-grade">${gradeOptions.map(g => `<option ${g === user.grade ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></label></div></section><section class="ps-card" data-reveal><div class="ps-section-title">${WebStudio.icon('spark')}<div><h2>حرکت، به انتخاب تو</h2><p>انیمیشن جابه‌جایی صفحات را روشن یا خاموش کن.</p></div></div><div class="ps-motion"><label><input type="radio" name="ps-motion" value="auto" ${Storage.getSettings().motion !== 'off' ? 'checked' : ''}><span><strong>روان و زنده</strong><small>با رعایت تنظیم کاهش حرکت دستگاه</small></span></label><label><input type="radio" name="ps-motion" value="off" ${Storage.getSettings().motion === 'off' ? 'checked' : ''}><span><strong>بدون حرکت</strong><small>نمایش فوری و آرام صفحات</small></span></label></div></section><section class="ps-card" data-reveal><div class="ps-section-title">${WebStudio.icon('shield')}<div><h2>امنیت حساب</h2><p>برای نگه‌داشتن رمز فعلی، این دو فیلد را خالی بگذار.</p></div></div><div class="ps-fields"><label>رمز فعلی<input id="ps-current" type="password" autocomplete="current-password"></label><label>رمز جدید<input id="ps-password" type="password" minlength="8" autocomplete="new-password"><small>حداقل ۸ نویسه</small></label></div></section><div class="ps-save-bar"><p id="ps-status" role="status" aria-live="polite">تغییرات پس از ذخیره در حساب شما ثبت می‌شوند.</p><button id="ps-save" type="submit">${WebStudio.icon('check')} ذخیره تغییرات</button></div><section class="ps-danger"><div><h3>حذف حساب</h3><p>حذف حساب و اطلاعات، قابل بازگشت نیست.</p></div><button type="button" id="ps-delete">حذف حساب من</button></section></div></form></div>`;
        renderOptions();
        document.getElementById('ps-form').onsubmit = save;
        document.getElementById('ps-upload').onchange = upload;
        document.getElementById('ps-remove').onclick = () => choose('avatar:1');
        document.getElementById('ps-delete').onclick = () => Profile.openDeleteAccount();
    }
    function choose(value) { selected = value; document.getElementById('ps-preview').innerHTML = avatarHTML(value); renderOptions(); }
    function renderOptions() {
        const box = document.getElementById('ps-avatars');
        box.innerHTML = names.map((name, i) => `<button type="button" data-avatar="avatar:${i+1}" aria-label="${name}" aria-pressed="${selected === `avatar:${i+1}`}">${avatarHTML(`avatar:${i+1}`)}</button>`).join('');
        box.querySelectorAll('button').forEach(button => button.onclick = () => choose(button.dataset.avatar));
    }
    async function upload(event) {
        const file = event.target.files?.[0]; if (!file) return;
        const token = generation, username = Storage.getCurrentUser()?.username;
        const status = document.getElementById('ps-status');
        if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { status.textContent = 'یک تصویر JPG، PNG یا WebP با حجم کمتر از ۵ مگابایت انتخاب کن.'; event.target.value = ''; return; }
        const url = URL.createObjectURL(file);
        try {
            const image = new Image(); image.src = url; await image.decode();
            if (token !== generation || Storage.getCurrentUser()?.username !== username) return;
            const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
            const ctx = canvas.getContext('2d'); ctx.fillStyle = '#eeeaf5'; ctx.fillRect(0,0,256,256);
            const side = Math.min(image.naturalWidth,image.naturalHeight);
            ctx.drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,0,0,256,256);
            const result = canvas.toDataURL('image/jpeg', .85);
            if (result.length > 200000) throw new Error();
            choose(result); status.textContent = 'تصویر آماده است؛ برای ثبت نهایی، ذخیره تغییرات را بزن.';
        } catch { if (token === generation) status.textContent = 'این تصویر قابل خواندن نیست؛ یک فایل دیگر انتخاب کن.'; }
        finally { URL.revokeObjectURL(url); event.target.value = ''; }
    }
    async function save(event) {
        event.preventDefault(); if (busy) return;
        const form = event.currentTarget; if (!form.reportValidity()) return;
        const user = Storage.getCurrentUser(); if (!user) return;
        const status = document.getElementById('ps-status'), button = document.getElementById('ps-save');
        const name = document.getElementById('ps-name').value.trim();
        const newPassword = document.getElementById('ps-password').value;
        const currentPassword = document.getElementById('ps-current').value;
        if (!name) { status.textContent = 'نام خود را وارد کن.'; return; }
        if (newPassword && !currentPassword) { status.textContent = 'برای تغییر رمز، رمز فعلی را وارد کن.'; return; }
        busy = true; button.disabled = true; status.textContent = 'در حال ذخیره…';
        try {
            await Storage.saveProfile({ username: user.username, name, grade: document.getElementById('ps-grade').value, avatar: selected, ...(newPassword ? {newPassword,currentPassword} : {}) }, {motion: form.querySelector('[name="ps-motion"]:checked').value});
            if (Storage.getCurrentUser()?.username !== user.username) return;
            form.querySelector('#ps-password').value = ''; form.querySelector('#ps-current').value = '';
            applyMotion(); App.renderUserHeader(); status.textContent = 'تغییرات در حساب شما ذخیره شد.';
            document.querySelector('.ps-identity h2').textContent = name;
        } catch(error) { status.textContent = error.message || 'ذخیره انجام نشد؛ اتصال اینترنت را بررسی کن.'; }
        finally { busy = false; button.disabled = false; }
    }
    return {init, avatarHTML, applyMotion};
})();
window.ProfileStudio = ProfileStudio;
