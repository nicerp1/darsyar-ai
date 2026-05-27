// ============ STATISTICS & CHARTS - FINAL FIXED (ALL SESSIONS) ============
const Stats = {
    render() {
        const container = document.getElementById('section-stats');
        if (!container) return;
        
        container.innerHTML = `
            <!-- نمودار -->
            <div class="card">
                <div class="card-header">
                    <span class="card-title">
                        <span class="material-symbols-outlined">bar_chart</span> روند مطالعه (۷ روز گذشته)
                    </span>
                </div>
                <canvas id="studyChart" style="width:100%;height:280px;"></canvas>
                <p class="text-secondary" id="chartExplanation" style="margin-top:0.5rem;"></p>
            </div>
            
            <!-- کارت‌های عددی -->
            <div class="card">
                <div class="card-header">
                    <span class="card-title">
                        <span class="material-symbols-outlined">analytics</span> آمار عددی
                    </span>
                </div>
                <div class="grid-4" id="statsGrid">
                    <div class="stat-card">
                        <div class="stat-card-icon">⏱️</div>
                        <div class="stat-card-value" id="statTodayHours">0</div>
                        <div class="stat-card-label">ساعت مطالعه امروز</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-icon">📊</div>
                        <div class="stat-card-value" id="statWeekHours">0</div>
                        <div class="stat-card-label">ساعت این هفته</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-icon">📝</div>
                        <div class="stat-card-value" id="statTotalExams">0</div>
                        <div class="stat-card-label">آزمون‌های کل</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-icon">🎯</div>
                        <div class="stat-card-value" id="statAvgScore">0%</div>
                        <div class="stat-card-label">میانگین نمرات</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-icon">🔥</div>
                        <div class="stat-card-value" id="statStreak">0</div>
                        <div class="stat-card-label">روز استریک</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-icon">🏆</div>
                        <div class="stat-card-value" id="statBestScore">0%</div>
                        <div class="stat-card-label">بهترین نمره</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-icon">📈</div>
                        <div class="stat-card-value" id="statBestDay">0</div>
                        <div class="stat-card-label">رکورد ساعت در روز</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-icon">📅</div>
                        <div class="stat-card-value" id="statTotalHours">0</div>
                        <div class="stat-card-label">کل ساعت مطالعه</div>
                    </div>
                </div>
            </div>
            
            <!-- تاریخچه آزمون‌ها -->
            <div class="card">
                <div class="card-header">
                    <span class="card-title">
                        <span class="material-symbols-outlined">history</span> تاریخچه آزمون‌ها
                    </span>
                </div>
                <div id="examHistory"></div>
            </div>
            
            <!-- دکمه PDF -->
            <button class="btn btn-accent no-print" onclick="Stats.generatePDF()" style="margin-top:1rem;">
                <span class="material-symbols-outlined">download</span> دانلود گزارش PDF
            </button>
        `;
        
        // رندر نمودار و آمار
        setTimeout(() => {
            this.renderChart();
            this.renderStats();
            this.renderHistory();
        }, 100);
    },
    
    // ============ نمودار خطی (بر حسب ساعت) ============
    renderChart() {
        const canvas = document.getElementById('studyChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.parentElement.offsetWidth;
        canvas.height = 280;
        
        // داده‌های ۷ روز گذشته
        const days = [];
        const dailyMinutes = [];
        
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.getFullYear() + '-' + 
                           String(d.getMonth() + 1).padStart(2, '0') + '-' + 
                           String(d.getDate()).padStart(2, '0');
            
            days.push(d.toLocaleDateString('fa-IR', { weekday: 'short', day: 'numeric' }));
            
            // همه جلسات (live + کامل)
            const total = (Storage.studySessions || [])
                .filter(s => s.date === dateStr)
                .reduce((sum, s) => sum + (s.duration || 25), 0);
            
            dailyMinutes.push(total);
        }
        
        // تبدیل به ساعت
        const dailyHours = dailyMinutes.map(m => m / 60);
        const maxVal = Math.max(...dailyHours, 0.5);
        
        // رسم
        const padLeft = 60, padRight = 20, padTop = 30, padBottom = 60;
        const chartW = canvas.width - padLeft - padRight;
        const chartH = canvas.height - padTop - padBottom;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // خطوط راهنما
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        ctx.font = '12px Kalameh';
        ctx.fillStyle = '#888';
        ctx.textAlign = 'right';
        
        for (let i = 0; i <= 4; i++) {
            const y = padTop + (chartH / 4) * i;
            ctx.beginPath();
            ctx.moveTo(padLeft, y);
            ctx.lineTo(canvas.width - padRight, y);
            ctx.stroke();
            
            const label = (maxVal - (maxVal / 4) * i).toFixed(1);
            ctx.fillText(label + 'h', padLeft - 10, y + 5);
        }
        
        // محور افقی
        ctx.textAlign = 'center';
        ctx.fillStyle = '#555';
        days.forEach((d, i) => {
            const x = padLeft + (chartW / 6) * i;
            ctx.fillText(d, x, canvas.height - 10);
        });
        
        // خط نمودار
        ctx.beginPath();
        ctx.strokeStyle = '#05319e';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        
        dailyHours.forEach((val, i) => {
            const x = padLeft + (chartW / 6) * i;
            const y = padTop + chartH - (val / maxVal) * chartH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
        
        // نقاط
        dailyHours.forEach((val, i) => {
            const x = padLeft + (chartW / 6) * i;
            const y = padTop + chartH - (val / maxVal) * chartH;
            
            ctx.fillStyle = '#05319e';
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#333';
            ctx.font = 'bold 11px Kalameh';
            ctx.fillText(val.toFixed(1) + 'h', x, y - 15);
        });
        
        document.getElementById('chartExplanation').textContent = 
            '📌 محور عمودی بر حسب ساعت مطالعه است (شامل جلسات کامل و نیمه‌تمام).';
    },
    
    // ============ کارت‌های عددی ============
    renderStats() {
        const sessions = Storage.studySessions || [];
        const exams = Storage.examResults || [];
        const today = new Date().toISOString().split('T')[0];
        
        // ساعت مطالعه امروز (همه جلسات)
        const todayMinutes = sessions
            .filter(s => s.date === today)
            .reduce((sum, s) => sum + (s.duration || 25), 0);
        const todayHours = (todayMinutes / 60).toFixed(1);
        
        // ساعت این هفته (همه جلسات)
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekMinutes = sessions
            .filter(s => new Date(s.date) >= weekAgo)
            .reduce((sum, s) => sum + (s.duration || 25), 0);
        const weekHours = (weekMinutes / 60).toFixed(1);
        
        // آزمون‌های کل
        const totalExams = exams.length;
        
        // میانگین نمرات
        const avgScore = totalExams > 0 
            ? (exams.reduce((sum, e) => sum + (e.percentage || 0), 0) / totalExams).toFixed(1) 
            : 0;
        
        // استریک
        const streak = typeof Utils !== 'undefined' ? Utils.getStreakDays() : 0;
        
        // بهترین نمره
        const bestScore = totalExams > 0 
            ? Math.max(...exams.map(e => e.percentage || 0)).toFixed(1) 
            : 0;
        
        // رکورد ساعت در یک روز (همه جلسات)
        const hoursByDay = {};
        sessions.forEach(s => {
            hoursByDay[s.date] = (hoursByDay[s.date] || 0) + (s.duration || 25);
        });
        const bestDayMinutes = Object.values(hoursByDay).length > 0 
            ? Math.max(...Object.values(hoursByDay)) 
            : 0;
        const bestDayHours = (bestDayMinutes / 60).toFixed(1);
        
        // کل ساعت مطالعه (همه جلسات)
        const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration || 25), 0);
        const totalHours = (totalMinutes / 60).toFixed(1);
        
        // آپدیت UI
        document.getElementById('statTodayHours').textContent = todayHours;
        document.getElementById('statWeekHours').textContent = weekHours;
        document.getElementById('statTotalExams').textContent = totalExams;
        document.getElementById('statAvgScore').textContent = avgScore + '%';
        document.getElementById('statStreak').textContent = streak;
        document.getElementById('statBestScore').textContent = bestScore + '%';
        document.getElementById('statBestDay').textContent = bestDayHours;
        document.getElementById('statTotalHours').textContent = totalHours;
    },
    
    // ============ تاریخچه آزمون‌ها ============
    renderHistory() {
        const container = document.getElementById('examHistory');
        if (!container) return;
        
        const exams = Storage.examResults || [];
        
        if (exams.length === 0) {
            container.innerHTML = '<p class="text-secondary" style="text-align:center;padding:1rem;">هنوز آزمونی ثبت نشده است.</p>';
            return;
        }
        
        container.innerHTML = exams.slice().reverse().slice(0, 10).map(r => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:0.7rem 0;border-bottom:1px solid var(--border);">
                <div>
                    <strong>${r.title || 'آزمون'}</strong>
                    <span style="color:var(--text-secondary);font-size:0.8rem;margin-right:0.5rem;">
                        ${new Date(r.date).toLocaleDateString('fa-IR')}
                    </span>
                </div>
                <div style="display:flex;align-items:center;gap:1rem;">
                    <span style="font-size:0.85rem;color:var(--text-secondary);">
                        ✅ ${r.correct || 0} | ❌ ${r.wrong || 0}
                    </span>
                    <span style="font-weight:700;color:${(r.percentage || 0) >= 80 ? 'var(--success)' : (r.percentage || 0) >= 50 ? 'var(--warning)' : 'var(--danger)'};">
                        ${(r.percentage || 0).toFixed(1)}%
                    </span>
                </div>
            </div>
        `).join('');
    },
    
    // ============ PDF ============
    generatePDF() {
        const pdfDate = document.getElementById('pdfDate');
        if (pdfDate) pdfDate.textContent = 'تاریخ: ' + new Date().toLocaleDateString('fa-IR');
        
        const totalHours = document.getElementById('statTotalHours')?.textContent || '0';
        const streak = document.getElementById('statStreak')?.textContent || '0';
        const avgScore = document.getElementById('statAvgScore')?.textContent || '0%';
        
        const pdfContent = document.getElementById('pdfContent');
        if (pdfContent) {
            pdfContent.innerHTML = `
                <div style="display:flex;justify-content:space-around;margin:2rem 0;">
                    <div style="text-align:center;"><h2>${totalHours}</h2><p>ساعت مطالعه</p></div>
                    <div style="text-align:center;"><h2>${streak}</h2><p>روز پیاپی</p></div>
                    <div style="text-align:center;"><h2>${avgScore}</h2><p>میانگین نمرات</p></div>
                </div>
            `;
        }
        
        const pdfReport = document.getElementById('pdfReport');
        if (pdfReport) pdfReport.style.display = 'block';
        window.print();
        setTimeout(() => { if (pdfReport) pdfReport.style.display = 'none'; }, 1000);
    }
};