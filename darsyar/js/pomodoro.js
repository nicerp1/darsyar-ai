// ============ POMODORO TIMER PRO - COMPLETE ============
const Pomodoro = {
    workMin: parseInt(localStorage.getItem('pomodoroWork')) || 25,
    breakMin: parseInt(localStorage.getItem('pomodoroBreak')) || 5,
    minutes: parseInt(localStorage.getItem('pomodoroWork')) || 25,
    seconds: 0,
    isRunning: false,
    interval: null,
    liveSaveInterval: null,
    sessionsToday: 0,
    isBreak: false,
    currentTask: '',
    elapsedSeconds: 0,
    focusMode: false,
    soundEnabled: true,
    _fireAnimating: false,
    _fireParticles: [],
    _musicPlaying: false,
    _audioCtx: null,
    
    quotes: [
        'موفقیت، مجموع تلاش‌های کوچک روزانه است.',
        'هر پومودورو، یک قدم به هدفت نزدیک‌ترت می‌کنه.',
        'امروز رو بساز، فردا ممنون خودت باش.',
        'تمرکز، قدرت واقعی انسانه.',
        'بهترین زمان برای شروع، همین الانِ.',
        'پیشرفت، از منطقه امنت شروع میشه.',
        'هر دقیقه مطالعه، سرمایه‌گذاری روی آینده‌ست.',
        'تو قوی‌تری از چیزی هستی که فکر می‌کنی.',
        'استمرار، راز موفقیته.',
        'امروز یه قدم بردار، حتی اگه کوچیک باشه.'
    ],
    
    taskList: JSON.parse(localStorage.getItem('pomodoroTaskList') || '[]'),
    
    init() {
        const todayStr = new Date().toDateString();
        if (localStorage.getItem('lastSessionDate') !== todayStr) {
            localStorage.setItem('sessionsToday', '0');
            localStorage.setItem('lastSessionDate', todayStr);
            this.taskList = [];
            this.saveTaskList();
        }
        this.sessionsToday = parseInt(localStorage.getItem('sessionsToday') || '0');
        this.soundEnabled = localStorage.getItem('pomodoroSound') !== 'off';
        
        this.updateDisplay();
        document.getElementById('workDuration').value = this.workMin;
        document.getElementById('breakDuration').value = this.breakMin;
        document.getElementById('sessionInfo').textContent = `جلسات امروز: ${this.sessionsToday}`;
        this.populateTaskSelect();
        this.bindEvents();
        this.renderTaskList();
        this.updateLiveStats();
    },
    
    bindEvents() {
        document.getElementById('taskSelect').addEventListener('change', (e) => {
            const freeInput = document.getElementById('freeTaskInput');
            if (e.target.value === 'free') {
                freeInput.style.display = 'block';
                e.target.style.display = 'none';
                freeInput.focus();
            }
        });
        
        document.getElementById('freeTaskInput').addEventListener('blur', function() {
            if (!this.value.trim()) {
                this.style.display = 'none';
                document.getElementById('taskSelect').style.display = 'block';
                document.getElementById('taskSelect').value = '';
            }
        });
        
        document.getElementById('workDuration').addEventListener('change', function() {
            Pomodoro.workMin = parseInt(this.value) || 25;
            localStorage.setItem('pomodoroWork', Pomodoro.workMin);
            if (!Pomodoro.isBreak) { Pomodoro.minutes = Pomodoro.workMin; Pomodoro.updateDisplay(); }
        });
        
        document.getElementById('breakDuration').addEventListener('change', function() {
            Pomodoro.breakMin = parseInt(this.value) || 5;
            localStorage.setItem('pomodoroBreak', Pomodoro.breakMin);
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.focusMode) {
                this.toggleFocusMode();
            }
        });
    },
    
    populateTaskSelect() {
        const sel = document.getElementById('taskSelect');
        if (!sel) return;
        sel.innerHTML = '<option value="">انتخاب فعالیت از برنامه...</option><option value="free">✏️ ورود آزاد (تایپ نام درس)</option>';
        if (typeof Storage !== 'undefined' && Storage.weeklySchedule) {
            Object.entries(Storage.weeklySchedule).forEach(([key, val]) => {
                if (val && val.title) sel.innerHTML += `<option value="${key}">${val.title} (${key})</option>`;
            });
        }
    },
    
    getCurrentTaskName() {
        const taskSelect = document.getElementById('taskSelect');
        const taskKey = taskSelect ? taskSelect.value : '';
        const freeInput = document.getElementById('freeTaskInput');
        
        if (taskKey === 'free' && freeInput) {
            return freeInput.value.trim() || 'مطالعه آزاد';
        }
        if (typeof Storage !== 'undefined' && Storage.weeklySchedule && taskKey && Storage.weeklySchedule[taskKey]) {
            return Storage.weeklySchedule[taskKey].title;
        }
        return taskKey || 'بدون عنوان';
    },
    
    updateDisplay() {
        const display = document.getElementById('timerDisplay');
        if (display) {
            display.textContent = `${String(this.minutes).padStart(2, '0')}:${String(this.seconds).padStart(2, '0')}`;
        }
        const focusDisplay = document.getElementById('focusTimerDisplay');
        if (focusDisplay) {
            focusDisplay.textContent = `${String(this.minutes).padStart(2, '0')}:${String(this.seconds).padStart(2, '0')}`;
        }
    },
    
    start() {
        if (this.isRunning) return;
        
        const taskSelect = document.getElementById('taskSelect');
        const taskKey = taskSelect ? taskSelect.value : '';
        const freeInput = document.getElementById('freeTaskInput');
        const freeTask = freeInput ? freeInput.value.trim() : '';
        
        if (!taskKey && !freeTask) return this.showToast('⚠️ یک فعالیت انتخاب کن');
        
        this.currentTask = this.getCurrentTaskName();
        this.isRunning = true;
        this.elapsedSeconds = 0;
        
        const liveTimeEl = document.getElementById('liveTimeSaved');
        if (liveTimeEl) liveTimeEl.textContent = '';
        const currentTaskEl = document.getElementById('currentTaskDisplay');
        if (currentTaskEl) currentTaskEl.textContent = this.currentTask;
        
        this.showRandomQuote();
        this.addTaskToToday(this.currentTask);
        this.startLiveSave();
        
        this.interval = setInterval(() => {
            if (this.seconds === 0) {
                if (this.minutes === 0) {
                    clearInterval(this.interval);
                    clearInterval(this.liveSaveInterval);
                    this.isRunning = false;
                    
                    if (!this.isBreak) {
                        this.sessionsToday++;
                        localStorage.setItem('sessionsToday', this.sessionsToday);
                        
                        if (typeof Storage !== 'undefined') {
                            Storage.studySessions.push({
                                task: this.currentTask,
                                duration: this.workMin,
                                date: this.getTodayDate(),
                                live: false
                            });
                            Storage.updateStudySessions();
                        }
                        
                        const sessionInfo = document.getElementById('sessionInfo');
                        if (sessionInfo) sessionInfo.textContent = `جلسات امروز: ${this.sessionsToday}`;
                        const liveTimeEl2 = document.getElementById('liveTimeSaved');
                        if (liveTimeEl2) liveTimeEl2.textContent = '';
                        const currentTaskEl2 = document.getElementById('currentTaskDisplay');
                        if (currentTaskEl2) currentTaskEl2.textContent = 'استراحت ☕';
                        
                        this.playSound('complete');
                        
                        if (typeof Gamification !== 'undefined') {
                            Gamification.addXP(10);
                            Gamification.checkAchievements();
                        }
                        
                        this.showToast(`🎉 پومودورو تمام! استراحت ${this.breakMin} دقیقه‌ای`);
                        this.isBreak = true;
                        this.minutes = this.breakMin;
                        this.seconds = 0;
                        this.updateDisplay();
                        this.start();
                    } else {
                        this.playSound('breakEnd');
                        this.showToast('☕ استراحت تمام شد، آماده‌ای؟');
                        const currentTaskEl3 = document.getElementById('currentTaskDisplay');
                        if (currentTaskEl3) currentTaskEl3.textContent = 'آماده برای پومودوروی بعدی';
                        this.isBreak = false;
                        this.minutes = this.workMin;
                        this.seconds = 0;
                        this.updateDisplay();
                        if (this.focusMode) this.toggleFocusMode();
                    }
                    this.updateLiveStats();
                    return;
                }
                this.minutes--;
                this.seconds = 59;
            } else {
                this.seconds--;
            }
            this.updateDisplay();
            this.updateLiveStats();
        }, 1000);
    },
    
    startLiveSave() {
        this.liveSaveInterval = setInterval(() => {
            if (this.isRunning && !this.isBreak) {
                this.elapsedSeconds += 30;
                if (typeof Storage !== 'undefined') {
                    Storage.studySessions.push({
                        task: this.currentTask,
                        duration: 0.5,
                        date: this.getTodayDate(),
                        live: true
                    });
                    Storage.updateStudySessions();
                }
                const liveTimeEl = document.getElementById('liveTimeSaved');
                if (liveTimeEl) {
                    liveTimeEl.textContent = `⏱️ ${Math.floor(this.elapsedSeconds / 60)} دقیقه ذخیره شد`;
                }
            }
        }, 30000);
    },
    
    pause() {
        if (this.interval) { clearInterval(this.interval); this.interval = null; }
        if (this.liveSaveInterval) { clearInterval(this.liveSaveInterval); this.liveSaveInterval = null; }
        this.isRunning = false;
    },
    
    reset() {
        this.pause();
        this.isBreak = false;
        this.minutes = this.workMin;
        this.seconds = 0;
        this.elapsedSeconds = 0;
        const liveTimeEl = document.getElementById('liveTimeSaved');
        if (liveTimeEl) liveTimeEl.textContent = '';
        const currentTaskEl = document.getElementById('currentTaskDisplay');
        if (currentTaskEl) currentTaskEl.textContent = 'آماده برای شروع';
        this.updateDisplay();
    },
    
    toggleFocusMode() {
        this.focusMode = !this.focusMode;
        const overlay = document.getElementById('focusOverlay');
        
        if (this.focusMode) {
            if (!overlay) {
                const div = document.createElement('div');
                div.id = 'focusOverlay';
                div.className = 'focus-overlay';
                div.innerHTML = `
                    <div class="focus-content">
                        <div class="focus-quote" id="focusQuote">${this.getRandomQuote()}</div>
                        <div class="focus-task" id="focusTaskDisplay">${this.currentTask || 'آماده برای شروع'}</div>
                        <div class="focus-timer" id="focusTimerDisplay">${String(this.minutes).padStart(2, '0')}:${String(this.seconds).padStart(2, '0')}</div>
                        <div class="focus-session-info">جلسه ${this.sessionsToday + 1} امروز</div>
                        <button class="focus-exit-btn" onclick="Pomodoro.toggleFocusMode()">خروج (Esc)</button>
                    </div>
                `;
                document.body.appendChild(div);
            }
        } else {
            if (overlay) overlay.remove();
        }
    },
    
    playSound(type) {
        if (!this.soundEnabled) return;
        const sounds = {
            complete: { freq: 800, duration: 200, repeat: 3 },
            breakEnd: { freq: 600, duration: 150, repeat: 2 }
        };
        const s = sounds[type];
        if (!s) return;
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            for (let i = 0; i < s.repeat; i++) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = s.freq;
                gain.gain.value = 0.3;
                osc.start(ctx.currentTime + i * 0.3);
                osc.stop(ctx.currentTime + i * 0.3 + s.duration / 1000);
            }
        } catch(e) {}
    },
    
    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        localStorage.setItem('pomodoroSound', this.soundEnabled ? 'on' : 'off');
        this.showToast(this.soundEnabled ? '🔊 صدا روشن شد' : '🔇 صدا خاموش شد');
    },
    
    getRandomQuote() {
        return this.quotes[Math.floor(Math.random() * this.quotes.length)];
    },
    
    showRandomQuote() {
        const quoteEl = document.getElementById('currentQuote');
        if (quoteEl) {
            quoteEl.textContent = this.getRandomQuote();
            quoteEl.style.animation = 'none';
            quoteEl.offsetHeight;
            quoteEl.style.animation = 'fadeIn 0.5s ease';
        }
    },
    
    renderTaskList() {
        const container = document.getElementById('taskListContainer');
        if (!container) return;
        if (this.taskList.length === 0) {
            container.innerHTML = '<p class="text-secondary text-center">هنوز کاری ثبت نشده</p>';
            return;
        }
        container.innerHTML = this.taskList.map((task, i) => `
            <div class="task-list-item ${task.done ? 'done' : ''}">
                <input type="checkbox" ${task.done ? 'checked' : ''} onchange="Pomodoro.toggleTaskItem(${i})" id="task-${i}">
                <label for="task-${i}">${task.name}</label>
                <span class="task-pomodoros">${task.pomodoros} 🍅</span>
                <button class="btn btn-sm btn-danger" onclick="Pomodoro.removeTaskItem(${i})">✕</button>
            </div>
        `).join('');
        const completed = this.taskList.filter(t => t.done).length;
        const progress = document.getElementById('taskProgress');
        if (progress) progress.textContent = `${completed} از ${this.taskList.length} انجام شده`;
    },
    
    addTaskToToday(taskName) {
        let task = this.taskList.find(t => t.name === taskName);
        if (task) { task.pomodoros++; } else { this.taskList.push({ name: taskName, pomodoros: 1, done: false }); }
        this.saveTaskList();
        this.renderTaskList();
    },
    
    addManualTask() {
        const input = document.getElementById('newTaskInput');
        if (!input || !input.value.trim()) return;
        this.taskList.push({ name: input.value.trim(), pomodoros: 0, done: false });
        input.value = '';
        this.saveTaskList();
        this.renderTaskList();
    },
    
    toggleTaskItem(index) {
        if (this.taskList[index]) { this.taskList[index].done = !this.taskList[index].done; this.saveTaskList(); this.renderTaskList(); }
    },
    
    removeTaskItem(index) { this.taskList.splice(index, 1); this.saveTaskList(); this.renderTaskList(); },
    saveTaskList() { localStorage.setItem('pomodoroTaskList', JSON.stringify(this.taskList)); },
    
    updateLiveStats() {
        const todaySessions = document.getElementById('todaySessionsStat');
        const weekHours = document.getElementById('weekHoursStat');
        const streakDays = document.getElementById('streakDaysStat');
        if (todaySessions) todaySessions.textContent = this.sessionsToday;
        if (weekHours && typeof Storage !== 'undefined') {
            const weekMinutes = Storage.studySessions.filter(s => { const d = new Date(s.date); const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7); return d >= weekAgo; }).reduce((sum, s) => sum + (s.duration || 25), 0);
            weekHours.textContent = (weekMinutes / 60).toFixed(1);
        }
        if (streakDays && typeof Utils !== 'undefined') { streakDays.textContent = Utils.getStreakDays(); }
    },
    
    // ============ LOFI MODE ============
    showLofiOptions() {
        const panel = document.getElementById('lofiPanel');
        if (panel) { panel.style.display = panel.style.display === 'block' ? 'none' : 'block'; }
    },
    
    loadLofiScene(scene) {
        const wrapper = document.getElementById('lofiVideoWrapper');
        const content = document.getElementById('lofiContent');
        const panel = document.getElementById('lofiPanel');
        const musicControls = document.getElementById('lofiMusicControls');
        const container = document.getElementById('lofiContainer');
        if (!wrapper) return;
        wrapper.style.display = 'block';
        if (panel) panel.style.display = 'none';
        if (container) { container.style.background = 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'; }
        if (scene === 'fireplace') { this.startFireplaceEffect(); this.startMusic(); }
        if (content) { content.style.background = 'rgba(0, 0, 0, 0.5)'; content.style.backdropFilter = 'blur(20px)'; content.style.border = '1px solid rgba(255,255,255,0.15)'; content.style.color = '#ffffff'; }
        if (musicControls) musicControls.style.display = 'flex';
        this.showToast('🔥 فضای شومینه فعال شد');
    },
    
    closeLofi() {
        const wrapper = document.getElementById('lofiVideoWrapper');
        const content = document.getElementById('lofiContent');
        const panel = document.getElementById('lofiPanel');
        const musicControls = document.getElementById('lofiMusicControls');
        const container = document.getElementById('lofiContainer');
        if (wrapper) wrapper.style.display = 'none';
        if (panel) panel.style.display = 'none';
        if (container) container.style.background = '';
        if (content) { content.style.background = ''; content.style.backdropFilter = ''; content.style.border = ''; content.style.color = ''; }
        if (musicControls) musicControls.style.display = 'none';
        this.stopFireplaceEffect();
        this.stopMusic();
    },
    
    startFireplaceEffect() {
        const canvas = document.getElementById('lofiCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.parentElement.offsetWidth || 800;
        canvas.height = canvas.parentElement.offsetHeight || 500;
        const particles = [];
        const maxParticles = 60;
        for (let i = 0; i < maxParticles; i++) { particles.push(this.createFireParticle(canvas)); }
        this._fireParticles = particles;
        this._fireAnimating = true;
        const animate = () => {
            if (!this._fireAnimating) return;
            ctx.fillStyle = 'rgba(26, 26, 46, 0.15)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.y -= p.speed;
                p.x += Math.sin(p.y * 0.02) * 0.5;
                p.size -= 0.02;
                p.opacity -= 0.003;
                if (p.y < canvas.height * 0.3 || p.opacity <= 0 || p.size <= 0) { Object.assign(p, this.createFireParticle(canvas)); }
                const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
                gradient.addColorStop(0, `rgba(255, 200, 50, ${p.opacity})`);
                gradient.addColorStop(0.4, `rgba(255, 100, 20, ${p.opacity * 0.7})`);
                gradient.addColorStop(1, `rgba(255, 50, 5, 0)`);
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
                ctx.fillStyle = gradient;
                ctx.fill();
            });
            const glowGradient = ctx.createRadialGradient(canvas.width / 2, canvas.height, 0, canvas.width / 2, canvas.height, canvas.height * 0.4);
            glowGradient.addColorStop(0, 'rgba(255, 150, 30, 0.3)');
            glowGradient.addColorStop(0.5, 'rgba(255, 80, 10, 0.1)');
            glowGradient.addColorStop(1, 'rgba(255, 20, 0, 0)');
            ctx.fillStyle = glowGradient;
            ctx.fillRect(0, canvas.height * 0.6, canvas.width, canvas.height * 0.4);
            requestAnimationFrame(animate);
        };
        animate();
    },
    
    createFireParticle(canvas) {
        return {
            x: canvas.width / 2 + (Math.random() - 0.5) * canvas.width * 0.6,
            y: canvas.height - Math.random() * 30,
            size: Math.random() * 2 + 0.5,
            speed: Math.random() * 1.5 + 0.5,
            opacity: Math.random() * 0.8 + 0.2
        };
    },
    
    stopFireplaceEffect() {
        this._fireAnimating = false;
        const canvas = document.getElementById('lofiCanvas');
        if (canvas) { const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); }
    },
    
    startMusic() {
        if (this._musicPlaying) return;
        try {
            this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this._musicPlaying = true;
            this.playLofiNotes();
        } catch(e) {}
    },
    
    playLofiNotes() {
        if (!this._musicPlaying) return;
        const notes = [262, 294, 330, 349, 392, 440, 494, 523, 587, 659];
        const playNote = () => {
            if (!this._musicPlaying || !this._audioCtx) return;
            const note = notes[Math.floor(Math.random() * notes.length)];
            const duration = Math.random() * 2 + 1.5;
            const delay = Math.random() * 3 + 1;
            const osc = this._audioCtx.createOscillator();
            const gain = this._audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.value = note;
            gain.gain.setValueAtTime(0, this._audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.08, this._audioCtx.currentTime + 0.1);
            gain.gain.linearRampToValueAtTime(0, this._audioCtx.currentTime + duration);
            osc.connect(gain);
            gain.connect(this._audioCtx.destination);
            osc.start();
            osc.stop(this._audioCtx.currentTime + duration);
            setTimeout(playNote, (duration + delay) * 1000);
        };
        playNote();
    },
    
    stopMusic() {
        this._musicPlaying = false;
        if (this._audioCtx) { this._audioCtx.close(); this._audioCtx = null; }
    },
    
    setMusicVolume(value) {},
    toggleMusic() {
        if (this._musicPlaying) { this.stopMusic(); this.showToast('🔇 موسیقی قطع شد'); }
        else { this.startMusic(); this.showToast('🎵 موسیقی پخش شد'); }
    },
    
    getTodayDate() {
        const today = new Date();
        return today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    },
    
    showToast(msg) { if (typeof Utils !== 'undefined') { Utils.showToast(msg); } }
};