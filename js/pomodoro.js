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
    let secondsStudiedThisSession = 0;
    let currentTaskName = 'مطالعه و تمرکز آزاد';

    function init() {
        loadSettings();
        renderTasks();
        renderStats();
        updateDisplay();
        setupScheduleTaskOptions();
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
        updateControlButtons();

        if (typeof Utils !== 'undefined') {
            Utils.playSound('click');
        }

        timerInterval = setInterval(() => {
            timeLeft--;
            if (currentMode === 'work') {
                secondsStudiedThisSession++;
            }

            updateDisplay();

            if (timeLeft <= 0) {
                onTimerComplete();
            }
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
        pauseTimer();
        timerState = 'idle';

        if (typeof Utils !== 'undefined') {
            Utils.playSound('timerEnd');
        }

        if (currentMode === 'work') {
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

        const history = Storage.get('study_history', []);
        if (history.length > 0) {
            const todayItem = history[history.length - 1];
            todayItem.hours = parseFloat((todayItem.hours + hoursToAdd).toFixed(2));
            todayItem.sessions = (todayItem.sessions || 0) + 1;
            Storage.set('study_history', history);
        }

        if (typeof Dashboard !== 'undefined') {
            Dashboard.init();
        }
    }

    function incrementSessionsToday() {
        const history = Storage.get('study_history', []);
        if (history.length > 0) {
            const today = history[history.length - 1];
            today.sessions = (today.sessions || 0) + 1;
            Storage.set('study_history', history);
        }
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
        if (todaySchedule && todaySchedule.slots) {
            todaySchedule.slots.forEach(slot => {
                optionsHtml += `<option value="${slot.subject} (${slot.note})">📅 ${slot.subject} - ${slot.time}</option>`;
            });
        }

        select.innerHTML = optionsHtml;
        select.onchange = function () {
            currentTaskName = this.value;
            const labelEl = document.getElementById('pomo-active-task-label');
            if (labelEl) labelEl.textContent = currentTaskName;
        };
    }

    function setTaskFromExternal(taskName) {
        currentTaskName = taskName;
        const labelEl = document.getElementById('pomo-active-task-label');
        if (labelEl) labelEl.textContent = taskName;
        if (typeof Utils !== 'undefined') {
            Utils.showToast(`تسک «${taskName}» به تایمر پومودورو متصل شد.`, 'info');
        }
    }

    // Today's Task Checklist
    function renderTasks() {
        const container = document.getElementById('pomo-tasks-list');
        if (!container) return;

        const tasks = Storage.get('pomo_tasks', [
            { id: 't1', title: 'مرور فصل ۱ زیست‌شناسی (پروتئین‌سازی)', done: true },
            { id: 't2', title: 'حل ۲۰ تست سینتیک شیمی', done: false },
            { id: 't3', title: 'مشاهده ویدیوی آموزشی مشتق و دیفرانسیل', done: false }
        ]);

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
        const todayLog = history[history.length - 1] || { sessions: 4, hours: 3.5 };
        const weekHours = history.reduce((acc, h) => acc + h.hours, 0);
        const user = Storage.getCurrentUser() || { streak: 5 };

        const sTodayEl = document.getElementById('pomo-stat-today-sessions');
        const sWeekEl = document.getElementById('pomo-stat-week-hours');
        const sStreakEl = document.getElementById('pomo-stat-streak');

        if (sTodayEl && typeof Utils !== 'undefined') sTodayEl.textContent = Utils.toPersianDigits(todayLog.sessions || 4);
        if (sWeekEl && typeof Utils !== 'undefined') sWeekEl.textContent = Utils.toPersianDigits(weekHours.toFixed(1));
        if (sStreakEl && typeof Utils !== 'undefined') sStreakEl.textContent = Utils.toPersianDigits(user.streak || 5);
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
        setTaskFromExternal,
        addTaskSubmit,
        toggleTaskDone,
        deleteTask
    };
})();

if (typeof window !== 'undefined') {
    window.Pomodoro = Pomodoro;
}
