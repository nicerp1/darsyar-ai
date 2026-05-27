// ============ EXAM SYSTEM ============
const Exams = {
    currentExam: null,
    examAnswers: {},
    examTimer: null,
    examTimeLeft: 0,
    
    renderList() {
        document.getElementById('examTakingArea').style.display = 'none';
        const list = document.getElementById('examsList');
        list.style.display = '';
        if (Storage.exams.length === 0) {
            list.innerHTML = '<div class="card"><p>آزمونی موجود نیست</p></div>';
        } else {
            list.innerHTML = Storage.exams.map((ex, i) => `
                <div class="card" style="cursor:pointer;" onclick="Exams.start(${i})">
                    <h3>📝 ${ex.title}</h3>
                    <p>⏱️ ${ex.duration} دقیقه | 📊 ${ex.questions.length} سوال</p>
                    <button class="btn btn-primary">شروع آزمون</button>
                </div>`).join('');
        }
    },
    
    start(idx) {
        this.currentExam = Storage.exams[idx];
        this.examAnswers = {};
        this.examTimeLeft = this.currentExam.duration * 60;
        
        document.getElementById('examsList').style.display = 'none';
        const area = document.getElementById('examTakingArea');
        area.style.display = 'block';
        area.innerHTML = `<div class="card">
            <div style="display:flex;justify-content:space-between;">
                <h3>${this.currentExam.title}</h3>
                <span id="examTimerDisplay"></span>
            </div>
            ${this.currentExam.questions.map((q, qi) => `
                <div style="margin:1rem 0;padding:1rem;border-radius:12px;background:var(--card-bg);">
                    <p><strong>${qi+1}.</strong> ${q.text}</p>
                    ${q.options.map((opt, oi) => `<div onclick="Exams.selectAnswer(${qi},${oi})" id="opt-${qi}-${oi}" style="padding:0.5rem;margin:0.2rem 0;border-radius:8px;cursor:pointer;border:1px solid #ccc;">${String.fromCharCode(65+oi)}) ${opt}</div>`).join('')}
                </div>`).join('')}
            <button class="btn btn-success" onclick="Exams.submit()">پایان آزمون</button>
        </div>`;
        
        this.updateTimer();
        this.examTimer = setInterval(() => {
            this.examTimeLeft--;
            this.updateTimer();
            if (this.examTimeLeft <= 0) {
                clearInterval(this.examTimer);
                Utils.showToast('⏰ زمان تمام شد');
                this.submit();
            }
        }, 1000);
    },
    
    updateTimer() {
        const m = Math.floor(this.examTimeLeft / 60), s = this.examTimeLeft % 60;
        const el = document.getElementById('examTimerDisplay');
        if (el) el.textContent = `⏱️ ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    },
    
    selectAnswer(qIdx, oIdx) {
        this.examAnswers[qIdx] = oIdx;
        document.querySelectorAll(`[id^="opt-${qIdx}-"]`).forEach(el => el.style.background = '');
        const selectedEl = document.getElementById(`opt-${qIdx}-${oIdx}`);
        if (selectedEl) selectedEl.style.background = '#dfe6e9';
    },
    
    submit() {
        clearInterval(this.examTimer);
        let correct = 0, wrong = 0;
        
        this.currentExam.questions.forEach((q, qi) => {
            const user = this.examAnswers[qi];
            const correctIdx = q.correct;
            if (user === correctIdx) correct++;
            else if (user !== undefined) wrong++;
            if (user !== undefined) {
                const userEl = document.getElementById(`opt-${qi}-${user}`);
                if (userEl) userEl.style.background = user === correctIdx ? '#b8f5d6' : '#f8d7da';
            }
            const correctEl = document.getElementById(`opt-${qi}-${correctIdx}`);
            if (correctEl) correctEl.style.background = '#b8f5d6';
        });
        
        const net = correct - (wrong / 3);
        const pct = Math.max(0, (net / this.currentExam.questions.length) * 100);
        
        Storage.examResults.push({
            title: this.currentExam.title,
            date: new Date().toISOString(),
            total: this.currentExam.questions.length,
            correct,
            wrong,
            percentage: pct
        });
        Storage.updateExamResults();
        
        // گیمیفیکیشن
        if (typeof Gamification !== 'undefined') {
            Gamification.addXP(20);
            Gamification.checkAchievements();
        }
        
        // تعامل با پت
        if (typeof StudyPet !== 'undefined') {
            StudyPet.onExamComplete(pct);
        }
        
        const area = document.getElementById('examTakingArea');
        area.innerHTML += `
            <div class="card" style="margin-top:1rem;">
                <h3>📊 کارنامه</h3>
                <table style="width:100%;border-collapse:collapse;">
                    <tr><th>#</th><th>سوال</th><th>پاسخ شما</th><th>صحیح</th><th>نتیجه</th></tr>
                    ${this.currentExam.questions.map((q, qi) => `
                        <tr style="border-bottom:1px solid #ddd;">
                            <td>${qi+1}</td>
                            <td>${q.text.substring(0,25)}...</td>
                            <td>${this.examAnswers[qi] !== undefined ? String.fromCharCode(65+this.examAnswers[qi]) : '-'}</td>
                            <td>${String.fromCharCode(65+q.correct)}</td>
                            <td>${this.examAnswers[qi] === q.correct ? '✅' : (this.examAnswers[qi] !== undefined ? '❌' : '⬜')}</td>
                        </tr>`).join('')}
                </table>
                <p>✅ درست: ${correct} | ❌ غلط: ${wrong} | ⬜ نزده: ${this.currentExam.questions.length - correct - wrong}</p>
                <p style="font-size:1.8rem;font-weight:800;">${pct.toFixed(2)}%</p>
                <button class="btn btn-primary" onclick="Exams.renderList()">بازگشت</button>
            </div>`;
    }
};