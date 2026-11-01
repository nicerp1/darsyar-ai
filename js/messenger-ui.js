/**
 * Messenger UI enhancer. Never writes inside message <article>s (messenger.js diffs their HTML); it only toggles
 * classes, adds sibling controls and forwards actions to the original buttons, so every existing feature keeps working.
 */
(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const ico = n => `<span class="material-symbols-outlined" aria-hidden="true">${n}</span>`;
    const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
    const EMOJI = ['👍', '❤️', '👏', '😊', '🎯', '🌱', '🔥', '💪', '🙏', '😂', '😍', '🤔', '😎', '📚', '✅', '⭐', '🎉', '😅', '😴', '🧠', '⏰', '📝', '💡', '🚀'];
    let shell, log, menu, scrim, swipeIcon, unseen = 0, lastIncoming = 0;

    /* ---------- grouping ---------- */
    function group() {
        const items = [...log.children].filter(n => n.classList.contains('im-message'));
        items.forEach((el, i) => {
            const link = (a, b) => a && b && a.nextElementSibling === b && a.classList.contains('mine') === b.classList.contains('mine');
            const first = !link(items[i - 1], el), last = !link(el, items[i + 1]);
            const cls = first && last ? 'g-solo' : first ? 'g-first' : last ? 'g-last' : 'g-mid';
            ['g-solo', 'g-first', 'g-mid', 'g-last'].forEach(c => el.classList.toggle(c, c === cls));
        });
    }

    /* ---------- scroll-to-bottom ---------- */
    function fab() {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'imx-fab'; b.setAttribute('aria-label', 'رفتن به آخرین پیام');
        b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg><b></b>`;
        shell.querySelector('.im-conversation').append(b);
        const badge = b.querySelector('b');
        const far = () => log.scrollHeight - log.scrollTop - log.clientHeight > 260;
        const update = () => { const on = far(); b.classList.toggle('on', on); if (!on) { unseen = 0; } badge.textContent = unseen ? (window.Utils?.toPersianDigits ? Utils.toPersianDigits(unseen) : unseen) : ''; badge.classList.toggle('on', !!unseen); };
        log.addEventListener('scroll', update, { passive: true });
        b.addEventListener('click', () => log.scrollTo({ top: log.scrollHeight, behavior: reduced() ? 'auto' : 'smooth' }));
        new MutationObserver(() => {
            const incoming = log.querySelectorAll('.im-message:not(.mine)').length;
            if (incoming > lastIncoming && far()) unseen += incoming - lastIncoming;
            lastIncoming = incoming; update();
        }).observe(log, { childList: true });
    }

    /* ---------- context menu (right-click, long-press, hover chevron) ---------- */
    function closeMenu() { menu?.remove(); scrim?.remove(); menu = scrim = null; }
    function openMenu(article, x, y) {
        closeMenu();
        const act = n => article.querySelector(`[data-action="${n}"]`);
        const text = article.querySelector(':scope > p')?.textContent || '';
        const items = [];
        if (act('reply')) items.push(['reply', 'پاسخ', () => act('reply').click()]);
        if (text) items.push(['content_copy', 'کپی متن', () => navigator.clipboard?.writeText(text)]);
        if (act('save')) items.push(['bookmark', 'ذخیره در پیام‌های من', () => act('save').click()]);
        if (act('report')) items.push(['flag', 'گزارش پیام', () => act('report').click(), true]);
        if (act('retry')) items.push(['refresh', 'تلاش دوباره', () => act('retry').click()]);
        if (!items.length) return;
        scrim = document.createElement('div'); scrim.className = 'imx-scrim'; scrim.addEventListener('pointerdown', closeMenu); scrim.addEventListener('contextmenu', e => { e.preventDefault(); closeMenu(); });
        menu = document.createElement('div'); menu.className = 'imx-menu'; menu.setAttribute('role', 'menu');
        menu.innerHTML = items.map(([i, l, , d], k) => `<button type="button" role="menuitem" data-k="${k}" class="${d ? 'danger' : ''}">${ico(i)}${l}</button>`).join('');
        menu.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const fn = items[+b.dataset.k][2]; closeMenu(); fn(); });
        document.body.append(scrim, menu);
        const r = menu.getBoundingClientRect();
        menu.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
        menu.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + 'px';
        menu.querySelector('button')?.focus({ preventScroll: true });
    }

    function gestures() {
        log.addEventListener('contextmenu', e => { const a = e.target.closest('.im-message'); if (!a || e.target.closest('a,audio')) return; e.preventDefault(); openMenu(a, e.clientX, e.clientY); });
        log.addEventListener('click', e => {
            const s = e.target.closest('.im-menu summary'); if (s) { e.preventDefault(); const a = s.closest('.im-message'), r = s.getBoundingClientRect(); openMenu(a, r.left, r.bottom + 4); return; }
            const q = e.target.closest('blockquote'); if (q) { const a = q.closest('.im-message'), prev = [...log.querySelectorAll('.im-message')]; const want = q.textContent.replace('در پاسخ به', '').trim().slice(0, 40); const hit = prev.find(m => m !== a && m.querySelector(':scope > p')?.textContent.trim().startsWith(want)); if (hit) { hit.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }); hit.classList.add('is-flash'); setTimeout(() => hit.classList.remove('is-flash'), 1300); } }
        });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeMenu(); $('im-emojis')?.setAttribute('hidden', ''); } });

        // touch: long-press opens the menu, horizontal drag toward the centre replies
        swipeIcon = document.createElement('div'); swipeIcon.className = 'imx-swipe'; swipeIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5-7 7 7 7M2 12h13a7 7 0 0 1 7 7"/></svg>'; document.body.append(swipeIcon);
        let a, sx, sy, dx, press, mode, mine;
        const reset = () => { clearTimeout(press); if (a) { a.style.transition = 'transform .25s cubic-bezier(.2,.9,.3,1)'; a.style.transform = ''; const el = a; setTimeout(() => { el.style.transition = ''; }, 260); } swipeIcon.style.opacity = 0; a = null; mode = null; };
        log.addEventListener('touchstart', e => {
            a = e.target.closest('.im-message'); if (!a || e.touches.length !== 1 || e.target.closest('a,audio,button,summary')) { a = null; return; }
            sx = e.touches[0].clientX; sy = e.touches[0].clientY; dx = 0; mode = null; mine = a.classList.contains('mine');
            press = setTimeout(() => { if (!mode) { mode = 'press'; navigator.vibrate?.(12); const r = a.getBoundingClientRect(); openMenu(a, Math.min(r.left + 12, innerWidth - 220), r.bottom + 6); } }, 480);
        }, { passive: true });
        log.addEventListener('touchmove', e => {
            if (!a) return; const t = e.touches[0], mx = t.clientX - sx, my = t.clientY - sy;
            if (!mode && Math.hypot(mx, my) > 9) { clearTimeout(press); mode = Math.abs(mx) > Math.abs(my) * 1.4 && (mine ? mx < 0 : mx > 0) && a.querySelector('[data-action="reply"]') ? 'swipe' : 'scroll'; }
            if (mode !== 'swipe') return;
            dx = Math.min(96, Math.abs(mx)) * (mine ? -1 : 1);
            const k = Math.min(1, Math.abs(dx) / 64); a.style.transform = `translateX(${dx}px)`;
            const r = a.getBoundingClientRect();
            swipeIcon.style.cssText = `left:${mine ? r.right + 10 : r.left - 44}px;top:${r.top + r.height / 2 - 17}px;opacity:${k};transform:scale(${.4 + .6 * k})`;
        }, { passive: true });
        log.addEventListener('touchend', () => { if (a && mode === 'swipe' && Math.abs(dx) >= 64) { navigator.vibrate?.(10); a.querySelector('[data-action="reply"]')?.click(); } reset(); });
        log.addEventListener('touchcancel', reset);
    }

    /* ---------- composer: attach menu, emoji set, mic/send morph ---------- */
    function composer() {
        const form = $('im-compose'), attach = $('im-attach');
        const mic = document.createElement('button'); mic.type = 'button'; mic.id = 'im-mic'; mic.setAttribute('aria-label', 'ضبط پیام صوتی'); mic.innerHTML = ico('mic');
        $('im-send').after(mic); mic.addEventListener('click', () => $('im-voice')?.click());
        // attach: popover with photo/file, voice and study report (originals stay hidden in #im-extra-actions)
        form.addEventListener('click', e => {
            if (!e.target.closest('#im-attach')) return;
            e.preventDefault(); e.stopImmediatePropagation();
            const r = attach.getBoundingClientRect();
            const rows = [['image', 'عکس یا فایل', () => $('im-file')?.click()]];
            if ($('im-voice') && !$('im-voice').disabled) rows.push(['mic', 'پیام صوتی', () => $('im-voice').click()]);
            if ($('im-study-report') && !$('im-study-report').hidden && !$('im-study-report').disabled) rows.push(['assignment', 'گزارش مطالعه', () => $('im-study-report').click()]);
            closeMenu(); scrim = document.createElement('div'); scrim.className = 'imx-scrim'; scrim.addEventListener('pointerdown', closeMenu);
            menu = document.createElement('div'); menu.className = 'imx-menu'; menu.style.transformOrigin = 'bottom right';
            menu.innerHTML = rows.map(([i, l], k) => `<button type="button" role="menuitem" data-k="${k}">${ico(i)}${l}</button>`).join('');
            menu.addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; const fn = rows[+b.dataset.k][2]; closeMenu(); fn(); });
            document.body.append(scrim, menu);
            const mr = menu.getBoundingClientRect();
            menu.style.left = Math.max(8, Math.min(r.right - mr.width, innerWidth - mr.width - 8)) + 'px'; menu.style.top = Math.max(8, r.top - mr.height - 10) + 'px';
        }, true);
        // wider emoji set (the original six keep their own handlers)
        const panel = $('im-emojis'), have = new Set([...panel.querySelectorAll('button')].map(b => b.dataset.emoji));
        EMOJI.filter(v => !have.has(v)).forEach(v => { const b = document.createElement('button'); b.type = 'button'; b.dataset.emoji = v; b.textContent = v; b.addEventListener('click', () => { const i = $('im-input'); i.value += v; i.dispatchEvent(new Event('input')); i.focus(); }); panel.append(b); });
        document.addEventListener('pointerdown', e => { if (!panel.hidden && !e.target.closest('#im-emojis, #im-emoji-toggle')) panel.hidden = true; });
        const conn = $('im-connection'); if (conn) new MutationObserver(() => { conn.dataset.ok = /دوباره/.test(conn.textContent) ? '0' : '1'; }).observe(conn, { childList: true, characterData: true, subtree: true });
    }

    /* ---------- thread list filters ---------- */
    function filters() {
        const bar = document.createElement('div'); bar.className = 'im-filters'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'فیلتر گفتگوها');
        bar.innerHTML = [['all', 'همه'], ['unread', 'خوانده‌نشده'], ['special', 'ذخیره و دستیار']].map(([v, l], i) => `<button type="button" data-f="${v}" aria-pressed="${i === 0}">${l}</button>`).join('');
        $('im-threads').before(bar);
        bar.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; bar.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); $('im-threads').dataset.filter = b.dataset.f; });
    }

    function setup() {
        shell = $('im-shell'); if (!shell) return false;
        if (shell.dataset.imx) return true;
        shell.dataset.imx = '1'; log = $('im-log');
        filters(); fab(); composer(); gestures();
        let raf = 0; new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; group(); }); }).observe(log, { childList: true });
        group();
        return true;
    }
    let pending = 0;
    const watch = new MutationObserver(() => { if (!pending) pending = requestAnimationFrame(() => { pending = 0; setup(); }); });
    watch.observe(document.body, { childList: true, subtree: true });
    setup();
})();
