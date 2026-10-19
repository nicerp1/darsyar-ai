/**
 * StudyMate Pro - Statistics, Analytics & Exam Percentage Calculator
 */

const Stats = (function () {
    let lineChartInstance = null;
    let barChartInstance = null;
    const localDate = date => { const value = date || new Date(), offset = value.getTimezoneOffset(); return new Date(value.getTime() - offset * 60000).toISOString().slice(0, 10); };

    function realStudyData() {
        const byDate = new Map();
        (Storage.get('study_history', []) || []).forEach(item => { if (item?.date) byDate.set(item.date, (byDate.get(item.date) || 0) + Number(item.hours || 0)); });
        (Storage.get('manual_reports', []) || []).filter(item => item?.date && item.status !== 'missed').forEach(item => byDate.set(item.date, (byDate.get(item.date) || 0) + Number(item.minutes || 0) / 60));
        return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, hours]) => ({ date, hours }));
    }

    function calculateStreak(rows) {
        const active = new Set(rows.filter(item => item.hours > 0).map(item => item.date));
        let cursor = new Date(), streak = 0;
        if (!active.has(localDate(cursor))) cursor.setDate(cursor.getDate() - 1);
        while (active.has(localDate(cursor))) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
        return streak;
    }

    let range = 7;
    const pd = v => (typeof Utils !== 'undefined' ? Utils.toPersianDigits(v) : v);
    const cssVar = (name, fallback) => (getComputedStyle(document.documentElement).getPropertyValue(name) || '').trim() || fallback;

    function init() {
        const rangeBox = document.getElementById('stats-range');
        if (rangeBox && !rangeBox.dataset.bound) {
            rangeBox.dataset.bound = 'true';
            rangeBox.addEventListener('click', event => {
                const button = event.target.closest('[data-range]');
                if (button) setRange(Number(button.dataset.range));
            });
            new MutationObserver(() => { if (document.getElementById('view-stats')?.classList.contains('active')) renderCharts(); })
                .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        }
        renderStatsKPIs();
        renderCharts();
    }

    function setRange(value) {
        range = [7, 30, 0].includes(value) ? value : 7;
        document.querySelectorAll('#stats-range [data-range]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.range) === range)));
        renderCharts();
    }

    function renderStatsKPIs() {
        const history = realStudyData(), today = localDate(new Date()), cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 6); const weekStart = localDate(cutoff);
        const todayHours = history.find(item => item.date === today)?.hours || 0;
        const weekHours = history.filter(item => item.date >= weekStart && item.date <= today).reduce((sum, item) => sum + item.hours, 0);
        const totalHours = history.reduce((sum, item) => sum + item.hours, 0);
        const streak = calculateStreak(history);

        const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
        set('stats-kpi-today', `${pd(todayHours.toFixed(1))} س`);
        set('stats-kpi-week', `${pd(weekHours.toFixed(1))} س`);
        set('stats-kpi-total', `${pd(totalHours.toFixed(0))} س`);
        set('stats-kpi-streak', `${pd(streak)} روز`);
    }

    function visibleRows(history) {
        if (!range) return history;
        const today = new Date(), byDate = new Map(history.map(item => [item.date, item.hours]));
        return Array.from({ length: range }, (_, index) => { const day = new Date(today); day.setDate(day.getDate() - range + 1 + index); const date = localDate(day); return { date, hours: byDate.get(date) || 0 }; });
    }

    function toggle(id, show) { document.getElementById(id)?.classList.toggle('hidden', !show); }

    function renderCharts() {
        const errorBox = document.getElementById('stats-error');
        if (typeof Chart === 'undefined') {
            toggle('stats-error', true);
            ['stats-line-wrap', 'stats-bar-wrap'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
            return;
        }
        toggle('stats-error', false);
        try {
            renderLine();
            renderBars();
        } catch (error) {
            console.error('Stats chart failed', error);
            toggle('stats-error', true);
        }
    }

    function chartBase() {
        const muted = cssVar('--m-muted', '#94a3b8'), line = cssVar('--m-line', 'rgba(148,163,184,.18)');
        Chart.defaults.font.family = "Kalameh, Vazirmatn, Tahoma, sans-serif";
        Chart.defaults.font.size = 11;
        Chart.defaults.color = muted;
        return {
            muted, line,
            tooltip: { rtl: true, textDirection: 'rtl', displayColors: false, padding: 10, cornerRadius: 10, titleFont: { size: 12 }, bodyFont: { size: 12 }, bodyAlign: 'right', titleAlign: 'right' }
        };
    }

    function renderLine() {
        const canvas = document.getElementById('chart-stats-line');
        if (!canvas) return;
        if (lineChartInstance) { lineChartInstance.destroy(); lineChartInstance = null; }
        const rows = visibleRows(realStudyData()), hasData = rows.some(item => item.hours > 0);
        document.getElementById('stats-line-wrap')?.classList.remove('hidden', 'm-skel');
        document.getElementById('stats-line-wrap')?.classList.toggle('hidden', !hasData);
        toggle('stats-line-empty', !hasData);
        if (!hasData) return;
        const base = chartBase(), color = cssVar('--m-chart', '#4f8cff');
        const labels = rows.map(item => pd(item.date.substring(5)));
        lineChartInstance = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: { labels, datasets: [{ label: 'ساعات مطالعه', data: rows.map(item => item.hours), borderColor: color, backgroundColor: color + '22', fill: true, tension: 0.32, borderWidth: 2, pointRadius: rows.length > 14 ? 0 : 3, pointHoverRadius: 5, pointHitRadius: 18, pointBackgroundColor: color, pointBorderColor: 'transparent' }] },
            options: {
                responsive: true, maintainAspectRatio: false, animation: { duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450 },
                interaction: { mode: 'index', intersect: false },
                layout: { padding: { top: 6, left: 2, right: 2 } },
                plugins: { legend: { display: false }, tooltip: { ...base.tooltip, callbacks: { label: ctx => `${pd(Number(ctx.parsed.y).toFixed(1))} ساعت` } } },
                scales: {
                    x: { reverse: true, grid: { display: false }, border: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 5, padding: 6 } },
                    y: { position: 'right', beginAtZero: true, border: { display: false }, grid: { color: base.line }, ticks: { maxTicksLimit: 4, padding: 6, callback: v => pd(v) } }
                }
            }
        });
    }

    function renderBars() {
        const canvas = document.getElementById('chart-stats-bar');
        if (!canvas) return;
        if (barChartInstance) { barChartInstance.destroy(); barChartInstance = null; }
        const subjects = new Map();
        (Storage.get('manual_reports', []) || []).filter(item => item?.subject && item.status !== 'missed').forEach(item => subjects.set(item.subject.trim(), (subjects.get(item.subject.trim()) || 0) + Number(item.minutes || 0) / 60));
        const subjectRows = [...subjects.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
        const wrap = document.getElementById('stats-bar-wrap');
        wrap?.classList.remove('m-skel');
        wrap?.classList.toggle('hidden', !subjectRows.length);
        toggle('stats-bar-empty', !subjectRows.length);
        if (!subjectRows.length) return;
        if (wrap) wrap.style.height = `${Math.max(130, subjectRows.length * 36 + 30)}px`;
        const base = chartBase(), color = cssVar('--m-chart', '#4f8cff');
        barChartInstance = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: { labels: subjectRows.map(item => item[0]), datasets: [{ label: 'ساعات مطالعه', data: subjectRows.map(item => Number(item[1].toFixed(2))), backgroundColor: subjectRows.map((_, index) => color + Math.round(255 * Math.max(.4, 1 - index * .1)).toString(16).padStart(2, '0')), borderRadius: 6, borderSkipped: false, barThickness: 16 }] },
            options: {
                indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: { duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450 },
                plugins: { legend: { display: false }, tooltip: { ...base.tooltip, callbacks: { label: ctx => `${pd(Number(ctx.parsed.x).toFixed(1))} ساعت` } } },
                scales: {
                    x: { reverse: true, beginAtZero: true, border: { display: false }, grid: { color: base.line }, ticks: { maxTicksLimit: 4, callback: v => pd(v) } },
                    y: { position: 'right', grid: { display: false }, border: { display: false }, ticks: { padding: 6, callback(value) { const label = String(this.getLabelForValue(value)); return label.length > 14 ? label.slice(0, 13) + '…' : label; } } }
                }
            }
        });
    }

    function exportPDFReport() {
        if (window.WebStudio?.enabled() && window.StudyWorkspace) return StudyWorkspace.printStats();
        if (typeof Utils !== 'undefined') {
            Utils.printElement('stats-report-printable-area', 'کارنامه و گزارش تحلیلی درسیار');
        }
    }

    return {
        init,
        setRange,
        exportPDFReport
    };
})();

if (typeof window !== 'undefined') {
    window.Stats = Stats;
}
