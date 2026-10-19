/**
 * Mobile redesign v2 runtime — the behavior layer for css/mobile-redesign.css.
 *
 * The stylesheet declares the whole phone layout (v2 "Focus Indigo"
 * identity) for the Statistics and Study Plan pages and expects a small
 * set of runtime hooks (classes and nodes). This file provides exactly
 * those hooks:
 *
 *  - activates the redesign (`html.m-redesign`) and mirrors the in-app
 *    "reduce motion" setting onto `html[data-motion="off"]`
 *  - keeps the bottom navigation clear of the software keyboard and exposes
 *    the visual-viewport height as `--m-vvh` for bottom sheets
 *  - wires the tappable statistics trend chart (web renderer)
 *  - turns the study plan into a day-first mobile flow: sticky Jalali week
 *    strip with per-day completion meters, one visible day at a time with
 *    slide transitions and swipe support, per-day progress, quick-add
 *    buttons and friendly empty states
 *  - makes the study-report card collapsible and trims long report lists
 *  - presents the task editor and the completion dialog as bottom sheets
 *    with quick duration chips
 *
 * Everything is gated behind the same `max-width: 720px` breakpoint the CSS
 * uses, so desktop layouts and printers are untouched: injected nodes are
 * removed again when the viewport grows beyond the breakpoint. No data,
 * storage or API behavior is modified — this layer only decorates the DOM
 * that Schedule / StudyFlow / StudyWorkspace / Stats already render.
 */
(function () {
    'use strict';

    const root = document.documentElement;
    const mq = matchMedia('(max-width: 720px)');
    const pd = value => (window.Utils?.toPersianDigits ? Utils.toPersianDigits(value) : String(value));
    const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

    root.classList.add('m-redesign');

    /* ------------------------------------------------------------ motion */
    function syncMotion() {
        try {
            if (window.Storage?.getSettings?.().motion === 'off') root.setAttribute('data-motion', 'off');
            else root.removeAttribute('data-motion');
        } catch (_) { /* storage not ready yet */ }
    }

    /* ------------------------------------------- software keyboard / vv */
    let kbTimer = 0;
    function syncViewport() {
        const vv = window.visualViewport;
        const height = vv ? vv.height : window.innerHeight;
        root.style.setProperty('--m-vvh', `${Math.round(height)}px`);
        if (vv) root.classList.toggle('m-kb-open', window.innerHeight - height > 120);
    }
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', syncViewport);
        window.visualViewport.addEventListener('scroll', syncViewport);
    }
    window.addEventListener('resize', syncViewport);
    /* Webviews without visualViewport: approximate with field focus. */
    document.addEventListener('focusin', event => {
        if (!mq.matches || !event.target.matches?.('input, textarea, select')) return;
        clearTimeout(kbTimer);
        if (!window.visualViewport) root.classList.add('m-kb-open');
        kbTimer = setTimeout(syncViewport, 300);
    });
    document.addEventListener('focusout', () => {
        clearTimeout(kbTimer);
        kbTimer = setTimeout(() => { if (!window.visualViewport) root.classList.remove('m-kb-open'); syncViewport(); }, 250);
    });

    /* ------------------------------------------------- page entrances */
    /* The v2 palette (css/mobile-redesign.css) is scoped to `body.m2-on`,
       so the new identity paints only the Statistics / Study Plan pages —
       the profile keeps the compatibility tokens defined on <html>. */
    function syncBodyView() {
        if (!document.body) return;
        const statsOn = document.getElementById('view-stats')?.classList.contains('active');
        const scheduleOn = document.getElementById('view-schedule')?.classList.contains('active');
        document.body.classList.toggle('m2-on', Boolean(statsOn || scheduleOn));
        document.body.classList.toggle('m2-stats', Boolean(statsOn));
        document.body.classList.toggle('m2-schedule', Boolean(scheduleOn));
    }
    const enterObserver = new MutationObserver(records => records.forEach(record => {
        syncBodyView();
        const view = record.target;
        if (!view.classList.contains('active') || view.classList.contains('m-enter')) return;
        syncMotion();
        if (view.id === 'view-schedule') queueEnhance();
        if (view.id === 'view-stats') queueReports();
        setupReportCard();
        /* WebStudio already animates route changes on the web; the CSS
           entrance is for shells without it (the native app). */
        if (!mq.matches || window.WebStudio?.enabled?.()) return;
        view.classList.add('m-enter');
        setTimeout(() => view.classList.remove('m-enter'), 750);
    }));
    ['view-stats', 'view-schedule'].forEach(id => {
        const view = document.getElementById(id);
        if (view) enterObserver.observe(view, { attributes: true, attributeFilter: ['class'] });
    });

    /* ------------------------------------------- statistics trend chart */
    /* StudyWorkspace renders tappable day bars (`data-time` / `data-label`)
       and a readout area with `data-default-*`; this wires the interaction
       on every viewport size — it was previously dead markup. */
    document.addEventListener('click', event => {
        const bar = event.target.closest('#view-stats .sw-trend-day');
        if (!bar) return;
        const readout = document.getElementById('sw-readout');
        if (!readout) return;
        const value = readout.querySelector('strong'), label = readout.querySelector('span');
        const wasActive = bar.classList.contains('is-active');
        $$('#view-stats .sw-trend-day.is-active').forEach(item => item.classList.remove('is-active'));
        if (wasActive) {
            if (value) value.textContent = readout.dataset.defaultTime || '';
            if (label) label.textContent = readout.dataset.defaultLabel || '';
            return;
        }
        bar.classList.add('is-active');
        if (value) value.textContent = bar.dataset.time || '';
        if (label) label.textContent = bar.dataset.label || '';
    });

    /* ------------------------------------------------------ study plan */
    const DAY_NAMES = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
    const todayIndex = () => (new Date().getDay() + 1) % 7; // Persian week: شنبه = 0
    const dayNumberFmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric' });
    const dayFullFmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric', month: 'long' });
    const weekdayNarrowFmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { weekday: 'narrow' });
    let selectedDay = todayIndex();
    let previousStatuses = new Map();

    function weekDates() {
        const now = new Date();
        const saturday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - todayIndex());
        return DAY_NAMES.map((_, index) => new Date(saturday.getFullYear(), saturday.getMonth(), saturday.getDate() + index));
    }

    function selectDay(day) {
        const next = Math.max(0, Math.min(6, Number(day) || 0));
        if (next === selectedDay) return;
        const direction = next > selectedDay ? 1 : -1;
        selectedDay = next;
        enhanceSchedule();
        const card = document.querySelectorAll('#schedule-days-list .schedule-day-card')[selectedDay];
        if (!card || matchMedia('(prefers-reduced-motion: reduce)').matches || root.dataset.motion === 'off') return;
        const slide = direction > 0 ? 'm-slide-next' : 'm-slide-prev';
        card.classList.remove('m-slide-next', 'm-slide-prev');
        void card.offsetWidth; // restart the animation when flipping back and forth
        card.classList.add(slide);
        card.addEventListener('animationend', () => card.classList.remove(slide), { once: true });
        setTimeout(() => card.classList.remove(slide), 400);
    }

    function countDone(tasks) { return tasks.filter(task => task.dataset.status === 'completed').length; }

    function decorateCard(card, dayIndex) {
        const tasks = $$('.day-task', card);
        const total = tasks.length, done = countDone(tasks);
        card.classList.toggle('is-today', dayIndex === todayIndex());
        card.classList.toggle('is-complete', total > 0 && done === total);
        tasks.forEach(task => {
            task.classList.toggle('is-partial', task.dataset.status === 'partial');
            task.classList.toggle('is-missed', task.dataset.status === 'missed');
            const note = task.querySelector('.day-task-copy small');
            if (note) note.classList.toggle('is-blank', note.textContent.trim() === 'بدون توضیح تکمیلی');
        });
        if (!mq.matches) return { total, done };

        const header = card.querySelector(':scope > header');
        if (header && !header.querySelector('.m-day-add')) {
            const add = document.createElement('button');
            add.type = 'button';
            add.className = 'm-day-add';
            add.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">add</span>';
            add.setAttribute('aria-label', `افزودن تسک برای ${DAY_NAMES[dayIndex]}`);
            add.addEventListener('click', () => window.Schedule?.openEditTaskModal(dayIndex, -1));
            header.append(add);
        }

        let progress = card.querySelector(':scope > .m-day-progress');
        if (!progress && header) {
            progress = document.createElement('div');
            progress.className = 'm-day-progress';
            progress.setAttribute('aria-hidden', 'true');
            progress.innerHTML = '<i></i><span></span>';
            header.after(progress);
        }
        if (progress) {
            progress.hidden = total === 0;
            progress.querySelector('i').style.width = `${total ? Math.round(done / total * 100) : 0}%`;
            progress.querySelector('span').textContent = total && done === total
                ? `همهٔ ${pd(total)} تسک این روز انجام شد`
                : `${pd(done)} از ${pd(total)} تسک انجام شده`;
        }

        const empty = card.querySelector('.day-empty');
        if (empty && !empty.querySelector('.m-empty-cta')) {
            empty.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">event_available</span>'
                + '<strong>این روز هنوز برنامه‌ای ندارد</strong>'
                + '<span>یک تسک کوچک برای شروع کافی است.</span>';
            const cta = document.createElement('button');
            cta.type = 'button';
            cta.className = 'm-empty-cta';
            cta.textContent = 'افزودن اولین تسک';
            cta.addEventListener('click', () => window.Schedule?.openEditTaskModal(dayIndex, -1));
            empty.append(cta);
        }
        return { total, done };
    }

    function syncStripSelection(strip) {
        $$('[data-m-day]', strip).forEach(button => {
            const day = Number(button.dataset.mDay);
            button.classList.toggle('is-selected', day === selectedDay);
            button.setAttribute('aria-pressed', String(day === selectedDay));
        });
    }

    function buildStrip(summaries, visible) {
        const anchor = document.getElementById('schedule-printable-area');
        let strip = document.querySelector('.m-day-strip');
        if (!visible) { if (strip) strip.hidden = true; return; }
        if (!strip && anchor) {
            strip = document.createElement('div');
            strip.className = 'm-day-strip';
            strip.setAttribute('role', 'group');
            strip.setAttribute('aria-label', 'انتخاب روز هفته');
            strip.addEventListener('click', event => {
                const button = event.target.closest('[data-m-day]');
                if (button) selectDay(Number(button.dataset.mDay));
            });
            anchor.before(strip);
        }
        if (!strip) return;
        strip.hidden = false;
        const dates = weekDates(), today = todayIndex();
        const signature = `t${today}|` + summaries.map(item => `${item.done}/${item.total}`).join('|');
        if (strip.dataset.signature !== signature) {
            strip.dataset.signature = signature;
            const hadFocus = strip.contains(document.activeElement);
            strip.innerHTML = summaries.map((item, dayIndex) => {
                const percent = item.total ? Math.round(item.done / item.total * 100) : 0;
                const classes = [dayIndex === today ? 'is-today' : '', !item.total ? 'is-empty' : ''].join(' ').trim();
                const label = `${DAY_NAMES[dayIndex]} ${dayFullFmt.format(dates[dayIndex])}`
                    + (item.total ? `، ${pd(item.done)} از ${pd(item.total)} تسک انجام شده` : '، بدون تسک');
                return `<button type="button" data-m-day="${dayIndex}"${classes ? ` class="${classes}"` : ''} style="--pct:${percent}%" aria-pressed="false" aria-label="${label}"><small>${weekdayNarrowFmt.format(dates[dayIndex])}</small><span class="m-day-ring" aria-hidden="true"><strong>${dayNumberFmt.format(dates[dayIndex])}</strong></span></button>`;
            }).join('');
            if (hadFocus) strip.querySelector(`[data-m-day="${selectedDay}"]`)?.focus({ preventScroll: true });
        }
        syncStripSelection(strip);
    }

    function detectJustDone(cards) {
        const next = new Map();
        cards.forEach((card, dayIndex) => $$('.day-task', card).forEach((task, taskIndex) => {
            const key = `${dayIndex}:${taskIndex}`;
            const status = task.dataset.status || 'pending';
            next.set(key, status);
            if (previousStatuses.has(key) && previousStatuses.get(key) !== 'completed' && status === 'completed') {
                task.classList.add('m-just-done');
                setTimeout(() => task.classList.remove('m-just-done'), 700);
            }
        }));
        previousStatuses = next;
    }

    const scheduleObserver = new MutationObserver(() => queueEnhance());
    function watchScheduleList() {
        const list = document.getElementById('schedule-days-list');
        if (!list) return;
        scheduleObserver.observe(list, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }

    function enhanceSchedule() {
        const list = document.getElementById('schedule-days-list');
        if (!list) return;
        /* Ignore our own decorations: detach while mutating, then re-watch. */
        scheduleObserver.disconnect();
        try {
            const cards = $$('.schedule-day-card', list);
            if (!cards.length) return;
            const summaries = cards.map((card, dayIndex) => decorateCard(card, dayIndex));
            const singleDay = mq.matches && !list.classList.contains('sf-week-grid');
            cards.forEach((card, dayIndex) => card.classList.toggle('m-day-hidden', singleDay && dayIndex !== selectedDay));
            buildStrip(summaries, singleDay);
            detectJustDone(cards);
        } finally {
            watchScheduleList();
        }
    }

    let enhanceQueued = false;
    function queueEnhance() {
        if (enhanceQueued) return;
        enhanceQueued = true;
        requestAnimationFrame(() => { enhanceQueued = false; enhanceSchedule(); });
    }

    /* Swipe between days (RTL: swipe left = next day). Start points near the
       right edge are left to the side-menu gesture. */
    let touch = null;
    document.addEventListener('touchstart', event => {
        if (!mq.matches || event.touches.length !== 1) { touch = null; return; }
        if (!event.target.closest?.('#schedule-days-list')) { touch = null; return; }
        const start = event.touches[0];
        touch = start.clientX > window.innerWidth * 0.78 ? null : { x: start.clientX, y: start.clientY };
    }, { passive: true });
    /* Decide on touchmove, before the browser can claim the gesture for
       scrolling (which would swallow touchend as a touchcancel). */
    document.addEventListener('touchmove', event => {
        if (!touch || !mq.matches) return;
        const current = event.touches[0];
        if (!current) return;
        const dx = current.clientX - touch.x, dy = current.clientY - touch.y;
        if (Math.abs(dy) > 48 && Math.abs(dy) > Math.abs(dx)) { touch = null; return; } // vertical scroll intent
        if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
        const list = document.getElementById('schedule-days-list');
        touch = null;
        if (!list || list.classList.contains('sf-week-grid')) return;
        selectDay(selectedDay + (dx < 0 ? 1 : -1));
    }, { passive: true });
    document.addEventListener('touchend', () => { touch = null; }, { passive: true });
    document.addEventListener('touchcancel', () => { touch = null; }, { passive: true });

    /* ------------------------------------------------- study-report card */
    let reportCollapsed = false;   // the student's own choice, kept across re-renders
    let reportsExpanded = false;

    function setupReportCard() {
        const card = document.querySelector('.manual-report-card');
        const heading = card?.querySelector('.manual-report-heading');
        if (!card || !heading) return;
        if (!heading.querySelector('.m-chevron')) {
            const chevron = document.createElement('span');
            chevron.className = 'm-chevron';
            chevron.setAttribute('aria-hidden', 'true');
            heading.append(chevron);
        }
        card.classList.toggle('m-collapsed', reportCollapsed && mq.matches);
        heading.setAttribute('aria-expanded', String(!(reportCollapsed && mq.matches)));
        if (card.dataset.mBound) return;
        card.dataset.mBound = '1';
        heading.setAttribute('role', 'button');
        heading.setAttribute('tabindex', '0');
        heading.setAttribute('aria-controls', 'manual-report-form');
        const toggle = () => {
            reportCollapsed = !reportCollapsed;
            card.classList.toggle('m-collapsed', reportCollapsed);
            heading.setAttribute('aria-expanded', String(!reportCollapsed));
        };
        heading.addEventListener('click', event => {
            if (!mq.matches || event.target.closest('input, select, textarea, button, a')) return;
            toggle();
        });
        heading.addEventListener('keydown', event => {
            if (!mq.matches || event.target !== heading) return;
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); }
        });
        /* Focusing a field (e.g. via "ثبت گزارش" shortcuts) always re-opens. */
        card.addEventListener('focusin', event => {
            if (!event.target.closest('.manual-report-form')) return;
            reportCollapsed = false;
            card.classList.remove('m-collapsed');
            heading.setAttribute('aria-expanded', 'true');
        });
    }

    function enhanceReports() {
        const box = document.getElementById('manual-report-list');
        if (!box) return;
        setupReportCard();
        const count = box.querySelectorAll('article').length;
        const many = mq.matches && count > 3;
        box.classList.toggle('m-trimmed', many && !reportsExpanded);
        let more = box.parentElement?.querySelector(':scope > .m-more');
        if (many) {
            if (!more) {
                more = document.createElement('button');
                more.type = 'button';
                more.className = 'm-more';
                more.addEventListener('click', () => { reportsExpanded = !reportsExpanded; enhanceReports(); });
                box.after(more);
            }
            more.hidden = false;
            more.textContent = reportsExpanded ? 'نمایش کمتر' : `نمایش همهٔ گزارش‌ها (${pd(count)})`;
            more.setAttribute('aria-expanded', String(reportsExpanded));
        } else if (more) more.hidden = true;
    }

    let reportsQueued = false;
    function queueReports() {
        if (reportsQueued) return;
        reportsQueued = true;
        requestAnimationFrame(() => { reportsQueued = false; enhanceReports(); });
    }
    const reportBox = document.getElementById('manual-report-list');
    if (reportBox) new MutationObserver(queueReports).observe(reportBox, { childList: true });

    /* ------------------------------------------------------ bottom sheets */
    function setupTaskSheet() {
        const modal = document.getElementById('modal-edit-schedule-slot');
        if (!modal) return;
        modal.classList.add('m-sheet'); // its rules only apply ≤ 720px
        const duration = document.getElementById('input-task-duration');
        if (!duration || modal.dataset.mChips) return;
        modal.dataset.mChips = '1';
        const presets = [[15, '۱۵ دقیقه'], [30, '۳۰ دقیقه'], [45, '۴۵ دقیقه'], [60, '۱ ساعت'], [90, '۱٫۵ ساعت'], [120, '۲ ساعت']];
        const chips = document.createElement('div');
        chips.className = 'm-chips';
        chips.setAttribute('role', 'group');
        chips.setAttribute('aria-label', 'انتخاب سریع مدت مطالعه');
        chips.innerHTML = presets.map(([minutes, label]) => `<button type="button" data-minutes="${minutes}" aria-pressed="false">${label}</button>`).join('');
        (duration.closest('.form-group') || duration.parentElement)?.append(chips);
        const sync = () => {
            const value = Number(duration.value);
            $$('[data-minutes]', chips).forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.minutes) === value)));
        };
        chips.addEventListener('click', event => {
            const button = event.target.closest('[data-minutes]');
            if (!button) return;
            duration.value = button.dataset.minutes;
            duration.dispatchEvent(new Event('input', { bubbles: true }));
            sync();
        });
        duration.addEventListener('input', sync);
        /* openEditTaskModal sets the value right before the modal opens. */
        new MutationObserver(sync).observe(modal, { attributes: true, attributeFilter: ['class'] });
        sync();
    }

    function sheetifyCompletionDialog() {
        document.getElementById('sf-completion')?.classList.add('m-sheet-dialog');
    }
    new MutationObserver(records => {
        for (const record of records) for (const node of record.addedNodes) {
            if (node.nodeType === 1 && (node.id === 'sf-completion' || node.querySelector?.('#sf-completion'))) sheetifyCompletionDialog();
        }
    }).observe(document.body, { childList: true });

    /* --------------------------------------------------- viewport changes */
    function cleanupMobileArtifacts() {
        document.querySelector('.m-day-strip')?.remove();
        $$('.schedule-day-card.m-day-hidden').forEach(card => card.classList.remove('m-day-hidden'));
        $$('.m-day-add, .m-day-progress, .m-empty-cta, .m-more').forEach(node => node.remove());
        $$('.day-empty').forEach(empty => {
            if (empty.querySelector('strong')) empty.textContent = 'هنوز تسکی برای این روز ثبت نشده است.';
        });
        document.getElementById('manual-report-list')?.classList.remove('m-trimmed');
        document.querySelector('.manual-report-card')?.classList.remove('m-collapsed');
    }
    mq.addEventListener('change', () => {
        syncViewport();
        if (mq.matches) { queueEnhance(); queueReports(); setupReportCard(); }
        else cleanupMobileArtifacts();
    });

    /* ---------------------------------------------------------------- init */
    syncMotion();
    syncViewport();
    syncBodyView();
    setupTaskSheet();
    setupReportCard();
    sheetifyCompletionDialog();
    watchScheduleList();
    queueEnhance();
    queueReports();
    /* Settings settle after login/boot; re-mirror the motion choice then. */
    document.addEventListener('DOMContentLoaded', () => setTimeout(syncMotion, 0));
})();
