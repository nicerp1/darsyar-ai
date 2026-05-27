// ============ DASHBOARD SYSTEM - WITH EMOJIS + ANIMATIONS ============
const Dashboard = {
    render() {
        const container = document.getElementById('dashboardContainer');
        if (!container) return;
        
        const user = (typeof Storage !== 'undefined' && Storage.currentUser) ? Storage.currentUser : { name: 'کاربر' };
        const today = new Date().toLocaleDateString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' });
        const stats = this.getStats();
        const quote = this.getRandomQuote();
        const hour = new Date().getHours();
        const greeting = hour < 12 ? 'صبح بخیر' : hour < 18 ? 'روز بخیر' : 'شب بخیر';
        const exams = JSON.parse(localStorage.getItem('upcomingExams') || '[]');
        
        container.innerHTML = `
            <div class="dash">
                <div class="dash-unified">
                    <!-- Header -->
                    <div class="dash-header animate-fadeIn">
                        <h2 class="dash-greeting">👋 ${greeting}، ${user.name}</h2>
                        <p class="dash-date">📅 ${today}</p>
                        <div class="dash-quote-line">${quote.text} — <em>${quote.author}</em></div>
                    </div>
                    
                    <!-- Stats -->
                    <div class="dash-stats-row animate-slideUp">
                        <div class="dash-stat-item">
                            <span class="dash-stat-icon">⏱️</span>
                            <span class="dash-stat-val counter" data-target="${stats.todayHours}">0</span>
                            <span class="dash-stat-lbl">مطالعه امروز</span>
                        </div>
                        <div class="dash-stat-item">
                            <span class="dash-stat-icon">🎯</span>
                            <span class="dash-stat-val counter" data-target="${stats.avgScore}">0</span>
                            <span class="dash-stat-lbl">میانگین نمرات</span>
                        </div>
                        <div class="dash-stat-item">
                            <span class="dash-stat-icon">🔥</span>
                            <span class="dash-stat-val counter" data-target="${stats.streakDays}">0</span>
                            <span class="dash-stat-lbl">روز استریک</span>
                        </div>
                    </div>
                    
                    ${stats.todayHours > 0 ? `
                    <!-- Progress -->
                    <div class="dash-progress-line animate-slideUp">
                        <div class="dash-progress-info"><span>📊 پیشرفت امروز</span><span>${stats.todayHours}h از ${stats.dailyGoal}h</span></div>
                        <div class="dash-progress-bar-wrap"><div class="dash-progress-bar-fill animate-progress" style="width:${Math.min(100, (stats.todayHours / stats.dailyGoal) * 100)}%;"></div></div>
                    </div>` : ''}
                    
                    <!-- Resume -->
                    <div class="dash-resume-line animate-slideUp">
                        <div class="dash-resume-row" onclick="App.setActiveSection('pomodoro')">⏱️ پومودورو →</div>
                        ${stats.cardsToReview > 0 ? `<div class="dash-resume-row" onclick="App.setActiveSection('flashcards')">🃏 فلش‌کارت (${stats.cardsToReview}) →</div>` : ''}
                        ${stats.examsToDo > 0 ? `<div class="dash-resume-row" onclick="App.setActiveSection('exams')">📝 آزمون (${stats.examsToDo}) →</div>` : ''}
                    </div>
                    
                    <!-- Chart -->
                    <div class="dash-chart-line animate-slideUp">
                        <h4 style="margin:0 0 8px;font-size:0.9rem;color:var(--text-secondary);">📈 روند ۷ روز</h4>
                        <canvas id="dashboardMiniChart" style="width:100%;height:120px;"></canvas>
                    </div>
                    
                    <!-- Exam Countdown -->
                    <div class="dash-exam-section animate-slideUp">
                        <div class="dash-exam-header">
                            <h4>📅 یادآور امتحان</h4>
                            <button class="btn btn-sm btn-primary btn-pulse" onclick="Dashboard.showAddExam()">➕ افزودن</button>
                        </div>
                        <div class="dash-exam-list">${exams.length === 0 ? '<p class="dash-empty-text">هیچ امتحانی ثبت نشده</p>' : exams.map((exam, i) => this.renderExamCard(exam, i)).join('')}</div>
                    </div>
                    
                    <!-- Quick Actions -->
                    <div class="dash-quick-line animate-slideUp">
                        <div class="dash-quick-item" onclick="App.setActiveSection('pomodoro'); Dashboard.clickSound();">🎯 پومودورو</div>
                        <div class="dash-quick-item" onclick="App.setActiveSection('ai-assistant'); Dashboard.clickSound();">🤖 AI</div>
                        <div class="dash-quick-item" onclick="App.setActiveSection('flashcards'); Dashboard.clickSound();">🃏 فلش‌کارت</div>
                        <div class="dash-quick-item" onclick="App.setActiveSection('writing'); Dashboard.clickSound();">✍️ انشا</div>
                        <div class="dash-quick-item" onclick="App.setActiveSection('research'); Dashboard.clickSound();">🔬 تحقیق</div>
                        <div class="dash-quick-item" onclick="App.setActiveSection('exams'); Dashboard.clickSound();">📝 آزمون</div>
                    </div>
                </div>
            </div>
        `;
        
        if (exams.length > 0) this.startCountdown();
        setTimeout(() => {
            this.renderMiniChart();
            this.animateCounters();
        }, 300);
    },
    
    animateCounters() {
        document.querySelectorAll('.counter').forEach(counter => {
            const target = parseFloat(counter.dataset.target) || 0;
            const duration = 1000;
            const start = performance.now();
            
            const animate = (now) => {
                const elapsed = now - start;
                const progress = Math.min(elapsed / duration, 1);
                const current = target * progress;
                counter.textContent = target < 10 ? current.toFixed(1) : Math.floor(current);
                if (progress < 1) requestAnimationFrame(animate);
                else counter.textContent = target;
            };
            
            requestAnimationFrame(animate);
        });
    },
    
    clickSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.frequency.value = 800;
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
            osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.1);
        } catch(e) {}
    },
    
    // بقیه توابع مثل قبل...
    renderExamCard(exam, index) {
        const now = new Date();
        const examDate = this.persianToGregorian(exam.date);
        if (!examDate) return '';
        const examDateTime = new Date(examDate + 'T' + (exam.time || '08:00'));
        const diff = examDateTime - now;
        if (diff <= 0) {
            return `<div class="dash-exam-card expired"><div class="dash-exam-info"><strong>${exam.name}</strong><span>${exam.date} - ${exam.time||'۰۸:۰۰'}</span></div><div class="dash-exam-status">✅ برگزار شد</div><button class="dash-exam-delete" onclick="Dashboard.deleteExam(${index})">✕</button></div>`;
        }
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return `<div class="dash-exam-card" id="exam-${index}"><div class="dash-exam-info"><strong>${exam.name}</strong><span>${exam.date} - ${exam.time||'۰۸:۰۰'}</span></div><div class="dash-exam-countdown"><div class="dash-countdown-item"><span class="dash-countdown-val" id="examDays-${index}">${days}</span><span class="dash-countdown-lbl">روز</span></div><div class="dash-countdown-sep">:</div><div class="dash-countdown-item"><span class="dash-countdown-val" id="examHours-${index}">${hours}</span><span class="dash-countdown-lbl">ساعت</span></div><div class="dash-countdown-sep">:</div><div class="dash-countdown-item"><span class="dash-countdown-val" id="examMins-${index}">${String(minutes).padStart(2,'0')}</span><span class="dash-countdown-lbl">دقیقه</span></div></div><button class="dash-exam-delete" onclick="Dashboard.deleteExam(${index})">✕</button></div>`;
    },
    
    persianToGregorian(persianDate) {
        const parts = persianDate.split('/');
        if (parts.length !== 3) return null;
        let jy = parseInt(parts[0]), jm = parseInt(parts[1]), jd = parseInt(parts[2]);
        let gy = jy > 979 ? 1600 : 621;
        if (jy > 979) jy -= 979;
        let days = (365 * jy) + (Math.floor(jy / 33) * 8) + Math.floor(((jy % 33) + 3) / 4) + 78 + jd;
        if (jm < 7) days += (jm - 1) * 31; else days += ((jm - 7) * 30) + 186;
        gy += 400 * Math.floor(days / 146097); days %= 146097;
        if (days > 36524) { days--; gy += 100 * Math.floor(days / 36524); days %= 36524; if (days >= 365) days++; }
        gy += 4 * Math.floor(days / 1461); days %= 1461;
        if (days > 365) { gy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
        const dim = [31, ((gy%4===0&&gy%100!==0)||(gy%400===0))?29:28,31,30,31,30,31,31,30,31,30,31];
        let gm = 0; while (gm < 12 && days >= dim[gm]) { days -= dim[gm]; gm++; }
        return `${gy}-${String(gm+1).padStart(2,'0')}-${String(days+1).padStart(2,'0')}`;
    },
    
    startCountdown() {
        if (this._countdownInterval) clearInterval(this._countdownInterval);
        this._countdownInterval = setInterval(() => {
            const exams = JSON.parse(localStorage.getItem('upcomingExams') || '[]');
            exams.forEach((exam, i) => {
                const examDate = this.persianToGregorian(exam.date);
                if (!examDate) return;
                const diff = new Date(examDate + 'T' + (exam.time || '08:00')) - new Date();
                const dE = document.getElementById(`examDays-${i}`), hE = document.getElementById(`examHours-${i}`), mE = document.getElementById(`examMins-${i}`);
                if (diff <= 0) { if(dE)dE.textContent='0'; if(hE)hE.textContent='0'; if(mE)mE.textContent='00'; return; }
                if(dE)dE.textContent = Math.floor(diff/(1000*60*60*24));
                if(hE)hE.textContent = Math.floor((diff%(1000*60*60*24))/(1000*60*60));
                if(mE)mE.textContent = String(Math.floor((diff%(1000*60*60))/(1000*60))).padStart(2,'0');
            });
        }, 1000);
    },
    
    showAddExam() {
        const now = new Date();
        const persianToday = this.gregorianToPersian(now);
        const [py, pm, pd] = persianToday.split('/').map(Number);
        const modal = document.createElement('div'); modal.className = 'modal-overlay';
        modal.innerHTML = `<div class="modal" style="max-width:450px;"><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button><h3>📅 افزودن امتحان</h3><div class="input-group"><label>نام امتحان</label><input type="text" id="newExamName"></div><div class="input-group"><label>تاریخ</label></div><div class="dash-date-picker" id="datePicker">${this.renderDatePicker(py,pm,pd)}</div><input type="hidden" id="newExamDate" value="${persianToday}"><div class="input-group"><label>ساعت</label><select id="newExamHour" style="width:100%;padding:0.7rem;border-radius:8px;border:1px solid var(--border);">${Array.from({length:24},(_,i)=>`<option value="${String(i).padStart(2,'0')}" ${i===8?'selected':''}>${String(i).padStart(2,'0')}:۰۰</option>`).join('')}</select></div><button class="btn btn-primary" onclick="Dashboard.addExam()">💾 ذخیره</button></div>`;
        document.body.appendChild(modal); modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
        setTimeout(() => this.bindDatePicker(py, pm), 100);
    },
    
    renderDatePicker(year, month, selectedDay) {
        const months = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
        const dim = month <= 6 ? 31 : (month <= 11 ? 30 : (year % 4 === 3 ? 30 : 29));
        const fdow = this.getFirstDayOfWeek(year, month);
        let html = `<div class="dash-calendar"><div class="dash-cal-header"><button class="dash-cal-nav" onclick="Dashboard.changeMonth(-1)">◀</button><span class="dash-cal-title">${months[month-1]} ${year}</span><button class="dash-cal-nav" onclick="Dashboard.changeMonth(1)">▶</button></div><div class="dash-cal-weekdays"><span>ش</span><span>ی</span><span>د</span><span>س</span><span>چ</span><span>پ</span><span>ج</span></div><div class="dash-cal-days">`;
        for (let i=0;i<fdow;i++) html+='<span></span>';
        for (let d=1;d<=dim;d++) html+=`<span class="dash-cal-day ${d===selectedDay?'selected':''}" onclick="Dashboard.selectDay(${d})">${d}</span>`;
        html+=`</div></div>`; return html;
    },
    
    getFirstDayOfWeek(year, month) { const g = this.persianToGregorian(`${year}/${month}/01`); return g ? (new Date(g).getDay()+1)%7 : 0; },
    gregorianToPersian(gDate) {
        const gy=gDate.getFullYear(),gm=gDate.getMonth()+1,gd=gDate.getDate();
        let jy=gy-621; const gDays=[0,31,59,90,120,151,181,212,243,273,304,334];
        let gy2=gm>2?gy+1:gy;
        let days=355666+(365*gy)+Math.floor((gy2+3)/4)-Math.floor((gy2+99)/100)+Math.floor((gy2+399)/400)+gd+gDays[gm-1];
        jy=-1595+(33*Math.floor(days/12053)); days%=12053; jy+=4*Math.floor(days/1461); days%=1461;
        if(days>365){jy+=Math.floor((days-1)/365);days=(days-1)%365;}
        let jm,jd;
        if(days<186){jm=1+Math.floor(days/31);jd=1+(days%31);}else{jm=7+Math.floor((days-186)/30);jd=1+((days-186)%30);}
        return `${jy}/${String(jm).padStart(2,'0')}/${String(jd).padStart(2,'0')}`;
    },
    
    bindDatePicker(y,m){this._pickerYear=y;this._pickerMonth=m;},
    changeMonth(dir){this._pickerMonth+=dir;if(this._pickerMonth<1){this._pickerMonth=12;this._pickerYear--;}if(this._pickerMonth>12){this._pickerMonth=1;this._pickerYear++;}const sd=parseInt(document.getElementById('newExamDate')?.value?.split('/')[2])||1;const p=document.getElementById('datePicker');if(p)p.innerHTML=this.renderDatePicker(this._pickerYear,this._pickerMonth,sd);},
    selectDay(day){const y=this._pickerYear,m=String(this._pickerMonth).padStart(2,'0'),d=String(day).padStart(2,'0');document.getElementById('newExamDate').value=`${y}/${m}/${d}`;const p=document.getElementById('datePicker');if(p)p.innerHTML=this.renderDatePicker(y,this._pickerMonth,day);},
    addExam(){const name=document.getElementById('newExamName')?.value?.trim();const date=document.getElementById('newExamDate')?.value;const hour=document.getElementById('newExamHour')?.value||'08';if(!name||!date)return Utils.showToast('⚠️ نام و تاریخ الزامی');const exams=JSON.parse(localStorage.getItem('upcomingExams')||'[]');exams.push({name,date,time:`${hour}:00`});localStorage.setItem('upcomingExams',JSON.stringify(exams));document.querySelector('.modal-overlay')?.remove();this.render();Utils.showToast('✅ ثبت شد');},
    deleteExam(index){const exams=JSON.parse(localStorage.getItem('upcomingExams')||'[]');exams.splice(index,1);localStorage.setItem('upcomingExams',JSON.stringify(exams));this.render();Utils.showToast('🗑️ حذف شد');},
    
    getStats() {
        const sessions = (typeof Storage !== 'undefined' && Storage.studySessions) ? Storage.studySessions : [];
        const exams = (typeof Storage !== 'undefined' && Storage.examResults) ? Storage.examResults : [];
        const today = new Date().toISOString().split('T')[0];
        const tm = sessions.filter(s => s.date === today).reduce((s, x) => s + (x.duration || 25), 0);
        const avg = exams.length > 0 ? (exams.reduce((s, e) => s + (e.percentage || 0), 0) / exams.length).toFixed(1) : 0;
        const streak = typeof Utils !== 'undefined' ? Utils.getStreakDays() : 0;
        const goal = parseInt(localStorage.getItem('dailyGoal') || '4');
        const cards = typeof Flashcards !== 'undefined' ? Flashcards.getCardsForReview().length : 0;
        const examsTodo = (typeof Storage !== 'undefined' && Storage.exams) ? Storage.exams.length : 0;
        return { todayHours: parseFloat((tm/60).toFixed(1)), avgScore: parseFloat(avg), streakDays: streak, dailyGoal: goal, cardsToReview: cards, examsToDo: examsTodo };
    },
    
    getRandomQuote() {
        const quotes = [
            { text: 'موفقیت، مجموع تلاش‌های کوچک روزانه است', author: 'رابرت کالیر' },
            { text: 'بهترین زمان برای شروع، همین الان است', author: 'ناشناس' },
            { text: 'تمرکز، قدرت واقعی انسان است', author: 'بروس لی' },
            { text: 'نابرده رنج، گنج میسر نمی‌شود', author: 'سعدی' },
        ];
        return quotes[Math.floor(Math.random() * quotes.length)];
    },
    
    renderMiniChart() {
        const canvas = document.getElementById('dashboardMiniChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.parentElement.offsetWidth; canvas.height = 120;
        const sessions = (typeof Storage !== 'undefined' && Storage.studySessions) ? Storage.studySessions : [];
        const values = [];
        for (let i=6;i>=0;i--) { const d=new Date(); d.setDate(d.getDate()-i); const ds=d.toISOString().split('T')[0]; const t=sessions.filter(s=>s.date===ds).reduce((s,x)=>s+(x.duration||25),0); values.push(t/60); }
        const maxV=Math.max(...values,0.5), w=canvas.width-20, h=canvas.height-20, sx=w/6;
        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.beginPath(); ctx.strokeStyle='#05319e'; ctx.lineWidth=2;
        values.forEach((v,i)=>{const x=20+sx*i, y=5+h-(v/maxV)*h; if(i===0)ctx.moveTo(x,y); else ctx.lineTo(x,y);});
        ctx.stroke();
    }
};