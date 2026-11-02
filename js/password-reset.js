(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const username = String(params.get('username') || '').trim().toLowerCase();
    const token = String(params.get('token') || '').toLowerCase();
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    const form = document.getElementById('reset-form');
    const status = document.getElementById('reset-message');
    const button = document.getElementById('reset-submit');
    const show = (message, kind = '') => { status.textContent = message; status.dataset.kind = kind; };
    if (!/^[a-z0-9_.-]{3,32}$/.test(username) || !/^[a-f0-9]{64}$/.test(token)) {
        show('لینک بازیابی معتبر نیست. برای دریافت لینک تازه با پشتیبانی درسیار تماس بگیر.', 'error');
        return;
    }
    document.getElementById('reset-username').textContent = `@${username}`;
    form.hidden = false;
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const password = document.getElementById('reset-password').value;
        const confirmation = document.getElementById('reset-confirmation').value;
        if (password !== confirmation) return show('تکرار رمز عبور یکسان نیست.', 'error');
        button.disabled = true; button.textContent = 'در حال ذخیره…'; show('');
        try {
            const response = await fetch('/api/password-reset', {
                method: 'POST', credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'consume', username, token, password, confirmation })
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || 'عملیات انجام نشد؛ دوباره تلاش کن.');
            form.hidden = true;
            show('رمز عبور تازه ذخیره شد. نشست‌های قبلی بسته شدند؛ حالا با رمز تازه وارد شو.', 'success');
        } catch (error) { show(error.message, 'error'); }
        finally { button.disabled = false; button.textContent = 'ذخیره رمز تازه'; }
    });
})();
