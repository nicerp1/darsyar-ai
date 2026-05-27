// ============ UTILITY FUNCTIONS ============
const Utils = {
    showToast(msg, duration = 2500) {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();
        
        const t = document.createElement('div');
        t.className = 'toast';
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => {
            t.style.opacity = '0';
            t.style.transition = 'opacity 0.3s';
            setTimeout(() => t.remove(), 300);
        }, duration);
    },
    
    calculatePercentage() {
        const total = parseInt(document.getElementById('totalQuestions').value) || 0;
        const correct = parseInt(document.getElementById('correctAnswers').value) || 0;
        const wrong = parseInt(document.getElementById('wrongAnswers').value) || 0;
        if (total <= 0) return this.showToast('تعداد کل نامعتبر');
        const unanswered = total - correct - wrong;
        document.getElementById('unanswered').value = unanswered >= 0 ? unanswered : 0;
        if (unanswered < 0) return this.showToast('مجموع پاسخ‌ها بیش از کل است');
        const net = correct - (wrong / 3);
        const pct = Math.max(0, (net / total) * 100);
        document.getElementById('percentageResult').textContent = pct.toFixed(2) + '%';
    },
    
    getTodayDate() {
        const today = new Date();
        return today.getFullYear() + '-' + 
               String(today.getMonth() + 1).padStart(2, '0') + '-' + 
               String(today.getDate()).padStart(2, '0');
    },
    
    getTotalSessions() {
        return Storage.studySessions.length;
    },
    
    getStreakDays() {
        const dates = [...new Set(Storage.studySessions.map(s => s.date))].sort().reverse();
        if (dates.length === 0) return 0;
        let streak = 0;
        const today = new Date();
        for (let i = 0; i < dates.length; i++) {
            const d = new Date(dates[i]);
            d.setDate(d.getDate() + i);
            if (d.toISOString().slice(0, 10) === today.toISOString().slice(0, 10)) {
                streak++;
                today.setDate(today.getDate() - 1);
            } else break;
        }
        return streak;
    },
    
    getExamsToday() {
        const today = new Date().toISOString().slice(0, 10);
        return Storage.examResults.filter(r => r.date.startsWith(today)).length;
    }
};