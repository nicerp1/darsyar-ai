/**
 * StudyMate Pro - Statistics, Analytics & Exam Percentage Calculator
 */

const Stats = (function () {
    let lineChartInstance = null;
    let barChartInstance = null;
    let doughnutChartInstance = null;

    function init() {
        initPercentageCalculator();
        renderStatsKPIs();
        renderCharts();
        renderExamHistory();
    }

    // Percentage Calculator Logic
    function initPercentageCalculator() {
        const totalInput = document.getElementById('calc-total');
        const correctInput = document.getElementById('calc-correct');
        const wrongInput = document.getElementById('calc-wrong');
        const negToggle = document.getElementById('calc-negative-toggle');

        const recalculate = () => calculatePercentage();

        if (totalInput) totalInput.addEventListener('input', recalculate);
        if (correctInput) correctInput.addEventListener('input', recalculate);
        if (wrongInput) wrongInput.addEventListener('input', recalculate);
        if (negToggle) negToggle.addEventListener('change', recalculate);

        calculatePercentage();
    }

    function calculatePercentage() {
        const totalInput = document.getElementById('calc-total');
        const correctInput = document.getElementById('calc-correct');
        const wrongInput = document.getElementById('calc-wrong');
        const negToggle = document.getElementById('calc-negative-toggle');

        const total = parseFloat(totalInput ? totalInput.value : 30) || 0;
        const correct = parseFloat(correctInput ? correctInput.value : 20) || 0;
        const wrong = parseFloat(wrongInput ? wrongInput.value : 5) || 0;
        const hasNegative = negToggle ? negToggle.checked : true;

        const unanswered = Math.max(0, total - (correct + wrong));
        const unansEl = document.getElementById('calc-unanswered-display');
        if (unansEl && typeof Utils !== 'undefined') {
            unansEl.textContent = Utils.toPersianDigits(unanswered);
        }

        let percentage = 0;
        if (total > 0) {
            if (hasNegative) {
                percentage = ((correct - (wrong / 3)) / total) * 100;
            } else {
                percentage = (correct / total) * 100;
            }
        }

        const percentEl = document.getElementById('calc-result-percentage');
        const statusEl = document.getElementById('calc-result-status');
        const circleEl = document.getElementById('calc-circle-display');

        const formatted = percentage.toFixed(1);
        if (percentEl && typeof Utils !== 'undefined') {
            percentEl.textContent = `${Utils.toPersianDigits(formatted)}٪`;
        }

        let statusText = 'عالی و درخشان 🌟';
        let statusColor = '#10b981';

        if (percentage >= 80) {
            statusText = 'رتبه برتر و عالی 🏆';
            statusColor = '#10b981';
        } else if (percentage >= 60) {
            statusText = 'بسیار خوب و رضایت‌بخش 👍';
            statusColor = '#0ea5e9';
        } else if (percentage >= 40) {
            statusText = 'متوسط - نیازمند تمرین بیشتر 📚';
            statusColor = '#f59e0b';
        } else {
            statusText = 'ضعیف - نیازمند بازخوانی مفاهیم ⚠️';
            statusColor = '#ef4444';
        }

        if (statusEl) {
            statusEl.textContent = statusText;
            statusEl.style.color = statusColor;
        }
        if (circleEl) {
            circleEl.style.borderColor = statusColor;
        }
    }

    function renderStatsKPIs() {
        const history = Storage.get('study_history', []);
        const user = Storage.getCurrentUser() || { streak: 5 };

        const todayHours = history.length ? history[history.length - 1].hours : 3.5;
        const weekHours = history.reduce((acc, h) => acc + h.hours, 0);
        const totalHours = weekHours * 4.2; // All-time simulation

        const elToday = document.getElementById('stats-kpi-today');
        const elWeek = document.getElementById('stats-kpi-week');
        const elTotal = document.getElementById('stats-kpi-total');
        const elStreak = document.getElementById('stats-kpi-streak');

        const pd = typeof Utils !== 'undefined' ? Utils.toPersianDigits : (v => v);

        if (elToday) elToday.textContent = `${pd(todayHours.toFixed(1))} س`;
        if (elWeek) elWeek.textContent = `${pd(weekHours.toFixed(1))} س`;
        if (elTotal) elTotal.textContent = `${pd(totalHours.toFixed(0))} س`;
        if (elStreak) elStreak.textContent = `${pd(user.streak || 5)} روز`;
    }

    function renderCharts() {
        if (typeof Chart === 'undefined') return;

        const history = Storage.get('study_history', []);
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
            barChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['زیست‌شناسی', 'شیمی', 'فیزیک', 'ریاضیات', 'عمومی و ادبیات'],
                    datasets: [{
                        label: 'ساعات مطالعه این هفته',
                        data: [12.5, 9.0, 8.5, 7.0, 5.2],
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

        // 3. Doughnut Chart (Time Distribution)
        const doughnutCanvas = document.getElementById('chart-stats-doughnut');
        if (doughnutCanvas) {
            if (doughnutChartInstance) doughnutChartInstance.destroy();
            const ctx = doughnutCanvas.getContext('2d');
            doughnutChartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['زیست‌شناسی', 'شیمی', 'فیزیک', 'ریاضیات', 'عمومی'],
                    datasets: [{
                        data: [30, 22, 20, 16, 12],
                        backgroundColor: ['#10b981', '#f59e0b', '#0ea5e9', '#6366f1', '#c9a03e'],
                        borderWidth: 2,
                        borderColor: '#0f172a'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { color: '#94a3b8', font: { family: 'Kalameh' } } }
                    }
                }
            });
        }
    }

    function renderExamHistory() {
        const tbody = document.getElementById('stats-exam-history-tbody');
        if (!tbody) return;

        const results = Storage.get('exam_results', []);
        if (!results.length) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--text-muted);">هنوز آزمونی ثبت نشده است.</td></tr>`;
            return;
        }

        const pd = typeof Utils !== 'undefined' ? Utils.toPersianDigits : (v => v);

        tbody.innerHTML = results.map((res, i) => `
            <tr>
                <td>${pd(i + 1)}</td>
                <td style="font-weight: 700;">${res.examTitle}</td>
                <td><span style="font-weight: 800; color: var(--gold-light);">${pd(res.scorePercentage)}٪</span></td>
                <td><span style="color: var(--success);">${pd(res.correct)} درست</span> / <span style="color: var(--danger);">${pd(res.wrong)} غلط</span></td>
                <td>${res.date}</td>
                <td>
                    <span style="background: rgba(16, 185, 129, 0.15); color: #10b981; padding: 3px 8px; border-radius: 4px; font-size: 11px;">ثبت‌شده</span>
                </td>
            </tr>
        `).join('');
    }

    function exportPDFReport() {
        if (typeof Utils !== 'undefined') {
            Utils.printElement('stats-report-printable-area', 'کارنامه و گزارش تحلیلی درسیار');
        }
    }

    return {
        init,
        calculatePercentage,
        exportPDFReport
    };
})();

if (typeof window !== 'undefined') {
    window.Stats = Stats;
}
