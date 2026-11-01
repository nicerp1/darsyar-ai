/**
 * Focus (Pomodoro) page UI — phone + desktop. Presentation layer: the original timer markup stays in the DOM (hidden)
 * and keeps running Pomodoro.*; this file mirrors its state (time, ring, mode, task, stats) and forwards every action to it.
 */
(function () {
    'use strict';
    const pd = v => (window.Utils?.toPersianDigits ? Utils.toPersianDigits(v) : String(v));
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const ico = n => `<span class="material-symbols-outlined" aria-hidden="true">${n}</span>`;
    const MODES = [['work', 'تمرکز'], ['shortBreak', 'استراحت کوتاه'], ['longBreak', 'استراحت بلند']];
    const $ = (s, r = root) => r?.querySelector(s);
    const $$ = (s, r = document) => [...r.querySelectorAll(s)];
    let root, view, container, observer, raf = 0, cache = {};

    function mount() {
        view = document.getElementById('view-pomodoro');
        container = view?.querySelector('.pomodoro-container');
        if (!view || !container) return false;
        if (root?.isConnected) return true;
        root = document.createElement('div'); root.id = 'pmx'; root.className = 'pmx'; root.dataset.mode = 'work'; root.dataset.state = 'idle';
        root.innerHTML = `
        <header class="pmx-head">
            <div class="pmx-title"><h2>تمرکز</h2><p>یک بازه آرام برای مطالعه عمیق</p></div>
            <button type="button" class="pmx-icon" data-act="settings" aria-label="تنظیم زمان‌ها">${ico('tune')}</button>
        </header>
        <div class="pmx-layout">
            <section class="pmx-stage" aria-label="تایمر">
                <div class="pmx-seg" role="tablist" aria-label="نوع بازه" data-i="0"><i class="pmx-thumb" aria-hidden="true"></i>
                    ${MODES.map(([m, l]) => `<button type="button" role="tab" data-mode="${m}" aria-selected="false">${l}</button>`).join('')}
                </div>
                <button type="button" class="pmx-task" data-act="tasks" aria-label="تغییر تسک جاری">
                    <span class="pmx-task-ic">${ico('bookmark')}</span>
                    <span class="pmx-task-tx"><small>تسک جاری</small><strong id="pmx-task">—</strong></span>${ico('expand_more')}
                </button>
                <div class="pmx-dial" role="timer" aria-live="off">
                    <svg viewBox="0 0 280 280" aria-hidden="true">
                        <circle class="ticks" cx="140" cy="140" r="134"/>
                        <circle class="bg" cx="140" cy="140" r="120"/>
                        <circle class="fg" id="pmx-ring" cx="140" cy="140" r="120"/>
                    </svg>
                    <div class="pmx-time"><b id="pmx-digits">۲۵:۰۰</b><small id="pmx-status">آماده برای شروع</small></div>
                </div>
                <div class="pmx-cycle" id="pmx-cycle" aria-hidden="true"></div>
                <div class="pmx-controls">
                    <button type="button" class="pmx-ctl" data-act="reset" aria-label="بازنشانی">${ico('replay')}</button>
                    <button type="button" class="pmx-main" id="pmx-play" data-act="toggle"></button>
                    <button type="button" class="pmx-ctl" data-act="full" aria-label="حالت تمام‌صفحه">${ico('fullscreen')}</button>
                </div>
            </section>
            <aside class="pmx-side">
                <div class="pmx-stats" id="pmx-stats"></div>
                <section class="pmx-card" id="pmx-pick">
                    <header><h3>انتخاب تسک</h3><span class="pmx-note">از برنامه‌ی امروز</span></header>
                    <div class="pmx-opts" id="pmx-opts" role="radiogroup" aria-label="تسک تمرکز"></div>
                </section>
                <section class="pmx-card">
                    <header><h3>کارهای امروز</h3><span class="pmx-note" id="pmx-count"></span></header>
                    <form class="pmx-add" id="pmx-add" autocomplete="off"><input id="pmx-new" type="text" maxlength="80" placeholder="افزودن کار جدید…" aria-label="کار جدید"><button type="submit" aria-label="افزودن">${ico('add')}</button></form>
                    <ul class="pmx-list" id="pmx-list"></ul>
                </section>
            </aside>
        </div>`;
        view.prepend(root);
        root.addEventListener('click', onClick);
        $('#pmx-add').addEventListener('submit', onAdd);
        document.documentElement.classList.add('pmx-on');
        observe();
        return true;
    }

    function observe() {
        observer?.disconnect();
        observer = new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; sync(); }); });
        observer.observe(container, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'aria-label', 'value'] });
        observer.observe(view, { attributes: true, attributeFilter: ['data-timer-state', 'data-timer-mode'] });
    }

    function set(el, prop, val) { if (el && cache[el.id + prop] !== val) { cache[el.id + prop] = val; el[prop] = val; } }

    function sync() {
        if (!root?.isConnected) return;
        const q = id => document.getElementById(id);
        const oldRing = q('pomo-circle-progress');
        const activeTab = $$('.pomo-tab-btn.active', container)[0]?.id.replace('pomo-tab-', '');
        const mode = view.dataset.timerMode || activeTab || 'work';
        const btn = q('btn-pomo-play'), running = (view.dataset.timerState ? view.dataset.timerState === 'running' : /توقف/.test(btn?.getAttribute('aria-label') || btn?.textContent || ''));
        root.dataset.mode = mode; root.dataset.state = running ? 'running' : 'idle';
        $('.pmx-seg').dataset.i = String(Math.max(0, MODES.findIndex(m => m[0] === mode)));
        $$('.pmx-seg [data-mode]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
        set($('#pmx-digits'), 'textContent', q('pomo-display-time')?.textContent || '');
        set($('#pmx-status'), 'textContent', container.querySelector('.pomo-status-label')?.textContent || (running ? 'در حال تمرکز' : 'آماده برای شروع'));
        set($('#pmx-task'), 'textContent', q('pomo-active-task-label')?.textContent || 'مطالعه و تمرکز آزاد');
        if (oldRing) { const ring = $('#pmx-ring'); if (oldRing.style.strokeDasharray) ring.style.strokeDasharray = oldRing.style.strokeDasharray; if (oldRing.style.strokeDashoffset !== '') ring.style.strokeDashoffset = oldRing.style.strokeDashoffset; }
        const play = $('#pmx-play'), label = (btn?.textContent || '').trim() || (running ? 'توقف موقت' : 'شروع تمرکز');
        const html = `${ico(running ? 'pause' : 'play_arrow')}<span>${esc(label)}</span>`;
        if (cache.play !== html) { cache.play = html; play.innerHTML = html; play.setAttribute('aria-label', running ? 'توقف موقت تایمر' : 'شروع یا ادامهٔ تمرکز'); }
        stats(); options(); list(); cycle();
    }

    function stats() {
        const q = id => document.getElementById(id)?.textContent.trim() || '—';
        const html = [['task_alt', 'جلسه‌ی امروز', q('pomo-stat-today-sessions')], ['schedule', 'این هفته', q('pomo-stat-week-hours').replace('ساعت و', 'س و').replace('دقیقه', 'د').replace('ساعت', 'س')], ['local_fire_department', 'زنجیره', q('pomo-stat-streak').replace(/[^\d۰-۹]+$/g, '') + ' روز', 'warm']]
            .map(([i, l, v, c]) => `<div class="pmx-stat ${c || ''}">${ico(i)}<strong>${esc(v)}</strong><small>${l}</small></div>`).join('');
        if (cache.stats !== html) { cache.stats = html; $('#pmx-stats').innerHTML = html; }
    }

    function cycle() {
        const now = new Date(), key = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
        const n = Number((Storage.get('study_history', []) || []).find(h => h.date === key)?.sessions || 0), filled = n === 0 ? 0 : ((n - 1) % 4) + 1;
        const html = `${[0, 1, 2, 3].map(i => `<i class="${i < filled ? 'on' : ''}"></i>`).join('')}<small>${n ? `${pd(filled)} از ۴ تا استراحت بلند` : 'هر ۴ جلسه، یک استراحت بلند'}</small>`;
        if (cache.cycle !== html) { cache.cycle = html; $('#pmx-cycle').innerHTML = html; }
    }

    function options() {
        const sel = document.getElementById('pomo-task-selector'); if (!sel) return;
        const cur = sel.value;
        const html = [...sel.options].map((o, i) => {
            const parts = o.textContent.split('·'), name = parts[0].trim(), meta = (parts[1] || '').trim(), free = i === 0;
            return `<button type="button" class="pmx-opt" role="radio" aria-checked="${o.value === cur}" data-v="${esc(o.value)}">${ico(free ? 'self_improvement' : 'task_alt')}<span><strong>${esc(name)}</strong>${meta ? `<small>${esc(meta)}</small>` : ''}</span><i aria-hidden="true"></i></button>`;
        }).join('');
        if (cache.opts !== html) { cache.opts = html; $('#pmx-opts').innerHTML = html; }
    }

    function list() {
        const tasks = Storage.get('pomo_tasks', []) || [];
        const done = tasks.filter(t => t.done).length;
        const html = tasks.length ? tasks.map(t => `<li class="${t.done ? 'is-done' : ''}"><button type="button" class="pmx-check" role="checkbox" aria-checked="${!!t.done}" data-id="${esc(t.id)}" aria-label="${esc(t.title)}">${ico('check')}</button><span>${esc(t.title)}</span><button type="button" class="pmx-del" data-del="${esc(t.id)}" aria-label="حذف ${esc(t.title)}">${ico('close')}</button></li>`).join('') : `<li class="pmx-empty">${ico('checklist')}<span>هنوز کاری ثبت نشده؛ یک هدف کوچک اضافه کن.</span></li>`;
        if (cache.list !== html) { cache.list = html; $('#pmx-list').innerHTML = html; }
        set($('#pmx-count'), 'textContent', tasks.length ? `${pd(done)} از ${pd(tasks.length)}` : '');
    }

    function onClick(e) {
        const t = e.target.closest('[data-act],[data-mode],[data-v],[data-id],[data-del]'); if (!t || !root.contains(t)) return;
        const P = window.Pomodoro;
        if (t.dataset.mode) return P?.switchMode(t.dataset.mode);
        if (t.dataset.v != null) { const sel = document.getElementById('pomo-task-selector'); if (!sel) return; sel.value = t.dataset.v; sel.dispatchEvent(new Event('change', { bubbles: true })); return; }
        if (t.dataset.id) return P?.toggleTaskDone(t.dataset.id);
        if (t.dataset.del) return P?.deleteTask(t.dataset.del);
        switch (t.dataset.act) {
            case 'toggle': return P?.toggleTimer();
            case 'reset': return P?.resetTimer();
            case 'full': return P?.enterFullscreenFocus();
            case 'settings': return P?.openSettings();
            case 'tasks': return $('#pmx-pick').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
        }
    }
    function onAdd(e) {
        e.preventDefault();
        const input = $('#pmx-new'), old = document.getElementById('input-pomo-new-task');
        if (!input.value.trim() || !old) return;
        old.value = input.value; input.value = ''; window.Pomodoro?.addTaskSubmit(); input.focus();
    }

    function refresh() { cache = {}; if (!mount()) return; observe(); sync(); }
    document.addEventListener('pomodoro:rendered', refresh);
})();
