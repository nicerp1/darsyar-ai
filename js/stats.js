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

    function init() {
        renderStatsKPIs();
        renderCharts();
    }

    function renderStatsKPIs() {
        const history = realStudyData(), today = localDate(new Date()), cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 6); const weekStart = localDate(cutoff);
        const todayHours = history.find(item => item.date === today)?.hours || 0;
        const weekHours = history.filter(item => item.date >= weekStart && item.date <= today).reduce((sum, item) => sum + item.hours, 0);
        const totalHours = history.reduce((sum, item) => sum + item.hours, 0);
        const streak = calculateStreak(history);

        const elToday = document.getElementById('stats-kpi-today');
        const elWeek = document.getElementById('stats-kpi-week');
        const elTotal = document.getElementById('stats-kpi-total');
        const elStreak = document.getElementById('stats-kpi-streak');

        const pd = typeof Utils !== 'undefined' ? Utils.toPersianDigits : (v => v);

        if (elToday) elToday.textContent = `${pd(todayHours.toFixed(1))} س`;
        if (elWeek) elWeek.textContent = `${pd(weekHours.toFixed(1))} س`;
        if (elTotal) elTotal.textContent = `${pd(totalHours.toFixed(0))} س`;
        if (elStreak) elStreak.textContent = `${pd(streak)} روز`;
    }

    function renderCharts() {
        if (typeof Chart === 'undefined') return;

        const history = realStudyData();
        const labels = history.map(h => typeof Utils !== 'undefined' ? Utils.toPersianDigits(h.date.substring(5)) : h.date);
        const hoursData = history.map(h => h.hours);

        // 1. Line Chart (Weekly Trend)
        const lineCanvas = document.getElementById('chart-stats-line');
        if (lineCanvas) {
            if (lineChartInstance) lineChartInstance.destroy();
            const ctx = lineCanvas.getContext('2d');
            lineChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'ساعات مطالعه',
                        data: hoursData,
                        borderColor: '#05319e',
                        backgroundColor: 'rgba(5, 49, 158, 0.15)',
                        fill: true,
                        tension: 0.35,
                        borderWidth: 3,
                        pointBackgroundColor: '#c9a03e',
                        pointBorderColor: '#fff',
                        pointRadius: 5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { callback: v => typeof Utils !== 'undefined' ? Utils.toPersianDigits(v) : v }
                        }
                    }
                }
            });
        }

        // 2. Bar Chart (Subject Comparison)
        const barCanvas = document.getElementById('chart-stats-bar');
        if (barCanvas) {
            if (barChartInstance) barChartInstance.destroy();
            const ctx = barCanvas.getContext('2d');
            const subjects = new Map();
            (Storage.get('manual_reports', []) || []).filter(item => item?.subject && item.status !== 'missed').forEach(item => subjects.set(item.subject.trim(), (subjects.get(item.subject.trim()) || 0) + Number(item.minutes || 0) / 60));
            const subjectRows = [...subjects.entries()].sort((a,b) => b[1] - a[1]).slice(0, 8);
            barChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: subjectRows.length ? subjectRows.map(item => item[0]) : ['هنوز گزارشی ثبت نشده'],
                    datasets: [{
                        label: 'ساعات مطالعه این هفته',
                        data: subjectRows.length ? subjectRows.map(item => Number(item[1].toFixed(2))) : [0],
                        backgroundColor: [
                            'rgba(16, 185, 129, 0.75)',
                            'rgba(245, 158, 11, 0.75)',
                            'rgba(14, 165, 233, 0.75)',
                            'rgba(99, 102, 241, 0.75)',
                            'rgba(201, 160, 62, 0.75)'
                        ],
                        borderRadius: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { callback: v => typeof Utils !== 'undefined' ? Utils.toPersianDigits(v) : v }
                        }
                    }
                }
            });
        }

    }

    function exportPDFReport() {
        if (typeof Utils !== 'undefined') {
            Utils.printElement('stats-report-printable-area', 'کارنامه و گزارش تحلیلی درسیار');
        }
    }

    return {
        init,
        exportPDFReport
    };
})();

if (typeof window !== 'undefined') {
    window.Stats = Stats;
}
