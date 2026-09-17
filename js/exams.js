/**
 * StudyMate Pro - Online Examination & Dynamic Report Card System
 */

const Exams = (function () {
    let currentExam = null;
    let userAnswers = {}; // { questionId: selectedIndex }
    let flaggedQuestions = {}; // { questionId: boolean }
    let examTimeLeft = 0;
    let examTimerInterval = null;
    let currentQuestionIndex = 0;

    function init() {
        renderExamsList();
    }

    function renderExamsList() {
        const grid = document.getElementById('exams-catalog-grid');
        if (!grid) return;

        const exams = Storage.get('exams', []);
        const pd = typeof Utils !== 'undefined' ? Utils.toPersianDigits : (v => v);

        grid.innerHTML = exams.map(e => `
            <div class="content-card" style="display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <span class="brand-badge">${e.category || 'عمومی'}</span>
                        <span style="font-size: 12px; color: var(--text-dim);">${pd(e.questions ? e.questions.length : 0)} سوال</span>
                    </div>
                    <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 8px; color: var(--text-main);">${e.title}</h3>
                    <p style="font-size: 12.5px; color: var(--text-muted); line-height: 1.5; margin-bottom: 16px;">
                        طراح: ${e.author || 'اساتید درسیار'} | مدت زمان پاسخ‌گویی: ${pd(e.durationMinutes)} دقیقه
                    </p>
                </div>
                <button class="btn-primary" style="width: 100%;" onclick="Exams.startExam('${e.id}')">
                    <span class="material-symbols-outlined">play_circle</span>
                    شروع آزمون آنلاین
                </button>
            </div>
        `).join('');
    }

    function startExam(examId) {
        const exams = Storage.get('exams', []);
        currentExam = exams.find(e => e.id === examId);

        if (!currentExam) {
            if (typeof Utils !== 'undefined') Utils.showToast('آزمون یافت نشد.', 'error');
            return;
        }

        userAnswers = {};
        flaggedQuestions = {};
        currentQuestionIndex = 0;
        examTimeLeft = (currentExam.durationMinutes || 15) * 60;

        document.getElementById('exams-catalog-view').style.display = 'none';
        document.getElementById('exam-active-view').style.display = 'block';
        document.getElementById('exam-report-view').style.display = 'none';

        const titleEl = document.getElementById('exam-active-title');
        if (titleEl) titleEl.textContent = currentExam.title;

        startExamTimer();
        renderQuestion();
        renderQuestionPalette();

        if (typeof Utils !== 'undefined') {
            Utils.playSound('click');
        }
    }

    function startExamTimer() {
        if (examTimerInterval) clearInterval(examTimerInterval);

        const timerDisplay = document.getElementById('exam-active-timer');

        function tick() {
            examTimeLeft--;
            if (timerDisplay && typeof Utils !== 'undefined') {
                timerDisplay.textContent = Utils.formatDuration(examTimeLeft);
            }

            if (examTimeLeft <= 0) {
                clearInterval(examTimerInterval);
                if (typeof Utils !== 'undefined') {
                    Utils.showToast('⏰ زمان آزمون به پایان رسید! کارنامه در حال صدور است.', 'warning');
                }
                submitExam();
            }
        }

        tick();
        examTimerInterval = setInterval(tick, 1000);
    }

    function renderQuestion() {
        if (!currentExam || !currentExam.questions) return;
        const q = currentExam.questions[currentQuestionIndex];
        if (!q) return;

        const qNumberEl = document.getElementById('exam-q-number');
        const qTextEl = document.getElementById('exam-q-text');
        const optionsContainer = document.getElementById('exam-options-container');

        const pd = typeof Utils !== 'undefined' ? Utils.toPersianDigits : (v => v);

        if (qNumberEl) qNumberEl.textContent = `سوال شماره ${pd(currentQuestionIndex + 1)} از ${pd(currentExam.questions.length)}`;
        if (qTextEl && typeof Utils !== 'undefined') {
            qTextEl.innerHTML = Utils.renderKaTeXAndMarkdown(q.text);
        }

        const selectedOpt = userAnswers[q.id];

        if (optionsContainer) {
            optionsContainer.innerHTML = q.options.map((opt, idx) => {
                const isSelected = selectedOpt === idx;
                const renderedOpt = typeof Utils !== 'undefined' ? Utils.renderKaTeXAndMarkdown(opt) : opt;
                return `
                    <div class="exam-option-item ${isSelected ? 'selected' : ''}" onclick="Exams.selectOption('${q.id}', ${idx})">
                        <div class="option-badge-num">${pd(idx + 1)}</div>
                        <div style="flex: 1;">${renderedOpt}</div>
                    </div>
                `;
            }).join('');
        }
    }

    function renderQuestionPalette() {
        const container = document.getElementById('exam-question-palette');
        if (!container || !currentExam) return;

        const pd = typeof Utils !== 'undefined' ? Utils.toPersianDigits : (v => v);

        container.innerHTML = currentExam.questions.map((q, idx) => {
            const isCurrent = idx === currentQuestionIndex;
            const isAnswered = userAnswers[q.id] !== undefined;

            let bgColor = 'var(--bg-surface)';
            let borderColor = 'var(--border-subtle)';

            if (isAnswered) {
                bgColor = 'rgba(16, 185, 129, 0.2)';
                borderColor = '#10b981';
            }
            if (isCurrent) {
                borderColor = 'var(--gold)';
            }

            return `
                <button style="width: 38px; height: 38px; border-radius: var(--radius-sm); border: 2px solid ${borderColor}; background: ${bgColor}; color: var(--text-main); font-weight: 700; cursor: pointer; transition: 0.2s;" onclick="Exams.goToQuestion(${idx})">
                    ${pd(idx + 1)}
                </button>
            `;
        }).join('');
    }

    function selectOption(qId, optIndex) {
        userAnswers[qId] = optIndex;
        renderQuestion();
        renderQuestionPalette();
        if (typeof Utils !== 'undefined') {
            Utils.playSound('click');
        }
    }

    function goToQuestion(idx) {
        currentQuestionIndex = idx;
        renderQuestion();
        renderQuestionPalette();
    }

    function nextQuestion() {
        if (currentQuestionIndex < currentExam.questions.length - 1) {
            currentQuestionIndex++;
            renderQuestion();
            renderQuestionPalette();
        }
    }

    function prevQuestion() {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            renderQuestion();
            renderQuestionPalette();
        }
    }

    function submitExam() {
        if (examTimerInterval) clearInterval(examTimerInterval);

        let correct = 0;
        let wrong = 0;
        let unanswered = 0;

        currentExam.questions.forEach(q => {
            const userChoice = userAnswers[q.id];
            if (userChoice === undefined) {
                unanswered++;
            } else if (userChoice === q.correctIndex) {
                correct++;
            } else {
                wrong++;
            }
        });

        const total = currentExam.questions.length;
        const percentage = Math.max(0, Math.round(((correct - (wrong / 3)) / total) * 100));

        // Save result
        const resultRecord = {
            id: 'res-' + Date.now(),
            examId: currentExam.id,
            examTitle: currentExam.title,
            scorePercentage: percentage,
            correct: correct,
            wrong: wrong,
            unanswered: unanswered,
            total: total,
            date: typeof Utils !== 'undefined' ? Utils.getJalaliDateNumeric() : '1405/06/27'
        };

        const results = Storage.get('exam_results', []);
        results.unshift(resultRecord);
        Storage.set('exam_results', results);

        // Add XP
        Storage.addXP(50 + Math.floor(percentage / 2));

        renderReportCard(resultRecord);

        if (typeof Utils !== 'undefined') {
            Utils.launchConfetti();
        }
    }

    function renderReportCard(record) {
        document.getElementById('exams-catalog-view').style.display = 'none';
        document.getElementById('exam-active-view').style.display = 'none';
        document.getElementById('exam-report-view').style.display = 'block';

        const pd = typeof Utils !== 'undefined' ? Utils.toPersianDigits : (v => v);

        const scoreEl = document.getElementById('report-score-percent');
        const correctEl = document.getElementById('report-correct-count');
        const wrongEl = document.getElementById('report-wrong-count');
        const unansEl = document.getElementById('report-unanswered-count');
        const breakdownContainer = document.getElementById('report-questions-breakdown');

        if (scoreEl) scoreEl.textContent = `${pd(record.scorePercentage)}٪`;
        if (correctEl) correctEl.textContent = pd(record.correct);
        if (wrongEl) wrongEl.textContent = pd(record.wrong);
        if (unansEl) unansEl.textContent = pd(record.unanswered);

        if (breakdownContainer) {
            breakdownContainer.innerHTML = currentExam.questions.map((q, idx) => {
                const userChoice = userAnswers[q.id];
                const isCorrect = userChoice === q.correctIndex;
                const isUnanswered = userChoice === undefined;

                let statusBadge = `<span style="color: var(--success); font-weight: 700;">✅ پاسخ صحیح</span>`;
                if (isUnanswered) {
                    statusBadge = `<span style="color: var(--warning); font-weight: 700;">⚪ بدون پاسخ</span>`;
                } else if (!isCorrect) {
                    statusBadge = `<span style="color: var(--danger); font-weight: 700;">❌ پاسخ نادرست</span>`;
                }

                const userOptText = userChoice !== undefined ? q.options[userChoice] : 'انتخاب نشده';
                const correctOptText = q.options[q.correctIndex];

                return `
                    <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 18px; margin-bottom: 14px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <strong>سوال شماره ${pd(idx + 1)}</strong>
                            <div>${statusBadge}</div>
                        </div>
                        <p style="font-size: 14.5px; line-height: 1.6; margin-bottom: 12px;">${typeof Utils !== 'undefined' ? Utils.renderKaTeXAndMarkdown(q.text) : q.text}</p>
                        <div style="font-size: 13px; margin-bottom: 6px;">
                            <strong>پاسخ شما:</strong> <span style="color: ${isCorrect ? 'var(--success)' : 'var(--danger)'};">${userOptText}</span>
                        </div>
                        <div style="font-size: 13px; margin-bottom: 8px;">
                            <strong>پاسخ صحیح:</strong> <span style="color: var(--gold-light); font-weight: 700;">${correctOptText}</span>
                        </div>
                        ${q.explanation ? `
                            <div style="background: rgba(5, 49, 158, 0.15); border-right: 3px solid var(--gold); padding: 10px 14px; border-radius: 4px; font-size: 12.5px; color: var(--text-muted); margin-top: 8px;">
                                💡 <strong>تحلیل تشریحی استاد:</strong> ${typeof Utils !== 'undefined' ? Utils.renderKaTeXAndMarkdown(q.explanation) : q.explanation}
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');
        }
    }

    function returnToCatalog() {
        document.getElementById('exams-catalog-view').style.display = 'block';
        document.getElementById('exam-active-view').style.display = 'none';
        document.getElementById('exam-report-view').style.display = 'none';
        renderExamsList();
    }

    function openCreateExamModal() {
        if (typeof Utils !== 'undefined') {
            Utils.openModal('modal-create-exam');
        }
    }

    function createExamSubmit() {
        const titleInput = document.getElementById('input-create-exam-title');
        const catSelect = document.getElementById('input-create-exam-cat');
        const durInput = document.getElementById('input-create-exam-dur');
        const q1Text = document.getElementById('input-create-exam-q1');
        const q1Opt1 = document.getElementById('input-create-exam-opt1');
        const q1Opt2 = document.getElementById('input-create-exam-opt2');
        const q1Opt3 = document.getElementById('input-create-exam-opt3');
        const q1Opt4 = document.getElementById('input-create-exam-opt4');
        const q1Correct = document.getElementById('input-create-exam-correct');
        const q1Expl = document.getElementById('input-create-exam-expl');

        if (!titleInput || !titleInput.value.trim() || !q1Text || !q1Text.value.trim()) {
            if (typeof Utils !== 'undefined') {
                Utils.showToast('لطفاً عنوان آزمون و صورت سوال اول را وارد نمایید.', 'warning');
            }
            return;
        }

        const newExam = {
            id: 'exam-' + Date.now(),
            title: titleInput.value.trim(),
            category: catSelect ? catSelect.value : 'زیست',
            durationMinutes: parseInt(durInput ? durInput.value : 10) || 10,
            author: Storage.getCurrentUser()?.name || 'مدیر سامانه',
            questions: [
                {
                    id: 'cq-1',
                    text: q1Text.value.trim(),
                    options: [
                        q1Opt1.value.trim() || 'گزینه اول',
                        q1Opt2.value.trim() || 'گزینه دوم',
                        q1Opt3.value.trim() || 'گزینه سوم',
                        q1Opt4.value.trim() || 'گزینه چهارم'
                    ],
                    correctIndex: parseInt(q1Correct ? q1Correct.value : 0),
                    explanation: q1Expl ? q1Expl.value.trim() : 'پاسخ تشریحی ارائه نشده است.'
                }
            ]
        };

        const exams = Storage.get('exams', []);
        exams.unshift(newExam);
        Storage.set('exams', exams);

        renderExamsList();

        if (typeof Utils !== 'undefined') {
            Utils.closeModal('modal-create-exam');
            Utils.showToast('آزمون جدید با موفقیت طراحی و منتشر گردید!', 'success');
        }
    }

    return {
        init,
        startExam,
        selectOption,
        goToQuestion,
        nextQuestion,
        prevQuestion,
        submitExam,
        returnToCatalog,
        openCreateExamModal,
        createExamSubmit
    };
})();

if (typeof window !== 'undefined') {
    window.Exams = Exams;
}
