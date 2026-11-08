/* Weekly study story: real study data -> 1080x1920 preview -> download/native share. */
(function () {
    'use strict';
    const W = 1080, H = 1920;
    const pd = v => window.Utils?.toPersianDigits ? Utils.toPersianDigits(v) : String(v);
    const num = (n, d = 1) => pd(Number(n).toFixed(d)).replace(/[./]/g, '٫');
    const DAY_S = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
    const PALETTES = {
        violet: { name: 'بنفش', a: '#6d4bc3', b: '#2a1670', c: '#0d0826', glow: '#b5a3ff', accent: '#ffe39a', ink: '#ffffff' },
        night: { name: 'شب', a: '#2a3550', b: '#141a2e', c: '#080b16', glow: '#6b9bff', accent: '#8ee3c8', ink: '#f4f7ff' },
        mint: { name: 'فیروزه', a: '#1f9a7c', b: '#0d5a56', c: '#06262f', glow: '#8ee3c8', accent: '#ffd98a', ink: '#ffffff' }
    };
    let overlay, canvas, palette = 'violet', data, lastFocus;
    const hooks = {};
    const isoOf = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const dayAt = offset => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + offset); return d; };

    function historyFromStorage() {
        const by = new Map();
        (Storage.get('study_history', []) || []).forEach(r => r?.date && by.set(r.date, (by.get(r.date) || 0) + (Number(r.hours) || 0)));
        (Storage.get('manual_reports', []) || []).filter(r => r?.date && r.status !== 'missed').forEach(r => by.set(r.date, (by.get(r.date) || 0) + (Number(r.minutes) || 0) / 60));
        const history = [...by].map(([date, hours]) => ({ date, hours })).sort((a, b) => a.date.localeCompare(b.date));
        let streak = 0, offset = by.get(isoOf(dayAt(0))) > 0 ? 0 : -1;
        while (by.get(isoOf(dayAt(offset))) > 0) { streak++; offset--; }
        return { history, streak };
    }
    function scheduleTasks() {
        let days;
        try { days = window.Schedule?.getState?.().days; } catch (_) { /* use stored schedule */ }
        days = days || Storage.get('schedule', []) || [];
        return days.flatMap(day => day?.tasks || []);
    }
    function gather() {
        const user = Storage.getCurrentUser?.() || {};
        let src;
        try { src = window.Stats?.getData?.(); } catch (_) { /* use stored history */ }
        src = src?.history ? src : historyFromStorage();
        const by = new Map(src.history.map(row => [row.date, Number(row.hours) || 0]));
        const days = Array.from({ length: 7 }, (_, i) => { const d = dayAt(i - 6); return { d, h: by.get(isoOf(d)) || 0 }; });
        const prev = Array.from({ length: 7 }, (_, i) => by.get(isoOf(dayAt(i - 13))) || 0).reduce((a, b) => a + b, 0);
        const total = days.reduce((a, row) => a + row.h, 0), tasks = scheduleTasks();
        return { name: user.name || user.username || 'دانش‌آموز', days, total, prev, avg: total / 7, streak: src.streak || 0, plan: tasks.length ? Math.round(tasks.filter(t => t.status === 'completed').length / tasks.length * 100) : null, best: days.reduce((best, row) => row.h > best.h ? row : best, days[0]) };
    }
    function roundedRect(ctx, x, y, w, h, radius) {
        ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.arcTo(x + w, y, x + w, y + h, radius); ctx.arcTo(x + w, y + h, x, y + h, radius); ctx.arcTo(x, y + h, x, y, radius); ctx.arcTo(x, y, x + w, y, radius); ctx.closePath();
    }
    function draw() {
        const P = PALETTES[palette], c = canvas.getContext('2d'), font = getComputedStyle(document.body).fontFamily || 'sans-serif';
        const text = (s, x, y, size, weight, color, align = 'center') => { c.font = `${weight} ${size}px ${font}`; c.fillStyle = color; c.textAlign = align; c.direction = 'rtl'; c.fillText(String(s), x, y); };
        c.clearRect(0, 0, W, H);
        let g = c.createLinearGradient(0, 0, W * .6, H); g.addColorStop(0, P.a); g.addColorStop(.5, P.b); g.addColorStop(1, P.c); c.fillStyle = g; c.fillRect(0, 0, W, H);
        let glow = c.createRadialGradient(W * .85, 260, 0, W * .85, 260, 640); glow.addColorStop(0, P.glow + '66'); glow.addColorStop(1, P.glow + '00'); c.fillStyle = glow; c.fillRect(0, 0, W, H);
        glow = c.createRadialGradient(W * .1, H * .82, 0, W * .1, H * .82, 700); glow.addColorStop(0, P.glow + '33'); glow.addColorStop(1, P.glow + '00'); c.fillStyle = glow; c.fillRect(0, 0, W, H);
        c.strokeStyle = '#ffffff10'; c.lineWidth = 2; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(W * .5, H * .38, 280 + i * 120, 0, Math.PI * 2); c.stroke(); }
        roundedRect(c, 80, 96, 180, 64, 32); c.fillStyle = '#ffffff1f'; c.fill(); text('درسیار', 170, 142, 34, 800, P.ink);
        const f = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric', month: 'long' });
        text(`${f.format(data.days[0].d)} تا ${f.format(data.days[6].d)}`, W - 80, 142, 32, 600, P.ink + 'cc', 'right');
        text('هفته‌ی مطالعه‌ی من', W / 2, 330, 58, 800, P.ink); text(data.name, W / 2, 410, 40, 600, P.ink + 'bb');
        glow = c.createRadialGradient(W / 2, 700, 0, W / 2, 700, 420); glow.addColorStop(0, P.accent + '33'); glow.addColorStop(1, P.accent + '00'); c.fillStyle = glow; c.fillRect(0, 380, W, 640);
        text(num(data.total), W / 2, 760, 260, 800, P.ink); text('ساعت مطالعه در ۷ روز', W / 2, 850, 48, 700, P.accent);
        if (data.prev > 0) { const change = Math.round((data.total - data.prev) / data.prev * 100), up = change >= 0, label = `${pd(Math.abs(change))}٪ ${up ? 'بیشتر' : 'کمتر'} از هفته‌ی قبل`; c.font = `700 36px ${font}`; const w = c.measureText(label).width + 110; roundedRect(c, (W - w) / 2, 900, w, 76, 38); c.fillStyle = up ? '#2fd39a33' : '#ff7a8a33'; c.fill(); text((up ? '▲ ' : '▼ ') + label, W / 2, 951, 36, 700, up ? '#7bf0c4' : '#ffa3ae'); }
        const bx = 100, bw = W - 200, bh = 300, by = 1072, max = Math.max(.5, ...data.days.map(row => row.h)), gap = 22, col = (bw - gap * 6) / 7;
        roundedRect(c, 70, by - 84, W - 140, bh + 194, 44); c.fillStyle = '#ffffff12'; c.fill();
        data.days.forEach((row, i) => { const x = bx + (6 - i) * (col + gap), h = Math.max(row.h ? 18 : 8, row.h / max * bh), y = by + bh - h, best = row === data.best && row.h > 0; roundedRect(c, x, y, col, h, Math.min(24, h / 2)); c.fillStyle = best ? P.accent : row.h ? '#ffffffcc' : '#ffffff2e'; c.fill(); if (row.h > 0) text(num(row.h), x + col / 2, y - 18, 28, 700, best ? P.accent : P.ink + 'dd'); text(DAY_S[(row.d.getDay() + 1) % 7], x + col / 2, by + bh + 64, 34, 700, P.ink + 'aa'); });
        const tiles = [[pd(data.streak), 'روز پیاپی', '🔥'], [num(data.avg), 'ساعت در روز', '⏱️'], [data.plan == null ? '—' : pd(data.plan) + '٪', 'پایبندی به برنامه', '✅']], tw = (W - 160 - 56) / 3;
        tiles.forEach(([value, label, emoji], i) => { const x = 80 + (2 - i) * (tw + 28), y = 1530; roundedRect(c, x, y, tw, 230, 40); c.fillStyle = '#ffffff1a'; c.fill(); text(emoji, x + tw / 2, y + 66, 44, 600, P.ink); text(value, x + tw / 2, y + 140, 62, 800, P.ink); text(label, x + tw / 2, y + 194, 28, 600, P.ink + 'aa'); });
        text('قدم به قدم، با درسیار', W / 2, 1852, 34, 700, P.ink + '99');
    }
    function build() {
        overlay = document.createElement('div'); overlay.className = 'shx'; overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', 'کارت اشتراک هفتگی');
        overlay.innerHTML = `<div class="shx-sheet"><header><h2>کارت هفته‌ی من</h2><button type="button" class="shx-x" data-a="close" aria-label="بستن"><span class="material-symbols-outlined" aria-hidden="true">close</span></button></header><div class="shx-stage"><canvas width="${W}" height="${H}" aria-label="پیش‌نمایش کارت اشتراک"></canvas></div><div class="shx-palettes" role="radiogroup" aria-label="رنگ کارت">${Object.entries(PALETTES).map(([key, value]) => `<button type="button" role="radio" data-p="${key}" aria-checked="${key === palette}" style="--a:${value.a};--b:${value.c}"><i></i>${value.name}</button>`).join('')}</div><div class="shx-actions"><button type="button" class="shx-primary" data-a="share"><span class="material-symbols-outlined" aria-hidden="true">ios_share</span>اشتراک‌گذاری</button><button type="button" class="shx-ghost" data-a="save"><span class="material-symbols-outlined" aria-hidden="true">download</span>ذخیره تصویر</button></div><p class="shx-note" id="shx-note"></p></div>`;
        document.body.append(overlay); canvas = overlay.querySelector('canvas');
        overlay.addEventListener('click', event => { if (event.target === overlay) return close(); const button = event.target.closest('[data-a],[data-p]'); if (!button) return; if (button.dataset.p) { palette = button.dataset.p; overlay.querySelectorAll('[data-p]').forEach(item => item.setAttribute('aria-checked', String(item === button))); return draw(); } if (button.dataset.a === 'close') return close(); if (button.dataset.a === 'save') return save(); if (button.dataset.a === 'share') return share(); });
        overlay.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
    }
    const toBlob = () => new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const note = message => { const el = overlay.querySelector('#shx-note'); el.textContent = message; clearTimeout(note.timer); note.timer = setTimeout(() => { el.textContent = ''; }, 3200); };
    const fileName = () => `darsyar-week-${new Date().toISOString().slice(0, 10)}.png`;
    async function save() { const image = await toBlob(); if (!image) return note('ساخت تصویر ممکن نشد.'); if (hooks.save) { await hooks.save(image, fileName()); return note('تصویر ذخیره شد.'); } const link = document.createElement('a'); link.href = URL.createObjectURL(image); link.download = fileName(); document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(link.href), 4000); note('تصویر ذخیره شد.'); }
    async function share() { const image = await toBlob(); if (!image) return note('ساخت تصویر ممکن نشد.'); const file = new File([image], 'darsyar-week.png', { type: 'image/png' }); if (hooks.share) { try { await hooks.share(image, file); return; } catch (error) { if (error?.name === 'AbortError') return; } } else if (navigator.canShare?.({ files: [file] }) && navigator.share) { try { await navigator.share({ files: [file], title: 'هفته‌ی مطالعه‌ی من', text: 'هفته‌ی مطالعه‌ی من در درسیار' }); return; } catch (error) { if (error?.name === 'AbortError') return; } } await save(); note('اشتراک مستقیم ممکن نیست؛ تصویر ذخیره شد.'); }
    function close() { overlay?.classList.remove('on'); document.documentElement.classList.remove('shx-lock'); setTimeout(() => lastFocus?.focus?.(), 0); }
    async function open() { lastFocus = document.activeElement; if (!overlay) build(); data = gather(); try { await document.fonts?.ready; await document.fonts?.load?.(`800 40px ${getComputedStyle(document.body).fontFamily}`); } catch (_) { /* use fallback font */ } draw(); overlay.classList.add('on'); document.documentElement.classList.add('shx-lock'); overlay.querySelector('.shx-primary').focus({ preventScroll: true }); }
    window.ShareCard = { open, close, configure: options => Object.assign(hooks, options || {}) };
})();
