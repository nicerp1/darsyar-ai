/** StudyMate owner-only student management. */
const Admin = (function () {
    let selectedUsername = null;
    let selectedPayload = null;
    const pd = value => typeof Utils !== 'undefined' ? Utils.toPersianDigits(value) : value;
    const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

    function init() {
        if (Storage.getCurrentUser()?.username !== 'kiankaki') return App.navigate('dashboard');
        renderUsersTable();
        renderStudentList(Storage.getUsers());
        renderAdminStats();
        loadSystemSettings();
    }

    function students() { return Storage.getUsers().filter(user => user.username !== 'kiankaki'); }

    function renderAdminStats() {
        const users = students();
        const active = users.filter(user => (user.xp || 0) > 0).length;
        const gold = users.filter(user => user.plan === 'gold').length;
        const values = [users.length, active, gold, selectedUsername ? 1 : 0];
        ['admin-stat-users', 'admin-stat-cards', 'admin-stat-exams', 'admin-stat-researches'].forEach((id, index) => {
            const element = document.getElementById(id); if (element) element.textContent = pd(values[index]);
        });
    }

    function renderUsersTable() {
        const tbody = document.getElementById('admin-users-tbody');
        if (!tbody) return;
        tbody.innerHTML = students().map(user => `
            <tr>
                <td><button class="admin-user-link" onclick="Admin.selectStudent('${esc(user.username)}')"><span class="admin-avatar">${esc(user.avatar || '👩‍🎓')}</span><span><strong>${esc(user.name)}</strong><small>@${esc(user.username)}</small></span></button></td>
                <td><select class="form-control admin-plan-select" aria-label="پلن ${esc(user.name)}" onchange="Admin.changeUserPlan('${esc(user.username)}', this.value)">
                    <option value="free" ${user.plan === 'free' ? 'selected' : ''}>رایگان</option><option value="silver" ${user.plan === 'silver' ? 'selected' : ''}>نقره‌ای</option><option value="gold" ${user.plan === 'gold' ? 'selected' : ''}>طلایی</option>
                </select></td>
                <td><strong class="admin-xp">${pd(user.xp || 0)} XP</strong><small>سطح ${pd(user.level || 1)}</small></td>
            </tr>`).join('') || '<tr><td colspan="3" class="admin-table-empty">هنوز دانش‌آموزی ثبت‌نام نکرده است.</td></tr>';
    }

    function renderStudentList(users) {
        const container = document.getElementById('admin-student-list');
        if (!container) return;
        container.innerHTML = users.filter(user => user.username !== 'kiankaki').map(user => `
            <button class="admin-student-item ${selectedUsername === user.username ? 'active' : ''}" onclick="Admin.selectStudent('${esc(user.username)}')">
                <span class="admin-avatar">${esc(user.avatar || '👩‍🎓')}</span>
                <span><strong>${esc(user.name)}</strong><small>@${esc(user.username)} · ${esc(user.grade || 'بدون مقطع')}</small></span>
                <span class="material-symbols-outlined" aria-hidden="true">chevron_left</span>
            </button>`).join('') || '<div class="admin-list-empty">کاربری پیدا نشد.</div>';
    }

    function filterStudents(query) {
        const needle = String(query || '').trim().toLowerCase();
        renderStudentList(Storage.getUsers().filter(user => `${user.name} ${user.username}`.toLowerCase().includes(needle)));
    }

    async function selectStudent(username) {
        selectedUsername = username;
        renderStudentList(Storage.getUsers());
        const empty = document.getElementById('admin-student-empty');
        const content = document.getElementById('admin-student-content');
        if (empty) empty.classList.add('hidden');
        if (content) content.classList.remove('hidden');
        setLoading(true);
        try {
            const response = await fetch(`/api/admin-students?username=${encodeURIComponent(username)}`, { credentials: 'same-origin' });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'دریافت اطلاعات انجام نشد.');
            selectedPayload = payload;
            renderStudentDetail();
            renderAdminStats();
        } catch (error) { Utils.showToast(error.message, 'error'); }
        finally { setLoading(false); }
    }

    function setLoading(loading) {
        const button = document.getElementById('admin-program-submit');
        if (button) button.disabled = loading;
    }

    function renderStudentDetail() {
        if (!selectedPayload) return;
        const { student, data } = selectedPayload;
        document.getElementById('admin-selected-name').textContent = student.name || student.username;
        document.getElementById('admin-selected-meta').textContent = `@${student.username} · ${student.grade || 'مقطع ثبت نشده'} · عضویت ${new Date(student.registered_at).toLocaleDateString('fa-IR')}`;
        document.getElementById('admin-selected-plan').textContent = ({ free: 'رایگان', silver: 'نقره‌ای', gold: 'طلایی' })[student.plan] || student.plan;

        const history = Array.isArray(data.study_history) ? data.study_history : [];
        const results = Array.isArray(data.exam_results) ? data.exam_results : [];
        const cards = Array.isArray(data.flashcards) ? data.flashcards : [];
        const manualReports = Array.isArray(data.manual_reports) ? data.manual_reports : [];
        const manualHours = manualReports.reduce((sum, item) => sum + Number(item.minutes || 0), 0) / 60;
        const hours = history.reduce((sum, item) => sum + Number(item.hours || 0), 0) + manualHours;
        const sessions = history.reduce((sum, item) => sum + Number(item.sessions || 0), 0) + manualReports.filter(item => item.status !== 'missed').length;
        const average = results.length ? Math.round(results.reduce((sum, item) => sum + Number(item.scorePercentage || 0), 0) / results.length) : 0;
        const metrics = [
            ['schedule', 'ساعت مطالعه', `${pd(hours.toFixed(1))} ساعت`], ['timer', 'جلسات تمرکز', pd(sessions)],
            ['assignment_turned_in', 'میانگین آزمون', `${pd(average)}٪`], ['style', 'فلش‌کارت‌ها', pd(cards.length)],
            ['local_fire_department', 'تداوم', `${pd(student.streak || 0)} روز`], ['stars', 'امتیاز', `${pd(student.xp || 0)} XP`]
        ];
        document.getElementById('admin-student-metrics').innerHTML = metrics.map(item => `<div class="admin-metric"><span class="material-symbols-outlined" aria-hidden="true">${item[0]}</span><small>${item[1]}</small><strong>${item[2]}</strong></div>`).join('');
        renderProgram(data.schedule || []);
        renderReport(history, results, manualReports);
    }

    function renderProgram(schedule) {
        const container = document.getElementById('admin-program-list');
        const slots = [];
        (Array.isArray(schedule) ? schedule : []).forEach((day, dayIndex) => (day.slots || []).forEach((slot, slotIndex) => {
            if (slot.subject) slots.push({ ...slot, day: day.day, dayIndex, slotIndex });
        }));
        container.innerHTML = slots.map(slot => `<div class="admin-program-item" style="--slot-color:${esc(slot.color || '#0ea5e9')}">
            <div><strong>${esc(slot.subject)}</strong><span>${esc(slot.day)} · ${esc(slot.time)}</span><small>${esc(slot.note || 'بدون توضیح')}</small></div>
            <button class="admin-icon-button" aria-label="حذف ${esc(slot.subject)}" onclick="Admin.removeProgramSlot(${slot.dayIndex}, ${slot.slotIndex})"><span class="material-symbols-outlined" aria-hidden="true">delete</span></button>
        </div>`).join('') || '<div class="admin-list-empty">هنوز برنامه‌ای برای این دانش‌آموز ثبت نشده است.</div>';
    }

    function renderReport(history, results, manualReports) {
        const container = document.getElementById('admin-study-report');
        const historyRows = history.slice(-10).reverse().map(item => `<tr><td>${esc(item.date || '—')}</td><td>${pd(item.hours || 0)} ساعت</td><td>${pd(item.sessions || 0)}</td><td>${esc(Object.keys(item.subjectBreakdown || {}).join('، ') || '—')}</td></tr>`).join('');
        const statusLabels = { completed: 'انجام شد', partial: 'بخشی انجام شد', missed: 'انجام نشد', pending: 'در انتظار' };
        const manualRows = manualReports.slice(-15).reverse().map(item => `<tr><td>${esc(item.date || '—')}</td><td>${esc(item.start || '—')} تا ${esc(item.end || '—')}</td><td>${pd(item.minutes || 0)} دقیقه</td><td><strong>${esc(item.subject || '—')}</strong><small class="admin-report-note">${esc(item.notes || '')}</small></td><td>${esc(statusLabels[item.status] || '—')}</td></tr>`).join('');
        const resultRows = results.slice(-5).reverse().map(item => `<li><span>${esc(item.examTitle || 'آزمون')}</span><strong>${pd(item.scorePercentage || 0)}٪</strong></li>`).join('');
        container.innerHTML = `<div class="admin-report-table-wrap"><h4>گزارش‌های دستی دانش‌آموز</h4><table class="admin-report-table"><thead><tr><th>تاریخ</th><th>بازه</th><th>مدت</th><th>درس و توضیح</th><th>وضعیت</th></tr></thead><tbody>${manualRows || '<tr><td colspan="5">هنوز گزارش دستی ثبت نشده است.</td></tr>'}</tbody></table><h4 class="admin-report-subtitle">گزارش پومودورو</h4><table class="admin-report-table"><thead><tr><th>تاریخ</th><th>زمان</th><th>جلسه</th><th>دروس</th></tr></thead><tbody>${historyRows || '<tr><td colspan="4">هنوز گزارش پومودورو ثبت نشده است.</td></tr>'}</tbody></table></div>
            <div class="admin-exam-summary"><h4>آخرین نتایج آزمون</h4><ul>${resultRows || '<li><span>هنوز آزمونی ثبت نشده است.</span></li>'}</ul></div>`;
    }

    function openStudentSchedule() {
        if (!selectedUsername) return Utils.showToast('ابتدا دانش‌آموز را انتخاب کنید.', 'warning');
        Schedule.openForStudent(selectedUsername);
    }

    async function removeProgramSlot(dayIndex, slotIndex) {
        setLoading(true);
        try {
            const response = await fetch('/api/admin-students', { method: 'DELETE', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: selectedUsername, dayIndex, slotIndex }) });
            const payload = await response.json(); if (!response.ok) throw new Error(payload.error);
            selectedPayload.data.schedule = payload.schedule; renderProgram(payload.schedule); Utils.showToast('بازه برنامه حذف شد.', 'info');
        } catch (error) { Utils.showToast(error.message || 'حذف برنامه انجام نشد.', 'error'); }
        finally { setLoading(false); }
    }

    function changeUserPlan(username, newPlan) {
        const users = Storage.getUsers(), user = users.find(item => item.username === username);
        if (!user) return; user.plan = newPlan; Storage.saveUsers(users); Utils.showToast(`پلن «${user.name}» به‌روزرسانی شد.`, 'success');
    }

    function loadSystemSettings() { const select = document.getElementById('admin-ai-model'); if (select) select.value = Storage.getSettings().aiModel || 'gapgpt-qwen-3.5'; }
    function saveSystemSettings() { const settings = Storage.getSettings(); settings.aiModel = document.getElementById('admin-ai-model')?.value || 'gapgpt-qwen-3.5'; Storage.saveSettings(settings); Utils.showToast('تنظیمات مدل ذخیره شد.', 'success'); }
    function exportBackupJSON() { Utils.showToast('برای امنیت، خروجی کامل داده کاربران از مرورگر غیرفعال است.', 'info'); }
    function resetDemoData() { Utils.showToast('داده آزمایشی در نسخه واقعی غیرفعال است.', 'info'); }

    return { init, filterStudents, selectStudent, openStudentSchedule, removeProgramSlot, changeUserPlan, saveSystemSettings, exportBackupJSON, resetDemoData };
})();
window.Admin = Admin;
