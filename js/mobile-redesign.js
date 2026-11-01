/**
 * Mobile redesign behaviour layer (Statistics, Study Plan, Profile).
 *
 * Purely presentational: it never reads or writes application data. Every action it
 * exposes calls an existing public method (Schedule.openEditTaskModal, Auth.logout, …).
 * It enhances DOM that the existing modules render, and re-applies itself whenever they re-render.
 */
(function () {
    'use strict';

    const phone = window.matchMedia('(max-width: 720px)');
    const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const reduced = () => reduceQuery.matches || document.documentElement.dataset.motion === 'off';
    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
    const pd = value => (window.Utils?.toPersianDigits ? Utils.toPersianDigits(value) : String(value));
    const raf = window.requestAnimationFrame.bind(window);

    const dayShort = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
    const dayLong = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
    const todayIndex = () => (new Date().getDay() + 1) % 7;

    /* ------------------------------------------------------------------ */
    /* Study plan: day strip, per-day summary, swipe, completion feedback   */
    /* ------------------------------------------------------------------ */
    const plan = { selected: todayIndex(), done: null, busy: false, direction: 0 };

    function planRoot() { return document.getElementById('schedule-days-list'); }
    function weekMode() { return planRoot()?.classList.contains('sf-week-grid') === true; }

    function ensureStrip() {
        let strip = document.getElementById('m-day-strip');
        if (strip) return strip;
        const area = document.getElementById('schedule-printable-area');
        if (!area) return null;
        strip = document.createElement('div');
        strip.id = 'm-day-strip';
        strip.className = 'm-day-strip';
        strip.setAttribute('role', 'tablist');
        strip.setAttribute('aria-label', 'روزهای هفته');
        strip.addEventListener('click', event => {
            const chip = event.target.closest('[data-day]');
            if (chip) selectDay(Number(chip.dataset.day));
        });
        strip.addEventListener('keydown', event => {
            const step = event.key === 'ArrowLeft' ? 1 : event.key === 'ArrowRight' ? -1 : 0;
            if (!step) return;
            event.preventDefault();
            selectDay(Math.min(6, Math.max(0, plan.selected + step)), true);
        });
        area.before(strip);
        bindSwipe(area);
        return strip;
    }

    function bindSwipe(area) {
        let startX = 0, startY = 0, tracking = false;
        area.addEventListener('touchstart', event => {
            if (weekMode() || !phone.matches || event.touches.length !== 1) return;
            startX = event.touches[0].clientX; startY = event.touches[0].clientY; tracking = true;
        }, { passive: true });
        area.addEventListener('touchend', event => {
            if (!tracking) return;
            tracking = false;
            const touch = event.changedTouches[0], dx = touch.clientX - startX, dy = touch.clientY - startY;
            if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
            // RTL: swiping to the right reveals the previous day, to the left the next one.
            const next = plan.selected + (dx < 0 ? 1 : -1);
            if (next >= 0 && next <= 6) selectDay(next, true);
        }, { passive: true });
    }

    function selectDay(index, focusChip) {
        if (index === plan.selected) return;
        plan.direction = index > plan.selected ? 1 : -1;
        plan.selected = index;
        applyPlan(true);
        if (focusChip) $(`#m-day-strip [data-day="${index}"]`)?.focus({ preventScroll: true });
    }

    function summarize(card) {
        const tasks = $$('.day-task', card);
        const done = tasks.filter(task => task.dataset.status === 'completed').length;
        const minutes = Number(card.dataset.minutes) || tasks.reduce((sum, task) => sum + (Number(task.dataset.minutes) || 0), 0);
        const doneMinutes = tasks.filter(task => task.dataset.status === 'completed').reduce((sum, task) => sum + (Number(task.dataset.minutes) || 0), 0);
        return { total: tasks.length, done, minutes, doneMinutes };
    }

    function decorateCard(card, index) {
        const header = $(':scope > header', card);
        if (!header) return;
        const stats = summarize(card);
        const percent = stats.total ? Math.round(stats.done / stats.total * 100) : 0;

        if (!$('.m-day-add', header)) {
            const add = document.createElement('button');
            add.type = 'button';
            add.className = 'm-day-add';
            add.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">add</span>';
            add.setAttribute('aria-label', `افزودن تسک برای ${dayLong[index]}`);
            add.addEventListener('click', () => window.Schedule?.openEditTaskModal(index, -1));
            header.append(add);
        }
        let progress = $(':scope > .m-day-progress', card);
        if (!progress) {
            progress = document.createElement('div');
            progress.className = 'm-day-progress';
            progress.setAttribute('role', 'progressbar');
            progress.setAttribute('aria-valuemin', '0');
            progress.setAttribute('aria-valuemax', '100');
            progress.innerHTML = '<i></i><span></span>';
            header.after(progress);
        }
        progress.setAttribute('aria-valuenow', String(percent));
        progress.setAttribute('aria-label', `پیشرفت ${dayLong[index]}`);
        progress.firstElementChild.style.width = `${percent}%`;
        progress.lastElementChild.textContent = stats.total ? `${pd(stats.done)} از ${pd(stats.total)} انجام شد` : '';
        progress.hidden = !stats.total;

        card.classList.toggle('is-today', index === todayIndex());
        card.classList.toggle('is-complete', stats.total > 0 && stats.done === stats.total);

        const empty = $('.day-empty', card);
        if (empty && !$('button', empty)) {
            empty.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">event_available</span><strong>این روز خالی است.</strong>';
            const cta = document.createElement('button');
            cta.type = 'button';
            cta.className = 'm-empty-cta';
            cta.textContent = 'افزودن اولین تسک';
            cta.addEventListener('click', () => window.Schedule?.openEditTaskModal(index, -1));
            empty.append(cta);
        }

        // Pending is the default state, so only deviations earn a chip (progressive disclosure).
        $$('.day-task', card).forEach(task => {
            const note = $('.day-task-copy small', task);
            if (note) note.classList.toggle('is-blank', note.textContent.trim() === 'بدون توضیح تکمیلی');
            task.classList.toggle('is-missed', task.dataset.status === 'missed');
            task.classList.toggle('is-partial', task.dataset.status === 'partial');
        });
    }

    function paintStrip(cards) {
        const strip = ensureStrip();
        if (!strip) return;
        if (strip.children.length !== 7) {
            strip.innerHTML = dayShort.map((label, index) => `<button type="button" role="tab" data-day="${index}"><small>${label}</small><strong></strong><i class="m-chip-meter"><b></b></i></button>`).join('');
        }
        $$('[data-day]', strip).forEach((chip, index) => {
            const card = cards[index];
            const stats = card ? summarize(card) : { total: 0, done: 0 };
            const selected = index === plan.selected && !weekMode();
            chip.classList.toggle('is-selected', selected);
            chip.classList.toggle('is-today', index === todayIndex());
            chip.classList.toggle('is-empty', !stats.total);
            chip.setAttribute('aria-selected', String(selected));
            chip.tabIndex = index === plan.selected ? 0 : -1;
            chip.setAttribute('aria-label', `${dayLong[index]}${index === todayIndex() ? ' (امروز)' : ''}، ${stats.total ? `${stats.total} تسک` : 'بدون تسک'}`);
            $('strong', chip).textContent = pd(stats.total);
            $('b', chip).style.width = stats.total ? `${Math.round(stats.done / stats.total * 100)}%` : '0%';
        });
        strip.hidden = weekMode();
        if (!weekMode()) $(`[data-day="${plan.selected}"]`, strip)?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
    }

    function celebrate(cards) {
        const now = new Set();
        cards.forEach((card, index) => $$('.day-task', card).forEach((task, taskIndex) => {
            if (task.dataset.status === 'completed') now.add(`${index}:${taskIndex}:${$('.day-task-copy strong', task)?.textContent || ''}`);
        }));
        if (plan.done && !reduced()) {
            cards.forEach((card, index) => $$('.day-task', card).forEach((task, taskIndex) => {
                const key = `${index}:${taskIndex}:${$('.day-task-copy strong', task)?.textContent || ''}`;
                if (now.has(key) && !plan.done.has(key)) { task.classList.add('m-just-done'); setTimeout(() => task.classList.remove('m-just-done'), 900); }
            }));
        }
        plan.done = now;
    }

    function applyPlan(animate) {
        const root = planRoot();
        if (!root || !phone.matches) return;
        const cards = $$(':scope > .schedule-day-card', root);
        if (!cards.length) return;
        cards.forEach((card, index) => {
            decorateCard(card, index);
            const hidden = !weekMode() && index !== plan.selected;
            card.classList.toggle('m-day-hidden', hidden);
            if (!hidden && animate && !reduced() && !weekMode()) {
                card.classList.remove('m-slide-next', 'm-slide-prev');
                void card.offsetWidth;
                card.classList.add(plan.direction >= 0 ? 'm-slide-next' : 'm-slide-prev');
            }
        });
        paintStrip(cards);
        celebrate(cards);
    }

    let planFrame = 0;
    function schedulePlan() { cancelAnimationFrame(planFrame); planFrame = raf(() => applyPlan(false)); }

    function observePlan() {
        const root = planRoot();
        if (!root || root.dataset.mObserved) return;
        root.dataset.mObserved = 'true';
        new MutationObserver(schedulePlan).observe(root, { childList: true, attributes: true, attributeFilter: ['class'] });
        schedulePlan();
    }

    /* ------------------------------------------------------------------ */
    /* Study report: folded by default on phones, trimmed recent list       */
    /* ------------------------------------------------------------------ */
    function expandReport(open) {
        const card = $('.manual-report-card');
        if (!card) return;
        card.classList.toggle('m-collapsed', !open);
        $('.manual-report-heading', card)?.setAttribute('aria-expanded', String(open));
        if (open) raf(() => card.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }));
    }

    function enhanceReport() {
        const card = $('.manual-report-card');
        if (!card) return;
        const heading = $('.manual-report-heading', card);
        if (heading && !heading.dataset.mBound) {
            heading.dataset.mBound = 'true';
            heading.setAttribute('role', 'button');
            heading.tabIndex = 0;
            heading.insertAdjacentHTML('beforeend', '<i class="m-chevron" aria-hidden="true"></i>');
            const flip = () => { const open = card.classList.contains('m-collapsed'); card.classList.toggle('m-collapsed', !open); heading.setAttribute('aria-expanded', String(open)); };
            heading.addEventListener('click', flip);
            heading.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); flip(); } });
            if (phone.matches) { card.classList.add('m-collapsed'); heading.setAttribute('aria-expanded', 'false'); }
            else heading.setAttribute('aria-expanded', 'true');
        }
        const list = $('#manual-report-list', card);
        if (list && !list.dataset.mObserved) {
            list.dataset.mObserved = 'true';
            const sync = () => {
                const items = $$(':scope > .sf-report, :scope > .manual-report-item', list);
                let more = $(':scope ~ .m-more', card);
                if (items.length <= 3) { more?.remove(); list.classList.remove('m-trimmed'); return; }
                if (!more) {
                    more = document.createElement('button');
                    more.type = 'button';
                    more.className = 'm-more';
                    more.addEventListener('click', () => { list.classList.toggle('m-trimmed'); more.textContent = list.classList.contains('m-trimmed') ? `نمایش همه (${pd(items.length)})` : 'نمایش کمتر'; });
                    list.after(more);
                    list.classList.add('m-trimmed');
                }
                more.textContent = list.classList.contains('m-trimmed') ? `نمایش همه (${pd(items.length)})` : 'نمایش کمتر';
            };
            new MutationObserver(sync).observe(list, { childList: true });
            sync();
        }
    }

    /* ------------------------------------------------------------------ */
    /* Statistics chart: tap a bar to read its exact value                  */
    /* ------------------------------------------------------------------ */
    function bindChartReadout() {
        document.addEventListener('click', event => {
            const bar = event.target.closest('.sw-trend-day');
            if (!bar) return;
            const readout = document.getElementById('sw-readout');
            if (!readout) return;
            const active = bar.classList.contains('is-active');
            $$('.sw-trend-day.is-active').forEach(item => item.classList.remove('is-active'));
            const strong = $('strong', readout), label = $('span', readout);
            if (active) { strong.textContent = readout.dataset.defaultTime; label.textContent = readout.dataset.defaultLabel; return; }
            bar.classList.add('is-active');
            strong.textContent = bar.dataset.time;
            label.textContent = bar.dataset.label;
        });
    }

    /* ------------------------------------------------------------------ */
    /* Bottom sheets: task editor, delete confirmation                      */
    /* ------------------------------------------------------------------ */
    const sheets = ['modal-edit-schedule-slot', 'modal-delete-account'];

    function enhanceTaskSheet(modal) {
        const input = $('#input-task-duration', modal);
        if (!input || $('.m-chips', modal)) return;
        const presets = [30, 45, 60, 90, 120];
        const chips = document.createElement('div');
        chips.className = 'm-chips';
        chips.setAttribute('role', 'group');
        chips.setAttribute('aria-label', 'مدت پیشنهادی');
        chips.innerHTML = presets.map(value => `<button type="button" data-minutes="${value}">${pd(value)}</button>`).join('');
        const sync = () => $$('button', chips).forEach(chip => chip.setAttribute('aria-pressed', String(Number(chip.dataset.minutes) === Number(input.value))));
        chips.addEventListener('click', event => { const chip = event.target.closest('[data-minutes]'); if (chip) { input.value = chip.dataset.minutes; sync(); } });
        input.addEventListener('input', sync);
        input.after(chips);
        modal.addEventListener('transitionend', sync);
        new MutationObserver(sync).observe(modal, { attributes: true, attributeFilter: ['class'] });
        sync();
    }

    function bindSheets() {
        sheets.forEach(id => {
            const modal = document.getElementById(id);
            if (!modal || modal.dataset.mSheet) return;
            modal.dataset.mSheet = 'true';
            modal.classList.add('m-sheet');
            modal.addEventListener('click', event => { if (event.target === modal && phone.matches) window.Utils?.closeModal(id); });
            if (id === 'modal-edit-schedule-slot') enhanceTaskSheet(modal);
        });
        const dialog = document.getElementById('sf-completion');
        if (dialog && !dialog.dataset.mSheet) { dialog.dataset.mSheet = 'true'; dialog.classList.add('m-sheet-dialog'); }
    }

    /* ------------------------------------------------------------------ */
    /* Keyboard & viewport: keep inputs and the save bar visible            */
    /* ------------------------------------------------------------------ */
    function trackViewport() {
        const viewport = window.visualViewport;
        if (!viewport) return;
        const update = () => {
            const inset = Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
            const root = document.documentElement;
            root.style.setProperty('--m-vvh', `${Math.round(viewport.height)}px`);
            root.style.setProperty('--m-kb', `${inset}px`);
            root.classList.toggle('m-kb-open', inset > 120);
        };
        viewport.addEventListener('resize', update);
        viewport.addEventListener('scroll', update);
        update();
    }

    function bindFocusScroll() {
        document.addEventListener('focusin', event => {
            const field = event.target;
            if (!phone.matches || !field.matches?.('input, select, textarea')) return;
            if (!field.closest('#view-profile, #view-stats, #view-schedule, .m-sheet, .m-sheet-dialog')) return;
            setTimeout(() => field.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }), 280);
        });
    }

    /* ------------------------------------------------------------------ */
    /* Page entrance (only when navigating, never on in-page re-renders)    */
    /* ------------------------------------------------------------------ */
    let kickFrame = 0;
    function kick() { cancelAnimationFrame(kickFrame); kickFrame = raf(() => { observePlan(); enhanceReport(); bindSheets(); }); }

    function watchPages() {
        const pages = ['view-stats', 'view-schedule', 'view-profile'];
        const seen = new Map();
        const observer = new MutationObserver(() => {
            pages.forEach(id => {
                const view = document.getElementById(id);
                if (!view) return;
                const active = view.classList.contains('active');
                if (active && !seen.get(id) && !reduced()) {
                    view.classList.add('m-enter');
                    setTimeout(() => view.classList.remove('m-enter'), 520);
                }
                seen.set(id, active);
                if (active) kick();
            });
        });
        const content = $('.content-body');
        if (content) observer.observe(content, { subtree: true, attributes: true, attributeFilter: ['class'] });
    }

    /* ------------------------------------------------------------------ */
    function init() {
        document.documentElement.classList.add('m-redesign');
        bindChartReadout();
        bindFocusScroll();
        trackViewport();
        watchPages();
        bindSheets();
        enhanceReport();
        observePlan();
        // Opening the report from elsewhere must reveal its form.
        if (window.WebStudio && typeof WebStudio.report === 'function' && !WebStudio.report.mPatched) {
            const original = WebStudio.report;
            WebStudio.report = function () { const result = original.apply(this, arguments); setTimeout(() => expandReport(true), 60); return result; };
            WebStudio.report.mPatched = true;
        }
        phone.addEventListener?.('change', () => { schedulePlan(); });
        // Views render after login/navigation, so keep looking until the DOM we enhance exists.
        const content = $('.content-body');
        if (content) new MutationObserver(kick).observe(content, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
