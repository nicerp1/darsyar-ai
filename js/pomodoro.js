/**
 * StudyMate Pro - Pomodoro Focus Timer & Study Session Tracker
 */

const Pomodoro = (function () {
    let timerState = 'idle'; // 'running', 'paused', 'idle'
    let currentMode = 'work'; // 'work', 'shortBreak', 'longBreak'
    let timeLeft = 25 * 60;
    let totalDuration = 25 * 60;
    let timerInterval = null;
    let autoSaveInterval = null;
    let timerEndsAt = null;
    let secondsStudiedThisSession = 0;
    let currentTaskName = 'مطالعه و تمرکز آزاد';
    let visibilityListenerReady = false;
    const NOTIFICATION_ID = 25025;

    function init() {
        loadSettings();
        renderSettings();
        renderTasks();
        renderStats();
        updateDisplay();
        setupScheduleTaskOptions();
        if (!visibilityListenerReady) {
            document.addEventListener('visibilitychange', reconcileTimer);
            visibilityListenerReady = true;
        }
    }

    function renderSettings() {
        const settings = Storage.getSettings();
        const values = { 'pomo-setting-work': settings.pomodoroWork || 25, 'pomo-setting-short': settings.pomodoroShortBreak || 5, 'pomo-setting-long': settings.pomodoroLongBreak || 15 };
        Object.entries(values).forEach(([id, value]) => { const input = document.getElementById(id); if (input) input.value = value; });
    }

    function saveTimerSettings() {
        const settings = Storage.getSettings();
        settings.pomodoroWork = Math.min(180, Math.max(1, Number(document.getElementById('pomo-setting-work')?.value) || 25));
        settings.pomodoroShortBreak = Math.min(60, Math.max(1, Number(document.getElementById('pomo-setting-short')?.value) || 5));
        settings.pomodoroLongBreak = Math.min(120, Math.max(1, Number(document.getElementById('pomo-setting-long')?.value) || 15));
        Storage.saveSettings(settings); resetTimer(); loadSettings(); timeLeft = totalDuration; updateDisplay();
        Utils?.closeModal('modal-pomodoro-settings');
        Utils?.showToast('زمان‌های تایمر در دیتابیس ذخیره شد.', 'success');
    }

    function openSettings() {
        renderSettings();
        Utils?.openModal('modal-pomodoro-settings');
    }

    function localNotifications() {
        if (!window.DarsyarPlatform?.native) return null;
        return window.Capacitor?.Plugins?.LocalNotifications || null;
    }

    async function scheduleCompletionNotification() {
        const notifications = localNotifications();
        if (!notifications || !timerEndsAt) return;
        try {
            const permission = await notifications.checkPermissions();
            const status = permission.display === 'granted' ? permission : await notifications.requestPermissions();
            if (status.display !== 'granted') return;
            await notifications.createChannel?.({ id: 'pomodoro', name: 'پایان پومودورو', description: 'اعلان پایان زمان تمرکز و استراحت', importance: 5, visibility: 1, vibration: true, sound: 'default' });
            await notifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] });
            await notifications.schedule({ notifications: [{
                id: NOTIFICATION_ID,
                title: currentMode === 'work' ? 'زمان تمرکز تمام شد' : 'زمان استراحت تمام شد',
                body: currentMode === 'work' ? 'عالی بود! حالا چند دقیقه استراحت کن.' : 'برای جلسه بعدی آماده‌ای؟',
                channelId: 'pomodoro',
                sound: 'default',
                schedule: { at: new Date(timerEndsAt), allowWhileIdle: true },
                extra: { destination: 'pomodoro' }
            }] });
        } catch (error) {
            console.warn('Pomodoro notification could not be scheduled.', error);
        }
    }

    async function cancelCompletionNotification() {
        const notifications = localNotifications();
        if (!notifications) return;
        try { await notifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] }); } catch (_) {}
    }

    function reconcileTimer() {
        if (timerState !== 'running' || !timerEndsAt) return;
        const remaining = Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000));
        const elapsed = Math.max(0, timeLeft - remaining);
        if (currentMode === 'work') secondsStudiedThisSession += elapsed;
        timeLeft = remaining;
        updateDisplay();
        if (timeLeft <= 0) onTimerComplete();
    }

    function loadSettings() {
        const settings = Storage.getSettings();
        const workMin = settings.pomodoroWork || 25;
        const shortMin = settings.pomodoroShortBreak || 5;
        const longMin = settings.pomodoroLongBreak || 15;

        if (currentMode === 'work') {
            totalDuration = workMin * 60;
        } else if (currentMode === 'shortBreak') {
            totalDuration = shortMin * 60;
        } else if (currentMode === 'longBreak') {
            totalDuration = longMin * 60;
        }

        if (timerState === 'idle') {
            timeLeft = totalDuration;
        }
    }

    function switchMode(mode) {
        if (timerState === 'running') {
            if (!confirm('آیا مایلید جلسه در حال اجرا را متوقف و حالت را تغییر دهید؟')) {
                return;
            }
            pauseTimer();
        }

        currentMode = mode;
        timerState = 'idle';
        loadSettings();
        timeLeft = totalDuration;

        // Update tab styling
        document.querySelectorAll('.pomo-tab-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById(`pomo-tab-${mode}`);
        if (activeBtn) activeBtn.classList.add('active');

        updateDisplay();
        if (typeof Utils !== 'undefined') {
            Utils.playSound('click');
        }
    }

    function startTimer() {
        if (timerState === 'running') return;

        timerState = 'running';
        timerEndsAt = Date.now() + (timeLeft * 1000);
        updateControlButtons();
        scheduleCompletionNotification();

        if (typeof Utils !== 'undefined') {
            Utils.playSound('click');
        }

        timerInterval = setInterval(() => {
            const previous = timeLeft;
            timeLeft = Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000));
            if (currentMode === 'work') secondsStudiedThisSession += Math.max(0, previous - timeLeft);
            updateDisplay();
            if (timeLeft <= 0) onTimerComplete();
        }, 1000);

        // Auto-save every 30 seconds
        if (autoSaveInterval) clearInterval(autoSaveInterval);
        autoSaveInterval = setInterval(() => {
            if (currentMode === 'work' && secondsStudiedThisSession >= 30) {
                saveProgressToHistory(secondsStudiedThisSession);
                secondsStudiedThisSession = 0;
            }
        }, 30000);
    }

    function pauseTimer() {
        if (timerState !== 'running') return;
        timerState = 'paused';
        clearInterval(timerInterval);
        clearInterval(autoSaveInterval);
        timerEndsAt = null;
        cancelCompletionNotification();
        updateControlButtons();

        if (currentMode === 'work' && secondsStudiedThisSession > 0) {
            saveProgressToHistory(secondsStudiedThisSession);
            secondsStudiedThisSession = 0;
        }

        if (typeof Utils !== 'undefined') {
            Utils.playSound('click');
        }
    }

    function resetTimer() {
        pauseTimer();
        timerState = 'idle';
        timeLeft = totalDuration;
        secondsStudiedThisSession = 0;
        updateDisplay();
        updateControlButtons();
    }

    function onTimerComplete() {
        const completedMode = currentMode;
        pauseTimer();
        timerState = 'idle';

        if (typeof Utils !== 'undefined' && !window.DarsyarPlatform?.native) {
            Utils.playSound('timerEnd');
        }

        if (completedMode === 'work') {
            if (secondsStudiedThisSession > 0) {
                saveProgressToHistory(secondsStudiedThisSession);
                secondsStudiedThisSession = 0;
            }

            // XP Reward
            Storage.addXP(25);
            incrementSessionsToday();

            if (typeof Utils !== 'undefined') {
                Utils.showToast('🎉 عالی بود! یک جلسه تمرکز به پایان رسید و ۲۵ امتیاز (XP) دریافت کردید.', 'success');
                Utils.launchConfetti();
            }

            // Switch to short break automatically
            switchMode('shortBreak');
        } else {
            if (typeof Utils !== 'undefined') {
                Utils.showToast('استراحت به پایان رسید! آماده جلسه بعدی هستید؟', 'info');
            }
            switchMode('work');
        }

        renderStats();
    }

    function saveProgressToHistory(seconds) {
        const minutes = seconds / 60;
        const hoursToAdd = minutes / 60;

        const now = new Date(), today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0,10), history = Storage.get('study_history', []);
        let todayItem = history.find(item => item.date === today);
        if (!todayItem) { todayItem = { date: today, hours: 0, sessions: 0 }; history.push(todayItem); }
        todayItem.hours = parseFloat((Number(todayItem.hours || 0) + hoursToAdd).toFixed(2));
        todayItem.sessions = (todayItem.sessions || 0) + 1;
        Storage.set('study_history', history);

        if (typeof Dashboard !== 'undefined') {
            Dashboard.init();
        }
    }

    function incrementSessionsToday() {
        const now = new Date(), date = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0,10), history = Storage.get('study_history', []);
        let today = history.find(item => item.date === date);
        if (!today) { today = { date, hours: 0, sessions: 0 }; history.push(today); }
        today.sessions = (today.sessions || 0) + 1;
        Storage.set('study_history', history);
    }

    function updateDisplay() {
        const timeDigitsEl = document.getElementById('pomo-display-time');
        const fsDigitsEl = document.getElementById('fs-pomo-time');
        const circleProgress = document.getElementById('pomo-circle-progress');

        const formatted = typeof Utils !== 'undefined' ? Utils.formatDuration(timeLeft) : `${Math.floor(timeLeft / 60)}:${timeLeft % 60}`;

        if (timeDigitsEl) timeDigitsEl.textContent = formatted;
        if (fsDigitsEl) fsDigitsEl.textContent = formatted;

        // SVG Circle stroke dashoffset
        if (circleProgress) {
            const circumference = 2 * Math.PI * 120; // r=120
            const progress = (totalDuration - timeLeft) / totalDuration;
            const offset = circumference * (1 - progress);
            circleProgress.style.strokeDasharray = `${circumference} ${circumference}`;
            circleProgress.style.strokeDashoffset = offset;
        }

        // Title update for tab awareness
        document.title = timerState === 'running' ? `(${formatted}) درسیار - تایمر پومودورو` : 'درسیار | StudyMate Pro';
    }

    function updateControlButtons() {
        const mainBtn = document.getElementById('btn-pomo-play');
        const fsMainBtn = document.getElementById('fs-btn-pomo-play');

        const isRunning = timerState === 'running';
        const label = isRunning
            ? '<span class="material-symbols-outlined">pause</span> توقف موقت'
            : '<span class="material-symbols-outlined">play_arrow</span> شروع تمرکز';

        if (mainBtn) mainBtn.innerHTML = label;
        if (fsMainBtn) fsMainBtn.innerHTML = label;
    }

    function toggleTimer() {
        if (timerState === 'running') {
            pauseTimer();
        } else {
            startTimer();
        }
    }

    function enterFullscreenFocus() {
        const fs = document.getElementById('focus-fullscreen-overlay');
        if (fs) {
            const label = document.getElementById('focus-task-name'); if (label) label.textContent = currentTaskName;
            fs.classList.add('active');
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(() => {});
            }
        }
    }

    function exitFullscreenFocus() {
        const fs = document.getElementById('focus-fullscreen-overlay');
        if (fs) {
            fs.classList.remove('active');
            if (document.fullscreenElement && document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            }
        }
    }

    function setupScheduleTaskOptions() {
        const select = document.getElementById('pomo-task-selector');
        if (!select) return;

        const schedule = Storage.get('schedule', []);
        const todayDayIndex = (new Date().getDay() + 1) % 7; // Saturday = 0 in Iranian calendar
        const todaySchedule = schedule[todayDayIndex] || schedule[0];

        let optionsHtml = `<option value="مطالعه آزاد و یادگیری">📌 مطالعه و تمرکز آزاد</option>`;
        const tasks = todaySchedule?.tasks || todaySchedule?.slots || [];
        if (tasks.length) {
            tasks.filter(task => task.subject).forEach(task => {
                optionsHtml += `<option value="${task.subject}">${task.subject} · ${task.durationMinutes || 60} دقیقه</option>`;
            });
        }

        select.innerHTML = optionsHtml;
        select.onchange = function () {
            currentTaskName = this.value;
            const labelEl = document.getElementById('pomo-active-task-label');
            if (labelEl) labelEl.textContent = currentTaskName;
        };
    }

    function setTaskFromExternal(taskName, suggestedMinutes) {
        currentTaskName = taskName;
        const labelEl = document.getElementById('pomo-active-task-label');
        if (labelEl) labelEl.textContent = taskName;
        if (suggestedMinutes) {
            const settings = Storage.getSettings(); settings.pomodoroWork = Math.min(180, Math.max(1, Number(suggestedMinutes))); Storage.saveSettings(settings);
            currentMode = 'work'; timerState = 'idle'; loadSettings(); timeLeft = totalDuration; renderSettings(); updateDisplay();
        }
        if (typeof Utils !== 'undefined') {
            Utils.showToast(`تسک «${taskName}» به تایمر پومودورو متصل شد.`, 'info');
        }
    }

    // Today's Task Checklist
    function renderTasks() {
        const container = document.getElementById('pomo-tasks-list');
        if (!container) return;

        const tasks = Storage.get('pomo_tasks', []);

        if (!tasks.length) {
            container.innerHTML = '<p class="pomo-empty-tasks">هنوز تسکی برای تمرکز ثبت نشده است.</p>';
            return;
        }

        container.innerHTML = tasks.map(t => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: var(--bg-surface); border-radius: var(--radius-md); margin-bottom: 8px; border: 1px solid var(--border-subtle);">
                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; text-decoration: ${t.done ? 'line-through' : 'none'}; color: ${t.done ? 'var(--text-dim)' : 'var(--text-main)'};">
                    <input type="checkbox" ${t.done ? 'checked' : ''} onchange="Pomodoro.toggleTaskDone('${t.id}')">
                    <span>${t.title}</span>
                </label>
                <button style="background: transparent; border: none; color: var(--danger); cursor: pointer;" onclick="Pomodoro.deleteTask('${t.id}')">
                    <span class="material-symbols-outlined" style="font-size: 18px;">delete</span>
                </button>
            </div>
        `).join('');
    }

    function addTaskSubmit() {
        const input = document.getElementById('input-pomo-new-task');
        if (!input || !input.value.trim()) return;

        const tasks = Storage.get('pomo_tasks', []);
        tasks.push({
            id: 't-' + Date.now(),
            title: input.value.trim(),
            done: false
        });

        Storage.set('pomo_tasks', tasks);
        input.value = '';
        renderTasks();
        if (typeof Utils !== 'undefined') {
            Utils.playSound('click');
        }
    }

    function toggleTaskDone(id) {
        const tasks = Storage.get('pomo_tasks', []);
        const target = tasks.find(t => t.id === id);
        if (target) {
            target.done = !target.done;
            Storage.set('pomo_tasks', tasks);
            if (target.done) {
                Storage.addXP(10);
                if (typeof Utils !== 'undefined') {
                    Utils.showToast('آفرین! تسک انجام شد (+۱۰ XP)', 'success');
                }
            }
            renderTasks();
        }
    }

    function deleteTask(id) {
        let tasks = Storage.get('pomo_tasks', []);
        tasks = tasks.filter(t => t.id !== id);
        Storage.set('pomo_tasks', tasks);
        renderTasks();
    }

    function renderStats() {
        const history = Storage.get('study_history', []);
        const now = new Date(), todayKey = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0,10), cutoff = new Date(now); cutoff.setDate(cutoff.getDate()-6); const weekKey = new Date(cutoff.getTime() - cutoff.getTimezoneOffset() * 60000).toISOString().slice(0,10);
        const todayLog = history.find(item => item.date === todayKey) || { sessions: 0, hours: 0 };
        const weekHours = history.filter(item => item.date >= weekKey && item.date <= todayKey).reduce((acc, h) => acc + Number(h.hours || 0), 0);
        const active = new Set(history.filter(item => Number(item.hours || 0) > 0).map(item => item.date)); let cursor = new Date(now), streak = 0; if (!active.has(todayKey)) cursor.setDate(cursor.getDate()-1); while (active.has(new Date(cursor.getTime()-cursor.getTimezoneOffset()*60000).toISOString().slice(0,10))) { streak++; cursor.setDate(cursor.getDate()-1); }

        const sTodayEl = document.getElementById('pomo-stat-today-sessions');
        const sWeekEl = document.getElementById('pomo-stat-week-hours');
        const sStreakEl = document.getElementById('pomo-stat-streak');

        if (sTodayEl && typeof Utils !== 'undefined') sTodayEl.textContent = Utils.toPersianDigits(todayLog.sessions || 0);
        if (sWeekEl && typeof Utils !== 'undefined') sWeekEl.textContent = Utils.toPersianDigits(weekHours.toFixed(1));
        if (sStreakEl && typeof Utils !== 'undefined') sStreakEl.textContent = Utils.toPersianDigits(streak);
    }

    return {
        init,
        switchMode,
        startTimer,
        pauseTimer,
        resetTimer,
        toggleTimer,
        enterFullscreenFocus,
        exitFullscreenFocus,
        saveTimerSettings,
        openSettings,
        setTaskFromExternal,
        addTaskSubmit,
        toggleTaskDone,
        deleteTask
    };
})();

if (typeof window !== 'undefined') {
    window.Pomodoro = Pomodoro;
}
