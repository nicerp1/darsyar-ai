/**
 * Statistics page UI (phone + desktop; CSS decides the layout).
 * Presentation layer: reads Stats.getData() (study_history + manual_reports) and Schedule.getState() (plan adherence).
 * Charts are plain DOM/SVG so they follow the theme tokens and animate without extra libraries.
 */
(function () {
    'use strict';
    const pd = v => (window.Utils?.toPersianDigits ? Utils.toPersianDigits(v) : String(v));
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const ico = n => `<span class="material-symbols-outlined" aria-hidden="true">${n}</span>`;
    const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off';
    const DAY_S = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'], DAY_L = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
    const PALETTE = ['var(--m-accent)', '#2fb386', '#f0a63a', '#e5607a', '#4aa3df', '#9b8cf0', '#8a93a6'];
    const isoOf = d => { const o = d.getTimezoneOffset(); return new Date(d.getTime() - o * 60000).toISOString().slice(0, 10); };
    const dayAt = off => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; };
    const wd = d => (d.getDay() + 1) % 7;                                   // Saturday = 0
    const fa = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric', month: 'long' });
    const faD = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric' });
    const num = (h, d = 1) => pd(Number(h).toFixed(d)).replace(/[./]/g, '٫');
    const hrs = h => h < 1 ? `${pd(Math.round(h * 60))} دقیقه` : `${num(h)} ساعت`;

    let root, range = 7, model = null, first = true, picked = null;
    const $ = (s, r = root) => r.querySelector(s);

    function mount() {
        if (root?.isConnected) return true;             // the web build re-renders #view-stats, so the root can be replaced
        root = null;
        const anchor = document.getElementById('stats-report-printable-area');
        if (!anchor) return false;
        root = document.createElement('div'); root.id = 'stx'; root.className = 'stx';
        root.innerHTML = `
        <header class="stx-head">
            <div class="stx-title"><h2>آمار و گزارش‌ها</h2><p>روند مطالعه و عملکرد تحصیلی تو</p></div>
            <div class="stx-tools">
                <button type="button" class="stx-icon" data-act="pdf" aria-label="دانلود گزارش جامع">${ico('download')}</button>
                <button type="button" class="stx-icon is-primary" data-act="report" aria-label="ثبت گزارش مطالعه">${ico('edit_note')}</button>
            </div>
        </header>
        <div class="stx-seg" role="group" aria-label="بازه زمانی" data-i="0">
            <i class="stx-thumb" aria-hidden="true"></i>
            <button type="button" data-range="7" aria-pressed="true">۷ روز</button>
            <button type="button" data-range="30" aria-pressed="false">۳۰ روز</button>
            <button type="button" data-range="0" aria-pressed="false">همه</button>
        </div>
        <div class="stx-grid">
            <section class="stx-card stx-hero" id="stx-hero" aria-live="polite"></section>
            <div class="stx-kpis" id="stx-kpis"></div>
            <section class="stx-card stx-trend"><header><h3>روند مطالعه روزانه</h3><span class="stx-note" id="stx-trend-note"></span></header><div id="stx-trend"></div></section>
            <section class="stx-card stx-subjects"><header><h3>تفکیک بر اساس تسک‌ها</h3><span class="stx-note" id="stx-subj-note"></span></header><div id="stx-subjects"></div></section>
            <section class="stx-card stx-plan"><header><h3>پایبندی به برنامه</h3><span class="stx-note">این هفته</span></header><div id="stx-plan"></div></section>
            <section class="stx-card stx-heat"><header><h3>ثبات مطالعه</h3><span class="stx-note" id="stx-heat-note"></span></header><div id="stx-heat"></div></section>
            <section class="stx-card stx-insights"><header><h3>نکته‌های هفته</h3></header><ul id="stx-insights"></ul></section>
        </div>`;
        anchor.before(root);
        root.addEventListener('click', onClick);
        return true;
    }

    /* ---------- data model ---------- */
    function compute() {
        const src = Stats.getData(), byDate = new Map(src.history.map(r => [r.date, r.hours]));
        const hoursOn = d => byDate.get(isoOf(d)) || 0;
        const todayH = hoursOn(dayAt(0));
        const weekH = Array.from({ length: 7 }, (_, i) => hoursOn(dayAt(-i))).reduce((a, b) => a + b, 0);
        const totalH = src.history.reduce((a, r) => a + r.hours, 0);
        // visible rows
        let rows, unit = 'day', span;
        if (range) rows = Array.from({ length: range }, (_, i) => { const d = dayAt(i - range + 1); return { d, h: hoursOn(d) }; });
        else {
            const firstDate = src.history.length ? new Date(src.history[0].date + 'T12:00:00') : dayAt(0);
            span = Math.max(1, Math.round((dayAt(0) - firstDate) / 864e5) + 1);
            if (span <= 45) rows = Array.from({ length: span }, (_, i) => { const d = dayAt(i - span + 1); return { d, h: hoursOn(d) }; });
            else {
                unit = 'week'; const weeks = Math.min(16, Math.ceil(span / 7));
                rows = Array.from({ length: weeks }, (_, w) => { const end = dayAt(-(weeks - 1 - w) * 7), sum = Array.from({ length: 7 }, (_, i) => { const d = new Date(end); d.setDate(d.getDate() - i); return hoursOn(d); }).reduce((a, b) => a + b, 0); return { d: end, h: sum }; });
            }
        }
        const total = rows.reduce((a, r) => a + r.h, 0);
        const days = range || (unit === 'week' ? rows.length * 7 : rows.length);
        let prev = null;
        if (range) prev = Array.from({ length: range }, (_, i) => hoursOn(dayAt(i - range * 2 + 1))).reduce((a, b) => a + b, 0);
        const best = rows.reduce((m, r) => (r.h > (m?.h || 0) ? r : m), null);
        const startIso = range ? isoOf(dayAt(1 - range)) : '0000-00-00';
        // breakdown by task name: timer sessions (focus_records) + manual reports, both carry the task's name
        const subj = new Map(), add = (name, h) => { const k = String(name || '').trim() || 'تمرکز آزاد'; subj.set(k, (subj.get(k) || 0) + h); };
        src.reports.filter(r => r.status !== 'missed' && r.date >= startIso).forEach(r => add(r.subject, Number(r.minutes || 0) / 60));
        (src.focus || []).filter(r => isoOf(new Date(r.endedAt)) >= startIso).forEach(r => add(r.subject, Number(r.seconds) / 3600));
        const subjects = [...subj.entries()].sort((a, b) => b[1] - a[1]);
        const wdTotals = Array(7).fill(0), wdCount = Array(7).fill(0);
        src.history.forEach(r => { const k = wd(new Date(r.date + 'T12:00:00')); wdTotals[k] += r.hours; wdCount[k]++; });
        const bestWd = wdTotals.reduce((m, v, i) => (v / (wdCount[i] || 1) > (wdTotals[m] / (wdCount[m] || 1)) ? i : m), 0);
        const goal = Number(window.Storage?.getSettings?.().dailyGoalHours) || 0;
        return { goal, src, byDate, rows, unit, total, days, prev, best, subjects, todayH, weekH, totalH, streak: src.streak, bestWd, hasWd: wdCount[bestWd] > 0, activeDays: rows.filter(r => r.h > 0).length };
    }

    /* ---------- painters ---------- */
    function paint() {
        if (!root || !window.Stats?.getData) return;
        model = compute();
        const m = model, label = range === 7 ? '۷ روز اخیر' : range === 30 ? '۳۰ روز اخیر' : 'از ابتدا';
        const empty = m.totalH === 0 && !m.subjects.length;
        root.classList.toggle('is-empty', empty);
        root.querySelectorAll('.stx-seg [data-range]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.range) === range)));
        $('.stx-seg').dataset.i = String([7, 30, 0].indexOf(range));

        // hero
        let delta = '';
        if (m.prev != null && m.prev > 0) {
            const p = Math.round((m.total - m.prev) / m.prev * 100);
            delta = `<span class="stx-delta ${p >= 0 ? 'up' : 'down'}">${ico(p >= 0 ? 'trending_up' : 'trending_down')}${pd(Math.abs(p))}٪ ${p >= 0 ? 'بیشتر' : 'کمتر'} از ${range === 7 ? 'هفته\u200cی' : 'دوره\u200cی'} قبل</span>`;
        } else if (m.prev === 0 && m.total > 0) delta = `<span class="stx-delta up">${ico('rocket_launch')}شروع خوبی بود</span>`;
        $('#stx-hero').innerHTML = `
            <div class="stx-hero-main">
                <small>مجموع مطالعه · ${label}</small>
                <div class="stx-big"><b id="stx-count" data-v="${m.total}">${num(m.total)}</b><span>ساعت</span></div>
                ${delta}
                ${m.goal ? `<div class="stx-goal" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, Math.round(m.todayH / m.goal * 100))}"><i style="--g:${Math.min(100, m.todayH / m.goal * 100).toFixed(1)}%"></i><small>امروز ${pd(Math.min(100, Math.round(m.todayH / m.goal * 100)))}٪ از هدف ${pd(m.goal)} ساعته</small></div>` : ''}
            </div>
            <svg class="stx-spark" viewBox="0 0 120 44" preserveAspectRatio="none" aria-hidden="true">${spark(m.rows)}</svg>
            <dl class="stx-mini">
                <div><dt>میانگین روزانه</dt><dd>${hrs(m.total / (m.days || 1))}</dd></div>
                <div><dt>بهترین ${m.unit === 'week' ? 'هفته' : 'روز'}</dt><dd>${m.best && m.best.h > 0 ? (m.unit === 'week' ? hrs(m.best.h) : `${DAY_L[wd(m.best.d)]}<small>${hrs(m.best.h)}</small>`) : '—'}</dd></div>
                <div><dt>روز فعال</dt><dd>${m.unit === 'week' ? '—' : `${pd(m.activeDays)} از ${pd(m.rows.length)}`}</dd></div>
            </dl>`;
        countUp($('#stx-count'), m.total);

        // kpis
        const kp = [['today', 'امروز', hrs(m.todayH)], ['date_range', '۷ روز اخیر', hrs(m.weekH)], ['all_inclusive', 'کل دوران', `${pd(Math.round(m.totalH))} ساعت`], ['local_fire_department', 'استریک', `${pd(m.streak)} روز`, 'warm']];
        $('#stx-kpis').innerHTML = kp.map(([i, l, v, c], k) => `<div class="stx-kpi ${c || ''}" style="--i:${k}"><span class="stx-kpi-ic">${ico(i)}</span><small>${l}</small><strong>${v}</strong></div>`).join('');

        paintTrend(m); paintSubjects(m); paintPlan(); paintHeat(m); paintInsights(m);
        first = false;
    }

    function spark(rows) {
        const max = Math.max(...rows.map(r => r.h), .1), n = rows.length;
        if (n < 2) return '';
        const pts = rows.map((r, i) => [120 - (i / (n - 1)) * 120, 40 - (r.h / max) * 34]);
        const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
        return `<path class="a" d="${line} L0,44 L120,44 Z"/><path class="l" d="${line}" pathLength="100"/>`;
    }

    function countUp(el, to) {
        if (!el) return;
        if (reduced()) { el.textContent = num(to); return; }
        const t0 = performance.now(), dur = 800;
        const step = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = num(to * e); if (k < 1) requestAnimationFrame(step); };
        requestAnimationFrame(step);
    }

    function paintTrend(m) {
        const max = Math.max(...m.rows.map(r => r.h), .5), avg = m.total / (m.rows.length || 1), dense = m.rows.length > 14;
        $('#stx-trend-note').textContent = m.unit === 'week' ? 'جمع هر هفته' : `میانگین ${hrs(avg)}`;
        const bars = m.rows.map((r, i) => {
            const isToday = isoOf(r.d) === isoOf(dayAt(0)), lab = m.unit === 'week' ? pd(faD.format(r.d)) : dense ? (i % 5 === m.rows.length % 5 ? pd(faD.format(r.d)) : '') : DAY_S[wd(r.d)];
            const tip = `${m.unit === 'week' ? 'هفته‌ی منتهی به ' : ''}${fa.format(r.d)}: ${hrs(r.h)}`;
            return `<button type="button" class="stx-bar${isToday ? ' is-today' : ''}${r.h === 0 ? ' is-zero' : ''}${r.h === m.best?.h && r.h > 0 ? ' is-best' : ''}" style="--h:${Math.max(r.h / max * 100, r.h ? 4 : 0)}%;--i:${i}" data-v="${hrs(r.h)}" aria-label="${esc(tip)}"><i></i><span>${lab}</span></button>`;
        }).join('');
        $('#stx-trend').innerHTML = `<div class="stx-chart${dense ? ' is-dense' : ''}"><div class="stx-bars">${m.rows.length > 1 && avg > 0 ? `<div class="stx-avg" style="--a:${(avg / max).toFixed(3)}"><em>میانگین</em></div>` : ''}${bars}</div></div>`;
    }

    function paintSubjects(m) {
        const box = $('#stx-subjects');
        $('#stx-subj-note').textContent = m.subjects.length ? `${pd(m.subjects.length)} تسک` : '';
        if (!m.subjects.length) { box.innerHTML = `<div class="stx-mute">${ico('menu_book')}<p>هنوز زمانی برای تسکی ثبت نشده است.</p></div>`; return; }
        const top = m.subjects.slice(0, 5), rest = m.subjects.slice(5).reduce((a, s) => a + s[1], 0);
        const list = rest > 0 ? [...top, ['سایر', rest]] : top, sum = list.reduce((a, s) => a + s[1], 0);
        let acc = 0;
        const segs = list.map(([n, h], i) => { const p = h / sum * 100, s = `<circle class="seg" cx="32" cy="32" r="26" pathLength="100" stroke="${PALETTE[Math.min(i, 6)]}" stroke-dasharray="${Math.max(p - 1.2, .4).toFixed(2)} 100" stroke-dashoffset="${(-acc).toFixed(2)}" style="--i:${i}"/>`; acc += p; return s; }).join('');
        box.innerHTML = `<div class="stx-subj">
            <div class="stx-donut"><svg viewBox="0 0 64 64" aria-hidden="true"><circle class="trk" cx="32" cy="32" r="26"/>${segs}</svg><div><b>${num(sum)}</b><small>ساعت</small></div></div>
            <ol class="stx-legend">${list.map(([n, h], i) => `<li style="--i:${i};--c:${PALETTE[Math.min(i, 6)]}"><i></i><span>${esc(n)}</span><em>${hrs(h)}</em><b>${pd(Math.round(h / sum * 100))}٪</b></li>`).join('')}</ol></div>`;
    }

    function paintPlan() {
        const box = $('#stx-plan'), st = window.Schedule?.getState?.();
        const tasks = st?.days?.flatMap(d => d.tasks) || [];
        if (!tasks.length) { box.innerHTML = `<div class="stx-mute">${ico('event_note')}<p>برنامه‌ی هفتگی هنوز چیده نشده است.</p><button type="button" class="stx-link" data-act="plan">ساختن برنامه</button></div>`; return; }
        const c = k => tasks.filter(t => t.status === k).length, done = c('completed'), part = c('partial'), miss = c('missed'), pend = tasks.length - done - part - miss;
        const pct = Math.round(done / tasks.length * 100);
        box.innerHTML = `<div class="stx-planbox">
            <div class="stx-ring" style="--p:${pct}"><svg viewBox="0 0 64 64" aria-hidden="true"><circle class="t" cx="32" cy="32" r="27"/><circle class="v" cx="32" cy="32" r="27" pathLength="100" style="stroke-dashoffset:${100 - pct}"/></svg><b>${pd(pct)}٪</b></div>
            <ul class="stx-counts"><li class="ok"><i></i>انجام شده<b>${pd(done)}</b></li><li class="warn"><i></i>بخشی<b>${pd(part)}</b></li><li class="bad"><i></i>انجام نشده<b>${pd(miss)}</b></li><li><i></i>در انتظار<b>${pd(pend)}</b></li></ul></div>`;
    }

    function paintHeat(m) {
        const weeks = matchMedia('(min-width: 721px)').matches ? 14 : 9, today = dayAt(0), endWeekStart = dayAt(-wd(today));
        let max = 0; const cells = [];
        for (let w = 0; w < weeks; w++) for (let r = 0; r < 7; r++) {
            const d = new Date(endWeekStart); d.setDate(d.getDate() - (weeks - 1 - w) * 7 + r);
            const h = d > today ? -1 : (m.byDate.get(isoOf(d)) || 0); if (h > max) max = h; cells.push({ w, r, d, h });
        }
        const active = cells.filter(c => c.h > 0).length;
        $('#stx-heat-note').textContent = `${pd(active)} روز فعال در ${pd(weeks)} هفته`;
        $('#stx-heat').innerHTML = `<div class="stx-heatwrap"><div class="stx-wdl">${DAY_S.map(s => `<span>${s}</span>`).join('')}</div>
            <div class="stx-heatgrid" style="--w:${weeks}">${cells.map((c, i) => `<i class="lv${c.h < 0 ? ' fut' : c.h === 0 ? '0' : Math.min(4, Math.ceil(c.h / (max || 1) * 4))}${isoOf(c.d) === isoOf(today) ? ' now' : ''}" style="grid-column:${c.w + 1};grid-row:${c.r + 1};--i:${i % 30}" title="${esc(fa.format(c.d))}${c.h >= 0 ? ' · ' + hrs(c.h) : ''}"></i>`).join('')}</div></div>
            <div class="stx-scale"><span>کم</span><i class="lv1"></i><i class="lv2"></i><i class="lv3"></i><i class="lv4"></i><span>زیاد</span></div>`;
    }

    function paintInsights(m) {
        const items = [];
        if (m.totalH > 0 && m.hasWd) items.push(['calendar_today', `پربازده‌ترین روز تو معمولاً ${DAY_L[m.bestWd]} است.`]);
        if (m.subjects[0]) items.push(['workspace_premium', `بیشترین زمان را به «${esc(m.subjects[0][0])}» دادی (${hrs(m.subjects[0][1])}).`]);
        if (m.streak > 0) items.push(['local_fire_department', `${pd(m.streak)} روز پیاپی مطالعه کرده‌ای؛ زنجیره را نگه دار!`]);
        if (m.todayH === 0) items.push(['bolt', 'امروز هنوز مطالعه‌ای ثبت نشده؛ حتی ۲۵ دقیقه هم حساب است.']);
        if (!items.length) items.push(['tips_and_updates', 'با ثبت اولین گزارش، تحلیل شخصی تو اینجا نمایش داده می‌شود.']);
        $('#stx-insights').innerHTML = items.slice(0, 4).map(([i, t], k) => `<li style="--i:${k}">${ico(i)}<span>${t}</span></li>`).join('');
    }

    /* ---------- events ---------- */
    function onClick(e) {
        const bar = e.target.closest('.stx-bar');
        if (bar) { root.querySelectorAll('.stx-bar.is-on').forEach(b => b !== bar && b.classList.remove('is-on')); bar.classList.toggle('is-on'); return; }
        const r = e.target.closest('[data-range]');
        if (r) { range = Number(r.dataset.range); return paint(); }
        const a = e.target.closest('[data-act]')?.dataset.act;
        if (a === 'pdf') window.Stats?.exportPDFReport();
        if (a === 'plan') window.App?.navigate('schedule');
        if (a === 'report') {
            const card = document.querySelector('.manual-report-card');
            if (card) { card.classList.remove('m-collapsed'); card.querySelector('.manual-report-heading')?.setAttribute('aria-expanded', 'true'); card.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); card.querySelector('input,select,textarea')?.focus({ preventScroll: true }); }
        }
    }

    function refresh() { if (!mount()) return; document.documentElement.classList.add('stx-on'); paint(); }
    document.addEventListener('stats:rendered', refresh);
    document.addEventListener('click', e => { if (!e.target.closest('.stx-bar')) root?.querySelectorAll('.stx-bar.is-on').forEach(b => b.classList.remove('is-on')); });
})();
