/**
 * StudyMate Pro - Main Dashboard Controller
 */

const Dashboard = (function () {
    let trendChartInstance = null;
    let countdownInterval = null;
    let isEditMode = false;

    function init() {
        renderWebDashboard();
        renderGreeting();
        renderQuote();
        renderKPIs();
        renderDailyGoal();
        renderQuickActions();
        renderTrendChart();
        renderExamReminders();
        startCountdownTicker();
    }

    function escapeHTML(value) {
        return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
    }

    function localDate() {
        const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    }

    function renderWebDashboard() {
        if (document.documentElement.classList.contains('capacitor-app')) return;
        const view = document.getElementById('view-dashboard'), user = Storage.getCurrentUser();
        if (!view || !user) return;
        let shell = view.querySelector('.web-dashboard-shell');
        if (!shell) { shell = document.createElement('div'); shell.className = 'web-dashboard-shell'; view.prepend(shell); }
        view.classList.add('web-dashboard-ready');
        const history = Storage.get('study_history', []) || [], reports = Storage.get('manual_reports', []) || [], schedule = Storage.get('schedule', []) || [];
        const now = new Date(), today = localDate(), start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 6);
        const todayHours = history.find(item => item.date === today)?.hours || 0;
        const weekHours = history.reduce((sum, item) => new Date(`${item.date}T00:00:00`) >= start ? sum + Number(item.hours || 0) : sum, 0);
        const streak = calculateStudyStreak(history), todayIndex = (now.getDay() + 1) % 7;
        const tasks = schedule[todayIndex]?.tasks || schedule[todayIndex]?.slots?.filter(item => item?.subject) || [];
        const completed = tasks.filter(task => task.status === 'completed').length, progress = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
        const taskMarkup = tasks.slice(0, 5).map((task, index) => `<article class="web-today-task"><label><input type="checkbox" ${task.status === 'completed' ? 'checked' : ''} disabled><i></i></label><div><strong>${escapeHTML(task.subject)}</strong><small>${escapeHTML(task.note || 'تسک برنامه‌ریزی‌شده')}</small></div><span>${Utils.toPersianDigits(task.durationMinutes || 60)} دقیقه</span><b>${Utils.toPersianDigits(index + 1)}</b></article>`).join('');
        const reportMarkup = reports.slice(0, 3).map(item => `<li><span class="material-symbols-outlined" aria-hidden="true">menu_book</span><div><strong>${escapeHTML(item.subject || 'مطالعه')}</strong><small>${escapeHTML(item.date || '')}</small></div><b>${Utils.toPersianDigits(item.minutes || 0)} دقیقه</b></li>`).join('');
        const manager = Storage.isManager(), advisor = user.advisor;
        const relation = manager ? `<button type="button" onclick="App.navigate('admin')"><span class="material-symbols-outlined">manage_accounts</span><div><small>فضای مشاور</small><strong>مدیریت دانش‌آموزان</strong></div><i class="material-symbols-outlined">arrow_back</i></button>` : advisor ? `<button type="button" onclick="Communications.open('chat')"><span class="material-symbols-outlined">support_agent</span><div><small>مشاور شما</small><strong>${escapeHTML(advisor.name || advisor.username)}</strong></div><i class="material-symbols-outlined">arrow_back</i></button>` : `<button type="button" onclick="App.navigate('schedule')"><span class="material-symbols-outlined">edit_calendar</span><div><small>مطالعه مستقل</small><strong>برنامه خودت را بساز</strong></div><i class="material-symbols-outlined">arrow_back</i></button>`;
        shell.innerHTML = `<header class="web-page-heading"><div><small>امروز، ${escapeHTML(Utils.getPersianDayName())}</small><h1>داشبورد امروز</h1><p>${escapeHTML(user.name || user.username)}، برای یک قدم رو به جلو آماده‌ای؟</p></div><button type="button" onclick="App.navigate('schedule')"><span class="material-symbols-outlined">add</span>افزودن تسک</button></header>
            <section class="web-dashboard-kpis"><article><span class="material-symbols-outlined blue">schedule</span><div><small>مطالعه امروز</small><strong>${Utils.toPersianDigits(Number(todayHours).toFixed(1))} <em>ساعت</em></strong></div></article><article><span class="material-symbols-outlined green">trending_up</span><div><small>مجموع این هفته</small><strong>${Utils.toPersianDigits(weekHours.toFixed(1))} <em>ساعت</em></strong></div></article><article><span class="material-symbols-outlined gold">local_fire_department</span><div><small>استریک مطالعه</small><strong>${Utils.toPersianDigits(streak)} <em>روز</em></strong></div></article><article><span class="material-symbols-outlined violet">task_alt</span><div><small>پیشرفت امروز</small><strong>${Utils.toPersianDigits(progress)}<em>٪</em></strong></div></article></section>
            <div class="web-dashboard-columns"><main><section class="web-panel web-today-panel"><header><div><span class="material-symbols-outlined">calendar_today</span><h2>برنامه امروز</h2></div><small>${Utils.toPersianDigits(tasks.length)} تسک</small></header><div class="web-today-list">${taskMarkup || '<div class="web-empty"><span class="material-symbols-outlined">event_available</span><p>برنامه امروز هنوز خالی است.</p><button onclick="App.navigate(\'schedule\')">ساخت برنامه</button></div>'}</div><button class="web-primary-action" onclick="App.navigate('pomodoro')"><span class="material-symbols-outlined">play_arrow</span>شروع جلسه تمرکز</button></section><section class="web-panel web-progress-panel"><header><div><span class="material-symbols-outlined">monitoring</span><h2>پیشرفت هفتگی</h2></div><button onclick="App.navigate('stats')">مشاهده گزارش</button></header><div class="web-week-bars">${history.slice(-7).map((item,index) => `<div><i style="height:${Math.min(100,Number(item.hours||0)/8*100)}%"></i><span>${['ش','ی','د','س','چ','پ','ج'][index] || ''}</span></div>`).join('') || '<p>هنوز داده‌ای ثبت نشده است.</p>'}</div></section></main><aside><section class="web-relation-card">${relation}</section><section class="web-panel web-report-panel"><header><div><span class="material-symbols-outlined">history</span><h2>آخرین گزارش‌ها</h2></div><button onclick="App.navigate('schedule')">ثبت مطالعه</button></header><ul>${reportMarkup || '<li class="web-empty-row">هنوز گزارشی ثبت نشده است.</li>'}</ul></section><section class="web-motivation"><span class="material-symbols-outlined">auto_awesome</span><div><small>یادآوری امروز</small><strong>پیشرفت از تکرار قدم‌های کوچک ساخته می‌شود.</strong></div></section></aside></div>`;
    }

    function renderGreeting() {
        const user = Storage.getCurrentUser() || { name: 'دانش‌پژوه گرامی' };
        const greetingEl = document.getElementById('dash-greeting-text');
        const dateEl = document.getElementById('dash-date-text');

        const hour = new Date().getHours();
        let timeSalute = 'وقت‌بخیر';
        if (hour >= 5 && hour < 12) timeSalute = 'صبح‌بخیر';
        else if (hour >= 12 && hour < 17) timeSalute = 'ظهر‌بخیر';
        else if (hour >= 17 && hour < 22) timeSalute = 'عصر‌بخیر';
        else timeSalute = 'شب‌بخیر';

        if (greetingEl) {
            greetingEl.innerHTML = `${timeSalute}، <strong>${user.name}</strong> عزیز! 🌟`;
        }
        if (dateEl && typeof Utils !== 'undefined') {
            const jalali = Utils.getJalaliDate();
            const dayName = Utils.getPersianDayName();
            dateEl.innerHTML = `📅 امروز ${dayName}، ${jalali}`;
        }
    }

    function renderQuote() {
        const quotes = Storage.get('quotes', []);
        if (!quotes.length) return;
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

        const quoteTextEl = document.getElementById('dash-quote-text');
        const quoteAuthorEl = document.getElementById('dash-quote-author');

        if (quoteTextEl) quoteTextEl.textContent = `«${randomQuote.text}»`;
        if (quoteAuthorEl) quoteAuthorEl.textContent = `— ${randomQuote.author}`;
    }

    function refreshQuote() {
        renderQuote();
        if (typeof Utils !== 'undefined') {
            Utils.playSound('click');
        }
    }

    function renderKPIs() {
        const history = Storage.get('study_history', []);
        const examResults = Storage.get('exam_results', []);

        // Today's study hours
        const now = new Date(), today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0,10);
        const todayLog = history.find(item => item.date === today) || { hours: 0 };
        const todayHours = todayLog.hours || 0;

        // Average score
        let avgScore = 0;
        if (examResults.length > 0) {
            const sum = examResults.reduce((acc, r) => acc + (r.scorePercentage || 0), 0);
            avgScore = Math.round(sum / examResults.length);
        }

        // Streak
        const streak = history.filter(item => Number(item.hours || 0) > 0).length ? calculateStudyStreak(history) : 0;

        const kpiHoursEl = document.getElementById('kpi-today-hours');
        const kpiAvgScoreEl = document.getElementById('kpi-avg-score');
        const kpiStreakEl = document.getElementById('kpi-streak-days');

        if (kpiHoursEl && typeof Utils !== 'undefined') {
            kpiHoursEl.textContent = Utils.toPersianDigits(todayHours.toFixed(1));
        }
        if (kpiAvgScoreEl && typeof Utils !== 'undefined') {
            kpiAvgScoreEl.textContent = Utils.toPersianDigits(avgScore);
        }
        if (kpiStreakEl && typeof Utils !== 'undefined') {
            kpiStreakEl.textContent = Utils.toPersianDigits(streak);
        }
    }

    function calculateStudyStreak(history) {
        const dates = new Set(history.filter(item => Number(item.hours || 0) > 0).map(item => item.date));
        let date = new Date(), count = 0;
        if (!dates.has(date.toISOString().slice(0,10))) date.setDate(date.getDate()-1);
        while (dates.has(date.toISOString().slice(0,10))) { count++; date.setDate(date.getDate()-1); }
        return count;
    }

    function renderDailyGoal() {
        const settings = Storage.getSettings();
        const targetHours = settings.dailyGoalHours || 4;
        const history = Storage.get('study_history', []);
        const now = new Date(), today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0,10);
        const todayHours = history.find(item => item.date === today)?.hours || 0;

        const percent = Math.min(100, Math.round((todayHours / targetHours) * 100));

        const fillEl = document.getElementById('goal-progress-bar');
        const textCurrentEl = document.getElementById('goal-current-text');
        const textTargetEl = document.getElementById('goal-target-text');
        const textPercentEl = document.getElementById('goal-percent-text');

        if (fillEl) fillEl.style.width = `${percent}%`;
        if (textCurrentEl && typeof Utils !== 'undefined') {
            textCurrentEl.textContent = `${Utils.toPersianDigits(todayHours.toFixed(1))} ساعت مطالعه`;
        }
        if (textTargetEl && typeof Utils !== 'undefined') {
            textTargetEl.textContent = `هدف: ${Utils.toPersianDigits(targetHours)} ساعت`;
        }
        if (textPercentEl && typeof Utils !== 'undefined') {
            textPercentEl.textContent = `${Utils.toPersianDigits(percent)}٪ تکمیل شده`;
        }
    }

    function openEditGoalModal() {
        const settings = Storage.getSettings();
        const input = document.getElementById('input-goal-hours');
        if (input) input.value = settings.dailyGoalHours || 4;
        if (typeof Utils !== 'undefined') {
            Utils.openModal('modal-edit-goal');
        }
    }

    function saveGoalHours() {
        const input = document.getElementById('input-goal-hours');
        if (!input) return;
        const hours = parseFloat(input.value) || 4;
        const settings = Storage.getSettings();
        settings.dailyGoalHours = hours;
        Storage.saveSettings(settings);

        renderDailyGoal();
        if (typeof Utils !== 'undefined') {
            Utils.closeModal('modal-edit-goal');
            Utils.showToast(`هدف روزانه با موفقیت به ${Utils.toPersianDigits(hours)} ساعت تغییر یافت!`, 'success');
        }
    }

    function renderQuickActions() {
        const grid = document.getElementById('quick-actions-grid');
        if (!grid) return;

        const actions = [
            { id: 'pomo', title: 'تایمر پومودورو', icon: 'timer', desc: 'شروع جلسات مطالعه با تمرکز عمیق', view: 'pomodoro', color: '#05319e' },
            { id: 'ai', title: 'دستیار هوش مصنوعی', icon: 'smart_toy', desc: 'رفع اشکال درسی و محاسبات ریاضی', view: 'ai-assistant', color: '#c9a03e' },
            { id: 'flash', title: 'فلش‌کارت و لایتنر', icon: 'style', desc: 'مرور هوشمند مطالب و واژگان', view: 'flashcards', color: '#10b981' },
            { id: 'writing', title: 'انشانویسی هوشمند', icon: 'edit_note', desc: 'نگارش انشا با ساختار و آرایه ادبی', view: 'ai-writing', color: '#8b5cf6' },
            { id: 'research', title: 'تحقیق و مقاله علمی', icon: 'menu_book', desc: 'تولید مقاله با استناد و رفرنس', view: 'ai-research', color: '#0ea5e9' }
        ];

        grid.innerHTML = actions.map(act => `
            <div class="quick-card" onclick="App.navigate('${act.view}')">
                <div class="quick-icon-circle" style="background: ${act.color}22; color: ${act.color}; border: 1.5px solid ${act.color}55;">
                    <span class="material-symbols-outlined">${act.icon}</span>
                </div>
                <div class="quick-card-title">${act.title}</div>
                <div class="quick-card-desc">${act.desc}</div>
            </div>
        `).join('');
    }

    function renderTrendChart() {
        const canvas = document.getElementById('chart-dashboard-trend');
        if (!canvas || typeof Chart === 'undefined') return;

        const history = Storage.get('study_history', []);
        const labels = history.map(h => typeof Utils !== 'undefined' ? Utils.toPersianDigits(h.date.substring(5)) : h.date);
        const data = history.map(h => h.hours);

        if (trendChartInstance) {
            trendChartInstance.destroy();
        }

        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 260);
        gradient.addColorStop(0, 'rgba(201, 160, 62, 0.4)');
        gradient.addColorStop(1, 'rgba(5, 49, 158, 0.02)');

        trendChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'ساعات مطالعه',
                    data: data,
                    borderColor: '#c9a03e',
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.38,
                    borderWidth: 3,
                    pointBackgroundColor: '#05319e',
                    pointBorderColor: '#c9a03e',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        rtl: true,
                        callbacks: {
                            label: function (context) {
                                return `مطالعه: ${typeof Utils !== 'undefined' ? Utils.toPersianDigits(context.parsed.y) : context.parsed.y} ساعت`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.06)' },
                        ticks: {
                            color: '#94a3b8',
                            callback: value => typeof Utils !== 'undefined' ? Utils.toPersianDigits(value) : value
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8' }
                    }
                }
            }
        });
    }

    function renderExamReminders() {
        const container = document.getElementById('dashboard-exam-reminders-list');
        if (!container) return;

        const reminders = Storage.get('exam_reminders', []);
        if (!reminders.length) {
            container.innerHTML = `<p style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 20px;">هیچ یادآور آزمونی ثبت نشده است.</p>`;
            return;
        }

        container.innerHTML = reminders.map((r, idx) => `
            <div class="exam-reminder-item">
                <div class="exam-reminder-header">
                    <span class="exam-reminder-name">🎯 ${r.title}</span>
                    <button style="background:transparent; border:none; color:var(--danger); cursor:pointer;" onclick="Dashboard.deleteExamReminder('${r.id}')">
                        <span class="material-symbols-outlined" style="font-size: 16px;">delete</span>
                    </button>
                </div>
                <div class="exam-countdown-digits" id="countdown-digits-${r.id}">
                    <!-- Ticker will inject here -->
                </div>
                <div style="font-size: 11px; color: var(--text-dim); text-align: center; margin-top: 6px;">
                    تاریخ برگزاری: ${r.jalaliDate || 'به‌زودی'}
                </div>
            </div>
        `).join('');
    }

    function startCountdownTicker() {
        if (countdownInterval) clearInterval(countdownInterval);

        function update() {
            const reminders = Storage.get('exam_reminders', []);
            const now = new Date().getTime();

            reminders.forEach(r => {
                const target = new Date(r.targetDate).getTime();
                const diff = target - now;
                const container = document.getElementById(`countdown-digits-${r.id}`);
                if (!container) return;

                if (diff <= 0) {
                    container.innerHTML = `<span style="color: var(--success); font-weight: 700; font-size: 13px;">🎉 زمان آزمون فرا رسیده است!</span>`;
                    return;
                }

                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const secs = Math.floor((diff % (1000 * 60)) / 1000);

                const pd = typeof Utils !== 'undefined' ? Utils.toPersianDigits : (v => v);

                container.innerHTML = `
                    <div class="countdown-box"><span class="countdown-num">${pd(days)}</span><span class="countdown-tag">روز</span></div>
                    <div class="countdown-box"><span class="countdown-num">${pd(hours)}</span><span class="countdown-tag">ساعت</span></div>
                    <div class="countdown-box"><span class="countdown-num">${pd(mins)}</span><span class="countdown-tag">دقیقه</span></div>
                    <div class="countdown-box"><span class="countdown-num">${pd(secs)}</span><span class="countdown-tag">ثانیه</span></div>
                `;
            });
        }

        update();
        countdownInterval = setInterval(update, 1000);
    }

    function openAddExamReminderModal() {
        if (typeof Utils !== 'undefined') {
            Utils.openModal('modal-add-exam-reminder');
        }
    }

    function addExamReminderSubmit() {
        const titleInput = document.getElementById('input-reminder-title');
        const dateInput = document.getElementById('input-reminder-date');

        if (!titleInput || !dateInput || !titleInput.value.trim() || !dateInput.value) {
            if (typeof Utils !== 'undefined') {
                Utils.showToast('لطفاً عنوان آزمون و تاریخ آن را وارد کنید.', 'warning');
            }
            return;
        }

        const title = titleInput.value.trim();
        const dateVal = dateInput.value; // e.g. 2026-11-20
        const targetDate = new Date(dateVal + 'T08:00:00').toISOString();

        const reminders = Storage.get('exam_reminders', []);
        reminders.push({
            id: 'rem-' + Date.now(),
            title: title,
            targetDate: targetDate,
            jalaliDate: typeof Utils !== 'undefined' ? Utils.getJalaliDate(new Date(dateVal)) : dateVal,
            priority: 'medium'
        });

        Storage.set('exam_reminders', reminders);
        titleInput.value = '';
        dateInput.value = '';

        renderExamReminders();
        startCountdownTicker();

        if (typeof Utils !== 'undefined') {
            Utils.closeModal('modal-add-exam-reminder');
            Utils.showToast('یادآور آزمون با موفقیت افزوده شد!', 'success');
        }
    }

    function deleteExamReminder(id) {
        let reminders = Storage.get('exam_reminders', []);
        reminders = reminders.filter(r => r.id !== id);
        Storage.set('exam_reminders', reminders);
        renderExamReminders();
        startCountdownTicker();
        if (typeof Utils !== 'undefined') {
            Utils.showToast('یادآور آزمون حذف شد.', 'info');
        }
    }

    function toggleEditWidgets() {
        isEditMode = !isEditMode;
        const btn = document.getElementById('btn-toggle-edit-widgets');
        const container = document.getElementById('dashboard-view');
        if (btn) {
            btn.innerHTML = isEditMode
                ? '<span class="material-symbols-outlined">check</span> ذخیره چینش ویجت‌ها'
                : '<span class="material-symbols-outlined">dashboard_customize</span> سفارشی‌سازی ویجت‌ها';
        }
        if (isEditMode) {
            if (typeof Utils !== 'undefined') {
                Utils.showToast('حالت ویرایش فعال شد. می‌توانید موقعیت بخش‌ها را جابجا نمایید.', 'info');
            }
        } else {
            if (typeof Utils !== 'undefined') {
                Utils.showToast('تغییرات چیدمان ذخیره گردید.', 'success');
            }
        }
    }

    return {
        init,
        refreshQuote,
        openEditGoalModal,
        saveGoalHours,
        renderTrendChart,
        openAddExamReminderModal,
        addExamReminderSubmit,
        deleteExamReminder,
        toggleEditWidgets
    };
})();

if (typeof window !== 'undefined') {
    window.Dashboard = Dashboard;
}
