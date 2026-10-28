/**
 * Study-plan UI (phone + desktop; layout differs only by CSS).
 * Presentation layer only: reads the plan through Schedule.getState() and calls the existing public actions
 * (Schedule.openEditTaskModal / launchPomoForTask / printSchedule). Completion goes through StudyFlow's own
 * proof dialog by activating the (hidden) desktop checkbox, so no business rule is duplicated here.
 */
(function () {
    'use strict';
    const phone = matchMedia('(max-width: 720px)');
    const reduceQ = matchMedia('(prefers-reduced-motion: reduce)');
    const reduced = () => reduceQ.matches || document.documentElement.dataset.motion === 'off';
    const pd = v => (window.Utils?.toPersianDigits ? Utils.toPersianDigits(v) : String(v));
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const ico = n => `<span class="material-symbols-outlined" aria-hidden="true">${n}</span>`;
    const DAY_S = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
    const DAY_L = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
    const STATUS = { pending: ['در انتظار', ''], completed: ['انجام شد', 'ok'], partial: ['بخشی انجام شد', 'warn'], missed: ['انجام نشد', 'bad'] };
    const today = () => (new Date().getDay() + 1) % 7;
    const faDay = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric' });
    const faFull = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric', month: 'long' });
    const dateOf = i => { const d = new Date(); d.setDate(d.getDate() + i - today()); return d; };
    const dur = m => { const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${pd(h)} ساعت و ${pd(r)} دقیقه` : `${pd(h)} ساعت`) : `${pd(r)} دقیقه`; };

    let root, data = null, sel = today(), mode = 'day', dir = 0, seen = new Map(), firstPaint = true;
    const $ = (s, r = root) => r.querySelector(s);

    function mount() {
        if (root) return true;
        const anchor = document.getElementById('schedule-printable-area');
        if (!anchor) return false;
        root = document.createElement('div');
        root.id = 'scm'; root.className = 'scm';
        root.innerHTML = `
        <header class="scm-head">
            <div class="scm-title"><h2>برنامه مطالعه</h2><p id="scm-sub"></p></div>
            <div class="scm-tools">
                <button type="button" class="scm-icon" data-act="print" aria-label="چاپ برنامه">${ico('print')}</button>
                <button type="button" class="scm-icon is-primary" data-act="add" aria-label="افزودن تسک">${ico('add')}</button>
            </div>
        </header>
        <div class="scm-seg" role="tablist" aria-label="نوع نمایش" data-mode="day">
            <i class="scm-thumb" aria-hidden="true"></i>
            <button type="button" role="tab" data-mode="day" aria-selected="true">${ico('today')}روز</button>
            <button type="button" role="tab" data-mode="week" aria-selected="false">${ico('calendar_view_week')}هفته</button>
        </div>
        <div class="scm-strip" id="scm-strip" role="tablist" aria-label="روزهای هفته">
            ${DAY_S.map((s, i) => `<button type="button" role="tab" data-day="${i}"><small>${s}</small><b></b><i><u></u></i></button>`).join('')}
        </div>
        <div id="scm-day">
            <section class="scm-hero" aria-live="polite">
                <div class="scm-ring"><svg viewBox="0 0 64 64" aria-hidden="true"><circle class="t" cx="32" cy="32" r="27"/><circle class="v" cx="32" cy="32" r="27" pathLength="100"/></svg><b id="scm-pct"></b></div>
                <div class="scm-hero-copy"><h3 id="scm-hday"></h3><p id="scm-hline"></p><div class="scm-pills" id="scm-pills"></div></div>
                <button type="button" class="scm-cta" id="scm-cta" data-act="next" hidden></button>
            </section>
            <div class="scm-list" id="scm-list"></div>
        </div>
        <div class="scm-week" id="scm-week" hidden></div>`;
        anchor.before(root);
        root.addEventListener('click', onClick);
        bindSwipe($('#scm-day'));
        return true;
    }

    const stats = day => {
        const tasks = day.tasks, done = tasks.filter(t => t.status === 'completed');
        const minutes = tasks.reduce((s, t) => s + t.durationMinutes, 0), doneMin = done.reduce((s, t) => s + t.durationMinutes, 0);
        return { total: tasks.length, done: done.length, minutes, left: minutes - doneMin, pct: tasks.length ? Math.round(done.length / tasks.length * 100) : 0 };
    };

    function paint(animate) {
        if (!data || !root) return;
        const rows = data.days.map(stats);
        const all = rows.reduce((a, r) => ({ t: a.t + r.total, d: a.d + r.done }), { t: 0, d: 0 });
        $('#scm-sub').textContent = `${DAY_L[today()]} ${faFull.format(new Date())}${all.t ? ` · ${pd(all.d)} از ${pd(all.t)} تسک هفته` : ''}`;
        root.querySelectorAll('#scm-strip [data-day]').forEach((chip, i) => {
            const r = rows[i];
            chip.classList.toggle('is-sel', i === sel && mode === 'day');
            chip.classList.toggle('is-today', i === today());
            chip.classList.toggle('is-empty', !r.total);
            chip.setAttribute('aria-selected', String(i === sel && mode === 'day'));
            chip.setAttribute('aria-label', `${DAY_L[i]}${i === today() ? '، امروز' : ''}، ${r.total ? `${pd(r.total)} تسک` : 'بدون تسک'}`);
            $('b', chip).textContent = faDay.format(dateOf(i));
            $('u', chip).style.width = `${r.pct}%`;
        });
        $('.scm-seg').dataset.mode = mode;
        root.querySelectorAll('.scm-seg [data-mode]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
        $('#scm-day').hidden = mode !== 'day'; $('#scm-week').hidden = mode !== 'week'; $('#scm-strip').classList.toggle('is-off', mode !== 'day');
        mode === 'day' ? paintDay(rows[sel], animate) : paintWeek(rows);
        firstPaint = false;
    }

    function paintDay(r, animate) {
        const day = data.days[sel], manager = data.manager;
        $('#scm-hday').textContent = `${DAY_L[sel]}${sel === today() ? ' · امروز' : ''}`;
        $('#scm-hline').textContent = r.total ? (r.done === r.total ? 'همه تسک‌ها انجام شد؛ آفرین!' : `${pd(r.done)} از ${pd(r.total)} تسک انجام شد`) : 'برای این روز تسکی ثبت نشده است';
        $('#scm-pct').textContent = `${pd(r.pct)}٪`;
        root.querySelector('.scm-ring .v').style.strokeDashoffset = String(100 - r.pct);
        $('#scm-pills').innerHTML = r.total ? `<span>${ico('schedule')}${dur(r.minutes)}</span>${r.left && r.left !== r.minutes ? `<span class="is-left">${ico('hourglass_top')}${dur(r.left)} مانده</span>` : ''}` : '';
        const next = day.tasks.findIndex(t => t.status !== 'completed');
        const cta = $('#scm-cta');
        cta.hidden = manager || next < 0;
        if (!cta.hidden) { cta.dataset.t = String(next); cta.innerHTML = `${ico('play_arrow')}<span>شروع تمرکز: ${esc(day.tasks[next].subject)}</span>`; }

        const list = $('#scm-list');
        list.classList.remove('in-next', 'in-prev', 'in-rise');
        void list.offsetWidth;
        const cls = reduced() || !animate ? '' : dir > 0 ? 'in-next' : dir < 0 ? 'in-prev' : 'in-rise';
        if (cls) list.classList.add(cls);
        const fresh = [];
        list.innerHTML = day.tasks.map((t, i) => {
            const st = STATUS[t.status] || STATUS.pending, key = `${sel}:${t.id}`;
            if (t.status === 'completed' && seen.has(key) && seen.get(key) !== 'completed') fresh.push(i);
            return `<article class="scm-task is-${t.status}" data-d="${sel}" data-t="${i}" style="--c:${esc(t.color)};--i:${i}">
                ${manager ? '' : `<button type="button" class="scm-check" data-act="done" role="checkbox" aria-checked="${t.status === 'completed'}" aria-label="ثبت انجام ${esc(t.subject)}" ${t.status === 'completed' ? 'disabled' : ''}>${ico('check')}</button>`}
                <button type="button" class="scm-body" data-act="edit" aria-label="ویرایش ${esc(t.subject)}">
                    <strong>${esc(t.subject)}</strong>
                    ${t.note ? `<small>${esc(t.note)}</small>` : ''}
                    <span class="scm-meta"><span>${ico('schedule')}${dur(t.durationMinutes)}</span>${st[1] ? `<em class="${st[1]}">${st[0]}</em>` : ''}</span>
                </button>
                ${manager ? '' : `<button type="button" class="scm-play" data-act="focus" aria-label="شروع تمرکز برای ${esc(t.subject)}">${ico('play_arrow')}</button>`}
            </article>`;
        }).join('') + (day.tasks.length
            ? `<button type="button" class="scm-add" data-act="add">${ico('add_circle')}افزودن تسک به ${DAY_L[sel]}</button>`
            : `<div class="scm-empty">${ico('event_available')}<strong>این روز آزاد است</strong><p>یک تسک با مدت پیشنهادی اضافه کن تا برنامه‌ات شکل بگیرد.</p><button type="button" class="scm-cta is-solid" data-act="add">${ico('add')}<span>افزودن اولین تسک</span></button></div>`);
        data.days.forEach((d, di) => d.tasks.forEach(t => seen.set(`${di}:${t.id}`, t.status)));
        fresh.forEach(i => { const el = list.children[i]; el?.classList.add('is-pop'); });
    }

    function paintWeek(rows) {
        $('#scm-week').innerHTML = data.days.map((day, i) => {
            const r = rows[i];
            const bar = day.tasks.map(t => `<i style="flex:${t.durationMinutes};background:${esc(t.color)}" class="${t.status === 'completed' ? 'is-done' : ''}"></i>`).join('');
            return `<button type="button" class="scm-wrow${i === today() ? ' is-today' : ''}" data-pick="${i}" style="--i:${i}" aria-label="${DAY_L[i]}، ${r.total ? `${pd(r.total)} تسک، ${dur(r.minutes)}` : 'بدون تسک'}">
                <span class="scm-wday"><b>${DAY_S[i]}</b><small>${faDay.format(dateOf(i))}</small></span>
                <span class="scm-wmid"><span class="scm-bar">${bar || '<i class="is-none"></i>'}</span><small>${r.total ? `${pd(r.done)}/${pd(r.total)} انجام شد · ${dur(r.minutes)}` : 'بدون تسک'}</small></span>
                ${ico('chevron_left')}</button>`;
        }).join('');
    }

    function go(i, animate = true) {
        if (i < 0 || i > 6 || (i === sel && mode === 'day')) return;
        dir = i > sel ? 1 : -1; sel = i; mode = 'day'; paint(animate);
        root.querySelector(`#scm-strip [data-day="${i}"]`)?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
    }

    function complete(d, t) {
        const card = document.querySelectorAll('#schedule-days-list .schedule-day-card')[d];
        const box = card?.querySelectorAll('.day-task')[t]?.querySelector('.sf-check');
        if (box && !box.disabled) box.click(); else window.Schedule?.openEditTaskModal(d, t);
    }

    function onClick(e) {
        const el = e.target.closest('[data-act],[data-day],[data-mode],[data-pick]');
        if (!el || !root.contains(el)) return;
        if (el.dataset.day != null) return go(Number(el.dataset.day));
        if (el.dataset.pick != null) { dir = 0; sel = Number(el.dataset.pick); mode = 'day'; return paint(true); }
        if (el.dataset.mode) { if (mode !== el.dataset.mode) { mode = el.dataset.mode; dir = 0; paint(true); } return; }
        const card = el.closest('.scm-task'), d = Number(card?.dataset.d ?? sel), t = Number(card?.dataset.t);
        switch (el.dataset.act) {
            case 'add': return window.Schedule?.openEditTaskModal(sel, -1);
            case 'print': return window.Schedule?.printSchedule();
            case 'edit': return window.Schedule?.openEditTaskModal(d, t);
            case 'focus': return window.Schedule?.launchPomoForTask(d, t);
            case 'done': return complete(d, t);
            case 'next': return window.Schedule?.launchPomoForTask(sel, Number(el.dataset.t));
        }
    }

    function bindSwipe(area) {
        let sx = 0, sy = 0, on = false;
        area.addEventListener('touchstart', e => {
            on = e.touches.length === 1 && e.touches[0].clientX < innerWidth * .78;   // right edge belongs to the side menu
            sx = e.touches[0].clientX; sy = e.touches[0].clientY;
        }, { passive: true });
        area.addEventListener('touchend', e => {
            if (!on) return; on = false;
            const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
            if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
            go(sel + (dx < 0 ? 1 : -1));                                             // RTL: swipe left = next day
        }, { passive: true });
    }

    function sync() { document.documentElement.classList.toggle('scm-on', !!root); }   // phone and desktop share the markup; CSS sizes it
    function refresh() {
        if (!window.Schedule?.getState || !mount()) return;
        data = Schedule.getState();
        sync(); paint(firstPaint);
    }
    document.addEventListener('schedule:rendered', refresh);
    phone.addEventListener('change', sync);
})();
