/**
 * Study-plan UI (phone overview + desktop timetable).
 * Presentation layer only: reads the plan through Schedule.getState() and calls the existing public actions
 * (Schedule.openEditTaskModal / launchPomoForTask / printSchedule). Completion goes through StudyFlow's own
 * proof dialog by activating the (hidden) desktop checkbox, so no business rule is duplicated here.
 */
(function () {
    'use strict';
    const phone = matchMedia('(max-width: 720px), (max-width: 1000px) and (max-height: 500px) and (pointer: coarse)');
    const reduceQ = matchMedia('(prefers-reduced-motion: reduce)');
    const reduced = () => reduceQ.matches || document.documentElement.dataset.motion === 'off';
    const pd = v => (window.Utils?.toPersianDigits ? Utils.toPersianDigits(v) : String(v));
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const calendar = '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18"/>';
    const plus = 'M12 7v10m-5-5h10';
    const check = 'm7 12 3 3 6-6';
    const icons = {
        print: '<path d="M6 8V3h12v5M6 16H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M6 13h12v8H6zM6 11h1"/>',
        add: `<path d="${plus}"/>`,
        add_circle: `<circle cx="12" cy="12" r="9"/><path d="${plus}"/>`,
        today: calendar + '<path d="M8 14h2v2H8z"/>',
        calendar_view_week: calendar + '<path d="M9 10v11m6-11v11"/>',
        grid_on: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18m6-18v18M3 9h18M3 15h18"/>',
        schedule: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        hourglass_top: '<path d="M6 3h12M6 21h12M7 3v3c0 3 2 4 5 6-3 2-5 3-5 6v3m10-18v3c0 3-2 4-5 6 3 2 5 3 5 6v3"/>',
        play_arrow: '<path d="m8 5 12 7-12 7z" fill="currentColor" stroke="none"/>',
        check: `<path d="${check}"/>`,
        check_circle: `<circle cx="12" cy="12" r="9"/><path d="${check}"/>`,
        event_available: calendar + `<path d="${check}" transform="translate(0 2)"/>`,
        chevron_left: '<path d="m14 6-6 6 6 6"/>',
        arrow_back: '<path d="M20 12H4m6-6-6 6 6 6"/>',
        info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
        menu_book: '<path d="M12 5v15m0-15C8 3 5 3 2 4v15c3-1 6-1 10 1 4-2 7-2 10-1V4c-3-1-6-1-10 1z"/>',
        close: '<path d="m6 6 12 12M18 6 6 18"/>',
        edit: '<path d="m14 5 5 5M4 20l1-5L16 4a2 2 0 0 1 3 0l1 1a2 2 0 0 1 0 3L9 19z"/>'
    };
    const ico = name => `<svg class="scm-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
    const DAY_S = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
    const DAY_L = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
    const STATUS = { pending: ['در انتظار', ''], completed: ['انجام شد', 'ok'], partial: ['بخشی انجام شد', 'warn'], missed: ['انجام نشد', 'bad'] };
    const today = () => (new Date().getDay() + 1) % 7;
    const faDay = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric' });
    const faFull = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric', month: 'long' });
    const dateOf = i => { const d = new Date(); d.setDate(d.getDate() + i - today()); return d; };
    const dur = m => { const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${pd(h)} ساعت و ${pd(r)} دقیقه` : `${pd(h)} ساعت`) : `${pd(r)} دقیقه`; };
    const tableDuration = m => `${pd(m)} دقیقه`;

    const viewModes = { phone: 'week', desktop: 'table' };
    let root, data = null, sel = today(), mode = phone.matches ? viewModes.phone : viewModes.desktop, dir = 0, seen = new Map(), firstPaint = true;
    const $ = (s, r = root) => r.querySelector(s);
    const setMode = next => { viewModes[phone.matches ? 'phone' : 'desktop'] = mode = next; };

    function mount() {
        if (root) return true;
        const anchor = document.getElementById('schedule-printable-area');
        if (!anchor) return false;
        root = document.createElement('div');
        root.id = 'scm'; root.className = 'scm';
        root.classList.toggle('scm-compact', phone.matches);
        root.innerHTML = `
        <header class="scm-head">
            <div class="scm-title"><h2 id="scm-title">برنامه مطالعه</h2><p id="scm-sub"></p></div>
            <div class="scm-tools">
                <button type="button" class="scm-icon" data-act="print" aria-label="چاپ برنامه">${ico('print')}</button>
                <button type="button" class="scm-icon is-primary" data-act="add" aria-label="افزودن تسک">${ico('add')}</button>
            </div>
        </header>
        <div class="scm-seg" role="tablist" aria-label="نوع نمایش" data-mode="day">
            <i class="scm-thumb" aria-hidden="true"></i>
            <button type="button" role="tab" data-mode="day" aria-selected="true">${ico('today')}روز</button>
            <button type="button" role="tab" data-mode="week" aria-selected="false">${ico('calendar_view_week')}هفته</button>
            <button type="button" role="tab" data-mode="table" aria-selected="false"${phone.matches ? ' hidden disabled' : ''}>${ico('grid_on')}جدول</button>
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
        <div class="scm-week" id="scm-week" hidden></div>
        <section id="scm-table" hidden aria-label="جدول برنامه هفتگی"></section>`;
        anchor.before(root);
        root.addEventListener('click', onClick);
        const dialog = document.createElement('dialog');
        dialog.id = 'scm-detail'; dialog.className = 'scm-detail';
        dialog.setAttribute('aria-labelledby', 'scm-detail-title');
        document.body.append(dialog);
        let fromBackdrop = false;
        const isBackdrop = e => {
            if (e.target !== dialog) return false;
            const { left, right, top, bottom } = dialog.getBoundingClientRect();
            return e.clientX < left || e.clientX > right || e.clientY < top || e.clientY > bottom;
        };
        dialog.addEventListener('pointerdown', e => { fromBackdrop = isBackdrop(e); });
        dialog.addEventListener('click', e => {
            if ((fromBackdrop && isBackdrop(e)) || e.target.closest('[data-detail-close]')) dialog.close();
            fromBackdrop = false;
            const action = e.target.closest('[data-detail-action]');
            if (!action) return;
            const d = Number(dialog.dataset.day), t = Number(dialog.dataset.task);
            dialog.close();
            if (action.dataset.detailAction === 'edit') Schedule.openEditTaskModal(d, t);
            else Schedule.launchPomoForTask(d, t);
        });
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
        $('#scm-title').textContent = mode === 'table' ? 'جدول هفتگی' : 'برنامه مطالعه';
        $('#scm-sub').textContent = mode === 'table'
            ? (all.t ? `${pd(all.d)} از ${pd(all.t)} تسک انجام شد · ${dur(rows.reduce((sum, row) => sum + row.minutes, 0))} مطالعه` : 'برای شروع، به یکی از روزها درس اضافه کن.')
            : `${DAY_L[today()]} ${faFull.format(new Date())}${all.t ? ` · ${pd(all.d)} از ${pd(all.t)} تسک هفته` : ''}`;
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
        $('#scm-day').hidden = mode !== 'day'; $('#scm-week').hidden = mode !== 'week';
        $('#scm-strip').classList.toggle('is-off', mode !== 'day');
        $('#scm-strip').inert = mode !== 'day';
        $('#scm-table').hidden = mode !== 'table';
        if (mode === 'day') paintDay(rows[sel], animate);
        else if (mode === 'week') paintWeek(rows);
        else paintTable(rows);
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
                <span class="scm-wmid"><span class="scm-wlabel"><strong>${DAY_L[i]}</strong><span>${faFull.format(dateOf(i))}</span></span><span class="scm-bar" aria-hidden="true">${bar || '<i class="is-none"></i>'}</span><small>${r.total ? `${pd(r.done)}/${pd(r.total)} انجام شد · ${dur(r.minutes)}` : 'بدون تسک'}</small></span>
                ${ico('chevron_left')}</button>`;
        }).join('');
    }

    function paintTable(rows) {
        const count = Math.max(1, ...data.days.map(day => day.tasks.length));
        const panel = $('#scm-table');
        const previous = $('.scm-table-scroll', panel);
        const scroll = previous && { top: previous.scrollTop, left: previous.scrollLeft };
        panel.innerHTML = `<div class="scm-table-scroll" tabindex="0" role="region" aria-label="جدول برنامه و جزئیات درس‌ها"><table class="scm-timetable" aria-labelledby="scm-title"><thead><tr><th scope="col">نوبت</th>${data.days.map((_, d) => {
            const currentDay = d === today();
            return `<th scope="col"${currentDay ? ' class="is-today"' : ''}><strong>${DAY_L[d]}</strong><small>${currentDay ? 'امروز، ' : ''}${faFull.format(dateOf(d))}</small>${rows[d].minutes ? `<span class="scm-column-time">${tableDuration(rows[d].minutes)}</span>` : ''}</th>`;
        }).join('')}</tr></thead><tbody>${Array.from({length: count}, (_, t) => `<tr><th scope="row" aria-label="نوبت ${pd(t + 1)}"><span>${pd(t + 1)}</span></th>${data.days.map((day, d) => {
            const task = day.tasks[t];
            const cell = d === today() ? '<td class="is-today">' : '<td>';
            if (!task) return `${cell}<button type="button" class="scm-table-empty" data-act="table-add" data-d="${d}" title="افزودن درس" aria-label="افزودن درس به ${DAY_L[d]}">${ico('add')}</button></td>`;
            const status = STATUS[task.status] || STATUS.pending;
            return `${cell}<button type="button" class="scm-table-course" data-act="detail" data-d="${d}" data-t="${t}" style="--course:${esc(task.color)}" aria-label="جزئیات ${esc(task.subject)}، ${DAY_L[d]}، ${dur(task.durationMinutes)}، ${status[0]}"><strong>${esc(task.subject)}</strong><span class="scm-course-meta"><span class="scm-course-time">${ico('schedule')}${tableDuration(task.durationMinutes)}</span>${status[1] ? `<span class="scm-course-status ${status[1]}">${status[0]}</span>` : ''}</span>${task.note ? `<small>${esc(task.note)}</small>` : ''}</button></td>`;
        }).join('')}</tr>`).join('')}</tbody></table></div><p class="scm-table-hint">${ico('info')}برای دیدن جزئیات، روی درس و برای افزودن درس، روی + بزن.</p>`;
        if (scroll) {
            const scroller = $('.scm-table-scroll', panel);
            scroller.scrollTop = scroll.top;
            scroller.scrollLeft = scroll.left;
        }
    }

    function showDetail(d, t) {
        const task = data.days[d]?.tasks[t];
        if (!task) return;
        const dialog = document.getElementById('scm-detail');
        dialog.dataset.day = d; dialog.dataset.task = t;
        const status = STATUS[task.status] || STATUS.pending;
        dialog.style.setProperty('--course', task.color);
        dialog.innerHTML = `<header><div><span class="scm-eyebrow">${DAY_L[d]} · نوبت ${pd(t + 1)}</span><h2 id="scm-detail-title">${esc(task.subject)}</h2></div><button type="button" data-detail-close aria-label="بستن جزئیات" autofocus>${ico('close')}</button></header><div class="scm-detail-meta"><span>${ico('schedule')}${dur(task.durationMinutes)}</span><span class="scm-course-status ${status[1]}">${status[0]}</span></div><section class="scm-detail-copy"><h3>توضیحات درس</h3><p class="scm-detail-note">${esc(task.note || 'هنوز توضیحی برای این درس ثبت نشده است.')}</p></section><footer><button type="button" data-detail-action="edit">${ico('edit')}ویرایش درس</button>${data.manager ? '' : `<button type="button" class="is-primary" data-detail-action="focus">${ico('play_arrow')}شروع تمرکز</button>`}</footer>`;
        dialog.showModal();
    }

    function go(i, animate = true) {
        if (i < 0 || i > 6 || (i === sel && mode === 'day')) return;
        dir = i > sel ? 1 : -1; sel = i; setMode('day'); paint(animate);
        if (!phone.matches) $(`#scm-strip [data-day="${i}"]`)?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
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
        if (el.dataset.pick != null) {
            dir = 0; sel = Number(el.dataset.pick); setMode('day'); paint(true);
            if (e.detail === 0) $(`#scm-strip [data-day="${sel}"]`)?.focus({ preventScroll: true });
            return;
        }
        if (el.dataset.mode) {
            const next = el.dataset.mode;
            if (el.matches('button:not(:disabled)') && mode !== next && (!phone.matches || next !== 'table')) {
                setMode(next); dir = 0; paint(true);
            }
            return;
        }
        if (el.dataset.act === 'detail') return showDetail(Number(el.dataset.d), Number(el.dataset.t));
        if (el.dataset.act === 'table-add') return window.Schedule?.openEditTaskModal(Number(el.dataset.d), -1);
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

    function sync() {
        if (!root) return;
        document.documentElement.classList.add('scm-on');
        root.classList.toggle('scm-compact', phone.matches);
        const tableTab = $('button[data-mode="table"]');
        tableTab.hidden = tableTab.disabled = phone.matches;
        mode = viewModes[phone.matches ? 'phone' : 'desktop'];
    }
    function refresh() {
        if (!window.Schedule?.getState || !mount()) return;
        data = Schedule.getState();
        sync(); paint(firstPaint);
    }
    document.addEventListener('schedule:rendered', refresh);
    phone.addEventListener('change', () => {
        if (!root) return;
        const focusWillHide = document.activeElement?.closest('[data-mode="table"], #scm-table, #scm-detail');
        const detail = document.getElementById('scm-detail');
        if (phone.matches && detail.open) detail.close();
        sync(); paint(false);
        if (phone.matches && focusWillHide) $(`button[data-mode="${mode}"]`)?.focus({ preventScroll: true });
    });
})();
