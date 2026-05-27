// ============ STATISTICS & CHARTS - WITH CHART.JS ============
const Stats = {
    charts: {},
    
    render() {
        const container = document.getElementById('section-stats');
        if (!container) return;
        
        container.innerHTML = `
            <!-- نمودار خطی -->
            <div class="card">
                <div class="card-header">
                    <span class="card-title">📈 روند مطالعه (۷ روز گذشته)</span>
                </div>
                <div style="height:300px;">
                    <canvas id="lineChart"></canvas>
                </div>
                <p class="text-secondary" style="margin-top:0.5rem;">📌 بر حسب ساعت مطالعه در روز</p>
            </div>
            
            <!-- کارت‌های عددی -->
            <div class="card">
                <div class="card-header">
                    <span class="card-title">📊 آمار عددی</span>
                </div>
                <div class="grid-4" style="margin-bottom:1rem;">
                    <div class="stat-card">
                        <div class="stat-card-value" id="statTodayHours">0</div>
                        <div class="stat-card-label">ساعت امروز</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-value" id="statWeekHours">0</div>
                        <div class="stat-card-label">ساعت این هفته</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-value" id="statTotalHours">0</div>
                        <div class="stat-card-label">کل ساعت مطالعه</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-value" id="statStreak">0</div>
                        <div class="stat-card-label">روز استریک</div>
                    </div>
                </div>
            </div>
            
            <!-- نمودار میله‌ای - درس‌ها -->
            <div class="card">
                <div class="card-header">
                    <span class="card-title">📊 مقایسه درس‌ها (این هفته)</span>
                </div>
                <div style="height:280px;">
                    <canvas id="barChart"></canvas>
                </div>
            </div>
            
            <!-- نمودار دایره‌ای -->
            <div class="card">
                <div class="card-header">
                    <span class="card-title">🥧 توزیع زمان مطالعه (این هفته)</span>
                </div>
                <div style="height:300px;">
                    <canvas id="pieChart"></canvas>
                </div>
            </div>
            
            <!-- تاریخچه آزمون‌ها -->
            <div class="card">
                <div class="card-header">
                    <span class="card-title">📋 تاریخچه آزمون‌ها</span>
                </div>
                <div id="examHistory"></div>
            </div>
            
            <button class="btn btn-accent no-print" onclick="Stats.generatePDF()" style="margin-top:1rem;">
                📥 دانلود گزارش PDF
            </button>
        `;
        
        setTimeout(() => {
            this.renderLineChart();
            this.renderBarChart();
            this.renderPieChart();
            this.renderStats();
            this.renderHistory();
        }, 200);
    },
    
    // ============ نمودار خطی ============
    renderLineChart() {
        if (this.charts.line) this.charts.line.destroy();
        
        const ctx = document.getElementById('lineChart');
        if (!ctx) return;
        
        const days = [];
        const hours = [];
        
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
            days.push(d.toLocaleDateString('fa-IR', { weekday: 'short' }));
            
            const total = (Storage.studySessions || []).filter(s => s.date === dateStr).reduce((sum, s) => sum + (s.duration || 25), 0);
            hours.push(parseFloat((total / 60).toFixed(1)));
        }
        
        this.charts.line = new Chart(ctx, {
            type: 'line',
            data: {
                labels: days,
                datasets: [{
                    label: 'ساعت مطالعه',
                    data: hours,
                    borderColor: '#05319e',
                    backgroundColor: 'rgba(5,49,158,0.1)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#05319e',
                    pointRadius: 6,
                    pointHoverRadius: 8,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'ساعت' }
                    }
                }
            }
        });
    },
    
    // ============ نمودار میله‌ای ============
    renderBarChart() {
        if (this.charts.bar) this.charts.bar.destroy();
        
        const ctx = document.getElementById('barChart');
        if (!ctx) return;
        
        // جمع‌آوری داده‌ها بر اساس درس
        const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
        const weekSessions = (Storage.studySessions || []).filter(s => new Date(s.date) >= weekAgo);
        
        const subjects = {};
        weekSessions.forEach(s => {
            const task = s.task || 'نامشخص';
            subjects[task] = (subjects[task] || 0) + (s.duration || 25);
        });
        
        const labels = Object.keys(subjects);
        const data = Object.values(subjects).map(m => parseFloat((m / 60).toFixed(1)));
        const colors = ['#05319e', '#c9a03e', '#0d8043', '#d93025', '#e6a700', '#8e44ad', '#2980b9'];
        
        this.charts.bar = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'ساعت مطالعه',
                    data: data,
                    backgroundColor: colors.slice(0, labels.length),
                    borderRadius: 8,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'ساعت' } }
                }
            }
        });
    },
    
    // ============ نمودار دایره‌ای ============
    renderPieChart() {
        if (this.charts.pie) this.charts.pie.destroy();
        
        const ctx = document.getElementById('pieChart');
        if (!ctx) return;
        
        const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
        const weekSessions = (Storage.studySessions || []).filter(s => new Date(s.date) >= weekAgo);
        
        const subjects = {};
        weekSessions.forEach(s => {
            const task = s.task || 'نامشخص';
            subjects[task] = (subjects[task] || 0) + (s.duration || 25);
        });
        
        const labels = Object.keys(subjects);
        const data = Object.values(subjects);
        const colors = ['#05319e', '#c9a03e', '#0d8043', '#d93025', '#e6a700', '#8e44ad', '#2980b9', '#16a085'];
        
        this.charts.pie = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors.slice(0, labels.length),
                    borderWidth: 2,
                    borderColor: '#fff',
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { padding: 15, usePointStyle: true }
                    }
                }
            }
        });
    },
    
    // ============ کارت‌های عددی ============
    renderStats() {
        const sessions = Storage.studySessions || [];
        const exams = Storage.examResults || [];
        const today = new Date().toISOString().split('T')[0];
        
        const todayMinutes = sessions.filter(s => s.date === today).reduce((sum, s) => sum + (s.duration || 25), 0);
        const todayHours = (todayMinutes / 60).toFixed(1);
        
        const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
        const weekMinutes = sessions.filter(s => new Date(s.date) >= weekAgo).reduce((sum, s) => sum + (s.duration || 25), 0);
        const weekHours = (weekMinutes / 60).toFixed(1);
        
        const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration || 25), 0);
        const totalHours = (totalMinutes / 60).toFixed(1);
        
        const streak = typeof Utils !== 'undefined' ? Utils.getStreakDays() : 0;
        
        document.getElementById('statTodayHours').textContent = todayHours + 'h';
        document.getElementById('statWeekHours').textContent = weekHours + 'h';
        document.getElementById('statTotalHours').textContent = totalHours + 'h';
        document.getElementById('statStreak').textContent = streak + '🔥';
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
                    <span style="color:var(--text-secondary);font-size:0.8rem;margin-right:0.5rem;">${new Date(r.date).toLocaleDateString('fa-IR')}</span>
                </div>
                <div style="display:flex;align-items:center;gap:1rem;">
                    <span style="font-size:0.85rem;">✅ ${r.correct||0} | ❌ ${r.wrong||0}</span>
                    <span style="font-weight:700;color:${(r.percentage||0)>=80?'var(--success)':(r.percentage||0)>=50?'var(--warning)':'var(--danger)'};">${(r.percentage||0).toFixed(1)}%</span>
                </div>
            </div>
        `).join('');
    },
    
    generatePDF() {
        document.getElementById('pdfDate').textContent = 'تاریخ: ' + new Date().toLocaleDateString('fa-IR');
        document.getElementById('pdfContent').innerHTML = `
            <div style="display:flex;justify-content:space-around;margin:2rem 0;">
                <div style="text-align:center;"><h2>${document.getElementById('statTotalHours')?.textContent||'0'}</h2><p>ساعت مطالعه</p></div>
                <div style="text-align:center;"><h2>${document.getElementById('statStreak')?.textContent||'0'}</h2><p>روز پیاپی</p></div>
            </div>
        `;
        document.getElementById('pdfReport').style.display = 'block';
        window.print();
        setTimeout(() => document.getElementById('pdfReport').style.display = 'none', 1000);
    }
};