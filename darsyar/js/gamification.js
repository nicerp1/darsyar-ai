// ============ GAMIFICATION SYSTEM - FIXED ============
const Gamification = {
    ACHIEVEMENTS: [
        { id: 'first_pomodoro', name: 'اولین قدم', desc: 'اولین پومودورو را کامل کن', icon: '👣', condition: () => Pomodoro.sessionsToday >= 1, xp: 10, hidden: false },
        { id: '10_pomodoros', name: 'استقامت', desc: '۱۰ پومودورو در یک روز', icon: '💪', condition: () => Pomodoro.sessionsToday >= 10, xp: 30, hidden: false },
        { id: '50_total', name: 'کارکشته', desc: '۵۰ پومودورو در کل', icon: '🎯', condition: () => Utils.getTotalSessions() >= 50, xp: 50, hidden: false },
        { id: '100_total', name: 'استاد پومودورو', desc: '۱۰۰ پومودورو در کل', icon: '👑', condition: () => Utils.getTotalSessions() >= 100, xp: 100, hidden: false },
        { id: 'first_exam', name: 'آزمون اول', desc: 'اولین آزمون را انجام بده', icon: '📝', condition: () => Storage.examResults.length >= 1, xp: 20, hidden: false },
        { id: 'perfect_score', name: 'عالی', desc: 'در یک آزمون ۱۰۰٪ بگیر', icon: '🌟', condition: () => Storage.examResults.some(r => r.percentage >= 100), xp: 50, hidden: false },
        { id: '7day_streak', name: 'متعهد', desc: '۷ روز پیاپی مطالعه کن', icon: '🔥', condition: () => Utils.getStreakDays() >= 7, xp: 40, hidden: false },
        { id: '30day_streak', name: 'پایدار', desc: '۳۰ روز پیاپی مطالعه کن', icon: '⚡', condition: () => Utils.getStreakDays() >= 30, xp: 100, hidden: false },
    ],
    
    TITLES: [
        { id: 'student', name: 'دانش‌آموز نمونه', icon: '🎓', condition: () => Utils.getTotalSessions() >= 100 },
        { id: 'focus_master', name: 'استاد تمرکز', icon: '🧘', condition: () => (Utils.getTotalSessions() * Pomodoro.workMin / 60) >= 50 },
        { id: 'exam_pro', name: 'آزمون‌دهنده حرفه‌ای', icon: '📋', condition: () => Storage.examResults.length >= 20 },
        { id: 'streak_king', name: 'پادشاه استمرار', icon: '👑', condition: () => Utils.getStreakDays() >= 14 },
    ],
    
    weeklyProgress: JSON.parse(localStorage.getItem('weeklyProgress') || '{"weekStart":"","challenges":[]}'),
    
    addXP(amount) {
        Storage.userProgress.xp += amount;
        const xpNeeded = Storage.userProgress.level * 100;
        while (Storage.userProgress.xp >= xpNeeded) {
            Storage.userProgress.xp -= xpNeeded;
            Storage.userProgress.level++;
            Utils.showToast(`🎉 تبریک! به سطح ${Storage.userProgress.level} رسیدی!`);
        }
        Storage.updateProgress();
        this.updateUI();
    },
    
    checkAchievements() {
        this.ACHIEVEMENTS.forEach(ach => {
            if (!Storage.userProgress.achievements.includes(ach.id) && ach.condition()) {
                Storage.userProgress.achievements.push(ach.id);
                this.addXP(ach.xp);
                Utils.showToast(`🏅 نشان "${ach.name}" رو گرفتی! +${ach.xp}XP`, 4000);
            }
        });
        Storage.updateProgress();
    },
    
    updateUI() {
        const xpNeeded = Storage.userProgress.level * 100;
        const elements = {
            xpDisplay: document.getElementById('xpDisplay'),
            xpToNext: document.getElementById('xpToNext'),
            xpFill: document.getElementById('xpFill'),
            levelBadgeLarge: document.getElementById('levelBadgeLarge'),
            levelDisplay: document.getElementById('levelDisplay'),
            totalHours: document.getElementById('totalHours'),
            streakDays: document.getElementById('streakDays'),
            totalExams: document.getElementById('totalExams'),
            avgScore: document.getElementById('avgScore'),
            progressPercent: document.getElementById('progressPercent'),
            progressFill: document.getElementById('progressFill'),
        };
        
        if (elements.xpDisplay) elements.xpDisplay.textContent = Storage.userProgress.xp;
        if (elements.xpToNext) elements.xpToNext.textContent = xpNeeded;
        if (elements.xpFill) elements.xpFill.style.width = (Storage.userProgress.xp / xpNeeded * 100) + '%';
        if (elements.levelBadgeLarge) elements.levelBadgeLarge.textContent = `🏆 سطح ${Storage.userProgress.level}`;
        if (elements.levelDisplay) elements.levelDisplay.textContent = `🏆 سطح ${Storage.userProgress.level}`;
        if (elements.totalHours) elements.totalHours.textContent = (Utils.getTotalSessions() * Pomodoro.workMin / 60).toFixed(1);
        if (elements.streakDays) elements.streakDays.textContent = Utils.getStreakDays();
        if (elements.totalExams) elements.totalExams.textContent = Storage.examResults.length;
        
        if (elements.avgScore) {
            const avg = Storage.examResults.length > 0 ? 
                (Storage.examResults.reduce((s, r) => s + r.percentage, 0) / Storage.examResults.length).toFixed(1) : 0;
            elements.avgScore.textContent = avg + '%';
        }
        
        if (elements.progressPercent) {
            const total = this.ACHIEVEMENTS.length;
            const unlocked = Storage.userProgress.achievements.length;
            elements.progressPercent.textContent = Math.round((unlocked / total) * 100) + '%';
            if (elements.progressFill) elements.progressFill.style.width = Math.round((unlocked / total) * 100) + '%';
        }
    },
    
    renderAchievements() {
        const grid = document.getElementById('achievementsGrid');
        if (!grid) return;
        
        grid.innerHTML = this.ACHIEVEMENTS.map(ach => {
            const unlocked = Storage.userProgress.achievements.includes(ach.id);
            return `<div class="achievement ${unlocked ? 'unlocked' : 'locked'}">
                <div class="achievement-icon">${ach.icon}</div>
                <div><strong>${ach.name}</strong> ${unlocked ? '✅' : '🔒'}<br><small>${ach.desc} • +${ach.xp}XP</small></div>
            </div>`;
        }).join('');
    },
    
    renderTitles() {
        const container = document.getElementById('titlesContainer');
        if (!container) return;
        
        const unlocked = this.TITLES.filter(t => t.condition());
        container.innerHTML = unlocked.length === 0 ? '<p class="text-secondary">هنوز عنوانی کسب نکردی</p>' :
            unlocked.map(t => `<span class="title-badge">${t.icon} ${t.name}</span>`).join('');
    },
    
    renderHallOfFame() {
        const container = document.getElementById('hallOfFame');
        if (!container) return;
        
        const sessions = Storage.studySessions || [];
        const exams = Storage.examResults || [];
        
        const byDay = {};
        sessions.forEach(s => { byDay[s.date] = (byDay[s.date] || 0) + 1; });
        const bestDay = Object.values(byDay).length > 0 ? Math.max(...Object.values(byDay)) : 0;
        
        const bestScore = exams.length > 0 ? Math.max(...exams.map(e => e.percentage || 0)) : 0;
        const streak = Utils.getStreakDays();
        const totalHours = (sessions.reduce((s, x) => s + (x.duration || 25), 0) / 60).toFixed(1);
        
        container.innerHTML = `
            <div class="fame-item"><span class="fame-medal">🥇</span><span class="fame-value">${bestDay}</span><span class="fame-label">پومودورو در یک روز</span></div>
            <div class="fame-item"><span class="fame-medal">🥈</span><span class="fame-value">${bestScore.toFixed(1)}%</span><span class="fame-label">بهترین نمره</span></div>
            <div class="fame-item"><span class="fame-medal">🥉</span><span class="fame-value">${streak}</span><span class="fame-label">روز استریک</span></div>
            <div class="fame-item"><span class="fame-medal">⏱️</span><span class="fame-value">${totalHours}</span><span class="fame-label">ساعت مطالعه</span></div>
        `;
    },
    
    render() {
        this.updateUI();
        this.renderAchievements();
        this.renderTitles();
        this.renderHallOfFame();
        this.checkAchievements();
    }
};