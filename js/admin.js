/** Owner-only student operations dashboard. */
const Admin = (function () {
    let selectedUsername = null, selectedPayload = null, allStudents = [], summaries = new Map();
    const pd = value => typeof Utils !== 'undefined' ? Utils.toPersianDigits(value) : value;
    const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
    const summaryOf = username => summaries.get(username) || { status: 'attention', reasons: ['بدون فعالیت'], adherence: 0, planned: 0, completed: 0, missed: 0, reports: 0, reportMinutes: 0 };

    async function init() {
        if (Storage.getCurrentUser()?.username !== 'kiankaki') return App.navigate('dashboard');
        loadSystemSettings(); await refreshOverview(false);
    }

    async function refreshOverview(notify = true) {
        const button = document.getElementById('admin-refresh'); if (button) button.disabled = true;
        try {
            const response = await fetch('/api/admin-students', { credentials: 'same-origin' });
            const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'دریافت اطلاعات انجام نشد.');
            allStudents = payload.students || []; summaries = new Map((payload.summaries || []).map(item => [item.username, item]));
            populateGradeFilter(); applyFilters(); renderUsersTable(); renderAttention(); renderAdminStats();
            if (notify) Utils.showToast('اطلاعات پنل به‌روز شد.', 'success');
        } catch (error) { Utils.showToast(error.message, 'error'); }
        finally { if (button) button.disabled = false; }
    }

    function populateGradeFilter() {
        const select = document.getElementById('admin-grade-filter'); if (!select) return;
        const current = select.value || 'all';
        const grades = [...new Set(allStudents.map(user => user.grade).filter(Boolean))].sort();
        select.innerHTML = '<option value="all">همه مقاطع</option>' + grades.map(grade => `<option value="${esc(grade)}">${esc(grade)}</option>`).join('');
        select.value = grades.includes(current) ? current : 'all';
    }

    function applyFilters() {
        const query = String(document.getElementById('admin-student-search')?.value || '').trim().toLowerCase();
        const status = document.getElementById('admin-status-filter')?.value || 'all';
        const grade = document.getElementById('admin-grade-filter')?.value || 'all';
        renderStudentList(allStudents.filter(user => {
            const summary = summaryOf(user.username);
            return (!query || `${user.name} ${user.username}`.toLowerCase().includes(query)) && (status === 'all' || summary.status === status) && (grade === 'all' || user.grade === grade);
        }));
    }

    function renderStudentList(users) {
        const box = document.getElementById('admin-student-list'); if (!box) return;
        box.innerHTML = users.map(user => { const summary = summaryOf(user.username); return `<button class="admin-student-item ${selectedUsername === user.username ? 'active' : ''}" onclick="Admin.selectStudent('${esc(user.username)}')"><span class="admin-avatar">${esc(user.avatar || '👩‍🎓')}</span><span><strong>${esc(user.name || user.username)}</strong><small>@${esc(user.username)} · ${esc(user.grade || 'بدون مقطع')}</small><small>${summary.status === 'attention' ? esc(summary.reasons.join('، ')) : `پایبندی ${pd(summary.adherence)}٪`}</small></span><span class="admin-state-dot ${summary.status}" title="${summary.status === 'attention' ? 'نیازمند پیگیری' : 'فعال'}"></span></button>`; }).join('') || '<div class="admin-list-empty">دانش‌آموزی با این فیلتر پیدا نشد.</div>';
    }

    function renderAttention() {
        const items = allStudents.filter(user => summaryOf(user.username).status === 'attention').sort((a, b) => summaryOf(b.username).staleDays - summaryOf(a.username).staleDays);
        const box = document.getElementById('admin-attention-list'), count = document.getElementById('admin-attention-count');
        if (count) count.textContent = pd(items.length); if (!box) return;
        box.innerHTML = items.slice(0, 8).map(user => { const summary = summaryOf(user.username); return `<button type="button" class="admin-attention-item" onclick="Admin.selectStudent('${esc(user.username)}')"><span class="material-symbols-outlined" aria-hidden="true">priority_high</span><span><strong>${esc(user.name || user.username)}</strong><small>${esc(summary.reasons.join(' · '))}</small></span><span class="material-symbols-outlined" aria-hidden="true">chevron_left</span></button>`; }).join('') || '<div class="admin-all-good"><span class="material-symbols-outlined" aria-hidden="true">check_circle</span> فعلاً موردی برای پیگیری وجود ندارد.</div>';
    }

    function renderAdminStats() {
        const active = allStudents.filter(user => summaryOf(user.username).status === 'active').length;
        const attention = allStudents.length - active, gold = allStudents.filter(user => user.plan === 'gold').length;
        [allStudents.length, active, gold, attention].forEach((value, index) => { const el = document.getElementById(['admin-stat-users', 'admin-stat-cards', 'admin-stat-exams', 'admin-stat-researches'][index]); if (el) el.textContent = pd(value); });
    }

    function renderUsersTable() {
        const tbody = document.getElementById('admin-users-tbody'); if (!tbody) return;
        tbody.innerHTML = allStudents.map(user => `<tr><td><button class="admin-user-link" onclick="Admin.selectStudent('${esc(user.username)}')"><span class="admin-avatar">${esc(user.avatar || '👩‍🎓')}</span><span><strong>${esc(user.name || user.username)}</strong><small>@${esc(user.username)}</small></span></button></td><td><select class="form-control admin-plan-select" aria-label="پلن ${esc(user.name || user.username)}" onchange="Admin.changeUserPlan('${esc(user.username)}',this.value)"><option value="free" ${user.plan === 'free' ? 'selected' : ''}>رایگان</option><option value="silver" ${user.plan === 'silver' ? 'selected' : ''}>نقره‌ای</option><option value="gold" ${user.plan === 'gold' ? 'selected' : ''}>طلایی</option></select></td><td><strong class="admin-xp">${pd(user.xp || 0)} XP</strong><small>سطح ${pd(user.level || 1)}</small></td></tr>`).join('') || '<tr><td colspan="3" class="admin-table-empty">هنوز دانش‌آموزی ثبت‌نام نکرده است.</td></tr>';
    }

    async function selectStudent(username) {
        selectedUsername = username; applyFilters(); setLoading(true);
        document.getElementById('admin-student-empty')?.classList.add('hidden'); document.getElementById('admin-student-content')?.classList.remove('hidden');
        try {
            const response = await fetch(`/api/admin-students?username=${encodeURIComponent(username)}`, { credentials: 'same-origin' });
            const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'دریافت پرونده انجام نشد.');
            selectedPayload = payload; renderStudentDetail();
        } catch (error) { Utils.showToast(error.message, 'error'); }
        finally { setLoading(false); }
    }

    function setLoading(loading) { ['admin-note-save', 'admin-delete-student'].forEach(id => { const button = document.getElementById(id); if (button) button.disabled = loading; }); }
    function formatDate(value) { return value ? new Date(value).toLocaleDateString('fa-IR') : 'ثبت نشده'; }

    function renderStudentDetail() {
        if (!selectedPayload) return; const { student, data } = selectedPayload, summary = summaryOf(student.username);
        document.getElementById('admin-selected-name').textContent = student.name || student.username;
        document.getElementById('admin-selected-meta').textContent = `@${student.username} · ${student.grade || 'مقطع ثبت نشده'} · عضویت ${formatDate(student.registered_at)} · آخرین فعالیت ${formatDate(summary.latestActivity)}`;
        document.getElementById('admin-selected-plan').textContent = ({ free: 'رایگان', silver: 'نقره‌ای', gold: 'طلایی' })[student.plan] || student.plan;
        const status = document.getElementById('admin-selected-status'); status.textContent = summary.status === 'attention' ? 'نیازمند پیگیری' : 'فعال'; status.className = `admin-status-pill ${summary.status}`;
        const history = Array.isArray(data.study_history) ? data.study_history : [], results = Array.isArray(data.exam_results) ? data.exam_results : [], cards = Array.isArray(data.flashcards) ? data.flashcards : [], reports = Array.isArray(data.manual_reports) ? data.manual_reports : [];
        const pomoHours = history.reduce((sum, item) => sum + Number(item.hours || 0), 0), sessions = history.reduce((sum, item) => sum + Number(item.sessions || 0), 0) + reports.filter(item => item.status !== 'missed').length;
        const average = results.length ? Math.round(results.reduce((sum, item) => sum + Number(item.scorePercentage || 0), 0) / results.length) : 0;
        const metrics = [['task_alt', 'پایبندی برنامه', `${pd(summary.adherence)}٪`], ['schedule', 'کل مطالعه', `${pd((pomoHours + summary.reportMinutes / 60).toFixed(1))} ساعت`], ['timer', 'جلسات ثبت‌شده', pd(sessions)], ['assignment_turned_in', 'میانگین آزمون', `${pd(average)}٪`], ['style', 'فلش‌کارت‌ها', pd(cards.length)], ['event_busy', 'انجام‌نشده', pd(summary.missed)]];
        document.getElementById('admin-student-metrics').innerHTML = metrics.map(item => `<div class="admin-metric"><span class="material-symbols-outlined" aria-hidden="true">${item[0]}</span><small>${item[1]}</small><strong>${item[2]}</strong></div>`).join('');
        const note = data.admin_note || {}; document.getElementById('admin-private-note').value = note.text || ''; document.getElementById('admin-note-updated').textContent = note.updatedAt ? `آخرین ویرایش: ${new Date(note.updatedAt).toLocaleString('fa-IR')}` : 'هنوز یادداشتی ثبت نشده است.';
        renderProgram(data.schedule || []); renderReport(history, results, reports);
    }

    function renderProgram(schedule) {
        const box = document.getElementById('admin-program-list'), slots = [];
        (Array.isArray(schedule) ? schedule : []).forEach((day, dayIndex) => (day.tasks || (day.slots || []).filter(item => item.subject)).forEach((task, taskIndex) => { if (task.subject) slots.push({ ...task, day: day.day, dayIndex, taskIndex }); }));
        box.innerHTML = slots.map(slot => `<div class="admin-program-item" style="--slot-color:${esc(slot.color || '#0ea5e9')}"><div><strong>${esc(slot.subject)}</strong><span>${esc(slot.day)} · تسک ${pd(slot.taskIndex + 1)} · ${pd(slot.durationMinutes || 60)} دقیقه</span><small>${esc(slot.note || 'بدون توضیح')}</small></div><button class="admin-icon-button" aria-label="حذف ${esc(slot.subject)}" onclick="Admin.removeProgramSlot(${slot.dayIndex},${slot.taskIndex})"><span class="material-symbols-outlined" aria-hidden="true">delete</span></button></div>`).join('') || '<div class="admin-list-empty">هنوز برنامه‌ای ثبت نشده است.</div>';
    }

    function renderReport(history, results, reports) {
        const box = document.getElementById('admin-study-report'), labels = { completed: 'انجام شد', partial: 'بخشی انجام شد', missed: 'انجام نشد', pending: 'در انتظار' };
        const manualRows = reports.slice(-15).reverse().map(item => `<tr><td>${esc(item.date || '—')}</td><td>${esc(item.start || '—')} تا ${esc(item.end || '—')}</td><td>${pd(item.minutes || 0)} دقیقه</td><td><strong>${esc(item.subject || '—')}</strong><small class="admin-report-note">${esc(item.notes || '')}</small></td><td>${esc(labels[item.status] || '—')}</td></tr>`).join('');
        const historyRows = history.slice(-10).reverse().map(item => `<tr><td>${esc(item.date || '—')}</td><td>${pd(item.hours || 0)} ساعت</td><td>${pd(item.sessions || 0)}</td><td>${esc(Object.keys(item.subjectBreakdown || {}).join('، ') || '—')}</td></tr>`).join('');
        const exams = results.slice(-5).reverse().map(item => `<li><span>${esc(item.examTitle || 'آزمون')}</span><strong>${pd(item.scorePercentage || 0)}٪</strong></li>`).join('');
        box.innerHTML = `<div class="admin-report-table-wrap"><h4>گزارش‌های دستی</h4><table class="admin-report-table"><thead><tr><th>تاریخ</th><th>بازه</th><th>مدت</th><th>درس</th><th>وضعیت</th></tr></thead><tbody>${manualRows || '<tr><td colspan="5">گزارشی ثبت نشده است.</td></tr>'}</tbody></table><h4 class="admin-report-subtitle">پومودورو</h4><table class="admin-report-table"><thead><tr><th>تاریخ</th><th>زمان</th><th>جلسه</th><th>دروس</th></tr></thead><tbody>${historyRows || '<tr><td colspan="4">گزارشی ثبت نشده است.</td></tr>'}</tbody></table></div><div class="admin-exam-summary"><h4>آخرین آزمون‌ها</h4><ul>${exams || '<li><span>آزمونی ثبت نشده است.</span></li>'}</ul></div>`;
    }

    async function savePrivateNote() {
        if (!selectedUsername) return; setLoading(true);
        try { const note = document.getElementById('admin-private-note').value; const response = await fetch('/api/admin-students', { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'saveNote', username: selectedUsername, note }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error); selectedPayload.data.admin_note = { text: payload.note, updatedAt: new Date().toISOString() }; renderStudentDetail(); Utils.showToast('یادداشت خصوصی ذخیره شد.', 'success'); }
        catch (error) { Utils.showToast(error.message || 'ذخیره یادداشت انجام نشد.', 'error'); } finally { setLoading(false); }
    }

    async function deleteSelectedStudent() {
        if (!selectedUsername || !selectedPayload) return;
        const username = selectedUsername, typed = window.prompt(`این عملیات قابل بازگشت نیست. برای حذف کامل، نام کاربری ${username} را وارد کنید:`);
        if (typed === null) return; if (typed.trim().toLowerCase() !== username) return Utils.showToast('نام کاربری واردشده مطابقت ندارد؛ حذف انجام نشد.', 'warning');
        if (!window.confirm(`تمام اطلاعات @${username} برای همیشه حذف شود؟`)) return;
        setLoading(true);
        try { const response = await fetch('/api/admin-students', { method: 'DELETE', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'deleteStudent', username, confirmation: typed }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error); allStudents = allStudents.filter(user => user.username !== username); summaries.delete(username); Storage.saveUsers(Storage.getUsers().filter(user => user.username !== username)); selectedUsername = null; selectedPayload = null; document.getElementById('admin-student-content').classList.add('hidden'); document.getElementById('admin-student-empty').classList.remove('hidden'); applyFilters(); renderUsersTable(); renderAttention(); renderAdminStats(); Utils.showToast(`حساب @${username} و تمام داده‌هایش حذف شد.`, 'success'); }
        catch (error) { Utils.showToast(error.message || 'حذف دانش‌آموز انجام نشد.', 'error'); } finally { setLoading(false); }
    }

    async function removeProgramSlot(dayIndex, taskIndex) { if (!selectedUsername) return; try { const response = await fetch('/api/admin-students', { method: 'DELETE', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: selectedUsername, dayIndex, taskIndex }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error); selectedPayload.data.schedule = payload.schedule; renderProgram(payload.schedule); Utils.showToast('تسک برنامه حذف شد.', 'info'); } catch (error) { Utils.showToast(error.message, 'error'); } }
    function openStudentSchedule() { if (!selectedUsername) return Utils.showToast('ابتدا دانش‌آموز را انتخاب کنید.', 'warning'); Schedule.openForStudent(selectedUsername); }
    function changeUserPlan(username, plan) { const user = allStudents.find(item => item.username === username); if (!user) return; user.plan = plan; const cached = Storage.getUsers(), found = cached.find(item => item.username === username); if (found) found.plan = plan; Storage.saveUsers(cached); Utils.showToast(`پلن ${user.name || user.username} به‌روزرسانی شد.`, 'success'); }
    function loadSystemSettings() { const select = document.getElementById('admin-ai-model'); if (select) select.value = Storage.getSettings().aiModel || 'gapgpt-qwen-3.5'; }
    function saveSystemSettings() { const settings = Storage.getSettings(); settings.aiModel = document.getElementById('admin-ai-model')?.value || 'gapgpt-qwen-3.5'; Storage.saveSettings(settings); Utils.showToast('تنظیمات مدل ذخیره شد.', 'success'); }
    return { init, refreshOverview, applyFilters, selectStudent, openStudentSchedule, savePrivateNote, deleteSelectedStudent, removeProgramSlot, changeUserPlan, saveSystemSettings };
})();
window.Admin = Admin;
