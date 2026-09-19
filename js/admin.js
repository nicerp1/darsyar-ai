/** Counseling operations center for owner and advisor accounts. */
const Admin = (function () {
    let students = [], summaries = new Map(), selectedUsername = '', selectedPayload = null, accountType = 'advisor';
    const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
    const pd = value => typeof Utils !== 'undefined' ? Utils.toPersianDigits(value) : value;
    const summaryOf = username => summaries.get(username) || { status: 'attention', reasons: ['بدون فعالیت'], adherence: 0, completed: 0, missed: 0, reportMinutes: 0 };
    const formatDate = value => value ? new Date(value).toLocaleDateString('fa-IR') : 'بدون فعالیت';

    async function init() { configureRoleUI(); await refreshOverview(false); }
    function configureRoleUI() {
        const user = Storage.getCurrentUser(); accountType = user?.accountType || (user?.username === 'kiankaki' ? 'admin' : 'advisor');
        const owner = accountType === 'admin';
        document.getElementById('advisor-link-card')?.classList.toggle('hidden', owner);
        document.getElementById('admin-system-settings')?.classList.toggle('hidden', !owner);
        document.getElementById('advisor-unlink-student')?.classList.toggle('hidden', owner);
        document.getElementById('admin-delete-student')?.classList.toggle('hidden', !owner);
        document.getElementById('admin-plan-control')?.classList.toggle('hidden', !owner);
        document.getElementById('admin-role-title').textContent = owner ? 'مرکز مدیریت پلتفرم' : 'پنل مشاوره درسیار';
        document.getElementById('admin-role-subtitle').textContent = owner ? 'نمای کلی دانش‌آموزان، کیفیت سرویس و عملیات آموزشی.' : 'دانش‌آموزها، برنامه‌ها و گزارش‌های مطالعه را یک‌جا مدیریت کنید.';
        const model = document.getElementById('admin-ai-model'); if (model) model.value = Storage.getSettings().aiModel || 'gapgpt-qwen-3.5';
    }
    async function request(url, options = {}) {
        const response = await fetch(url, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
        const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error || 'عملیات انجام نشد.'); return payload;
    }
    async function refreshOverview(notify = true) {
        const button = document.getElementById('admin-refresh'); if (button) button.disabled = true;
        try {
            const payload = await request('/api/admin-students'); students = payload.students || []; accountType = payload.accountType || accountType;
            summaries = new Map((payload.summaries || []).map(item => [item.username, item])); Storage.saveUsers(students);
            populateGradeFilter(); applyFilters(); renderPriority(); renderStats(); configureRoleUI();
            if (selectedUsername && students.some(item => item.username === selectedUsername)) await selectStudent(selectedUsername, false); else if (!students.length) clearSelection();
            if (notify) Utils.showToast('اطلاعات تازه شد.', 'success');
        } catch (error) { Utils.showToast(error.message, 'error'); } finally { if (button) button.disabled = false; }
    }
    function populateGradeFilter() {
        const select = document.getElementById('admin-grade-filter'); if (!select) return; const selected = select.value;
        const grades = [...new Set(students.map(item => item.grade).filter(Boolean))]; select.innerHTML = '<option value="all">همه مقاطع</option>' + grades.map(grade => `<option value="${esc(grade)}">${esc(grade)}</option>`).join(''); if (grades.includes(selected)) select.value = selected;
    }
    function applyFilters() {
        const query = String(document.getElementById('admin-student-search')?.value || '').trim().toLowerCase();
        const status = document.getElementById('admin-status-filter')?.value || 'all', grade = document.getElementById('admin-grade-filter')?.value || 'all';
        const filtered = students.filter(student => (!query || `${student.name} ${student.username}`.toLowerCase().includes(query)) && (status === 'all' || summaryOf(student.username).status === status) && (grade === 'all' || student.grade === grade));
        renderStudentList(filtered); const count = document.getElementById('admin-roster-count'); if (count) count.textContent = `${pd(filtered.length)} نفر`;
    }
    function renderStudentList(items) {
        const box = document.getElementById('admin-student-list'); if (!box) return;
        box.innerHTML = items.map(student => { const attention = summaryOf(student.username).status === 'attention'; return `<button type="button" class="counselor-student ${selectedUsername === student.username ? 'active' : ''}" onclick="Admin.selectStudent('${esc(student.username)}')"><span class="counselor-list-avatar">${esc((student.name || student.username).slice(0, 1))}</span><span class="counselor-list-copy"><strong>${esc(student.name || student.username)}</strong><small>@${esc(student.username)} · ${esc(student.grade || 'بدون مقطع')}</small></span><span class="counselor-state ${attention ? 'attention' : 'active'}" aria-label="${attention ? 'نیازمند پیگیری' : 'فعال'}"></span></button>`; }).join('') || '<div class="counselor-list-empty"><span class="material-symbols-outlined" aria-hidden="true">group_off</span><p>دانش‌آموزی در این فهرست نیست.</p></div>';
    }
    function renderPriority() {
        const box = document.getElementById('admin-attention-list'); if (!box) return; const items = students.filter(item => summaryOf(item.username).status === 'attention').slice(0, 3);
        box.innerHTML = items.length ? `<span>اولویت پیگیری</span>${items.map(item => `<button type="button" onclick="Admin.selectStudent('${esc(item.username)}')">${esc(item.name || item.username)}<small>${esc(summaryOf(item.username).reasons?.[0] || 'نیازمند بررسی')}</small></button>`).join('')}` : '';
    }
    function renderStats() {
        const active = students.filter(item => summaryOf(item.username).status === 'active').length, completed = students.reduce((sum, item) => sum + Number(summaryOf(item.username).completed || 0), 0), attention = students.length - active;
        [['admin-stat-users', students.length], ['admin-stat-cards', active], ['admin-stat-exams', completed], ['admin-stat-researches', attention]].forEach(([id, value]) => { const el = document.getElementById(id); if (el) el.textContent = pd(value); });
    }
    async function selectStudent(username, notify = true) {
        selectedUsername = String(username || '').trim().toLowerCase(); applyFilters();
        try { selectedPayload = await request(`/api/admin-students?username=${encodeURIComponent(selectedUsername)}`); renderStudentDetail(); if (notify) Utils.showToast('پرونده دانش‌آموز باز شد.', 'info'); } catch (error) { Utils.showToast(error.message, 'error'); }
    }
    function clearSelection() { selectedUsername = ''; selectedPayload = null; document.getElementById('admin-student-content')?.classList.add('hidden'); document.getElementById('admin-student-empty')?.classList.remove('hidden'); }
    function renderStudentDetail() {
        if (!selectedPayload) return; const { student, data } = selectedPayload, summary = summaryOf(student.username);
        document.getElementById('admin-student-empty')?.classList.add('hidden'); document.getElementById('admin-student-content')?.classList.remove('hidden');
        document.getElementById('admin-selected-avatar').textContent = (student.name || student.username).slice(0, 1); document.getElementById('admin-selected-name').textContent = student.name || student.username;
        document.getElementById('admin-selected-meta').textContent = `@${student.username} · ${student.grade || 'مقطع ثبت نشده'} · عضویت ${formatDate(student.registered_at)} · آخرین فعالیت ${formatDate(summary.latestActivity)}`;
        document.getElementById('admin-selected-plan').textContent = ({ free: 'رایگان', silver: 'نقره‌ای', gold: 'طلایی' })[student.plan] || 'رایگان';
        const planControl = document.getElementById('admin-plan-control'); if (planControl) planControl.value = student.plan || 'free';
        const status = document.getElementById('admin-selected-status'); status.textContent = summary.status === 'attention' ? 'نیازمند پیگیری' : 'فعال'; status.className = `admin-status-pill ${summary.status}`;
        const history = Array.isArray(data.study_history) ? data.study_history : [], results = Array.isArray(data.exam_results) ? data.exam_results : [], cards = Array.isArray(data.flashcards) ? data.flashcards : [], reports = Array.isArray(data.manual_reports) ? data.manual_reports : [];
        const hours = history.reduce((sum, item) => sum + Number(item.hours || 0), 0) + summary.reportMinutes / 60, sessions = history.reduce((sum, item) => sum + Number(item.sessions || 0), 0) + reports.filter(item => item.status !== 'missed').length;
        const average = results.length ? Math.round(results.reduce((sum, item) => sum + Number(item.scorePercentage || 0), 0) / results.length) : 0;
        const metrics = [['task_alt','پایبندی',`${pd(summary.adherence)}٪`],['schedule','کل مطالعه',`${pd(hours.toFixed(1))} ساعت`],['timer','جلسه‌ها',pd(sessions)],['quiz','میانگین آزمون',results.length ? `${pd(average)}٪` : '—'],['style','فلش‌کارت',pd(cards.length)],['event_busy','انجام‌نشده',pd(summary.missed)]];
        document.getElementById('admin-student-metrics').innerHTML = metrics.map(([icon,label,value]) => `<article><span class="material-symbols-outlined" aria-hidden="true">${icon}</span><small>${label}</small><strong>${value}</strong></article>`).join('');
        const note = data.admin_note || {}; document.getElementById('admin-private-note').value = note.text || ''; document.getElementById('admin-note-updated').textContent = note.updatedAt ? `ویرایش ${new Date(note.updatedAt).toLocaleString('fa-IR')}` : 'هنوز یادداشتی ثبت نشده است.';
        renderProgram(data.schedule || []); renderReport(history, results, reports);
    }
    function renderProgram(schedule) {
        const box = document.getElementById('admin-program-list'), tasks = []; (Array.isArray(schedule) ? schedule : []).forEach(day => (day.tasks || (day.slots || []).filter(item => item.subject)).forEach((task, index) => task.subject && tasks.push({ ...task, day: day.day, index })));
        box.innerHTML = tasks.slice(0, 8).map(task => `<article class="counselor-task" style="--task-color:${esc(task.color || '#2856d8')}"><span>${pd(task.index + 1)}</span><div><strong>${esc(task.subject)}</strong><small>${esc(task.day)} · ${pd(task.durationMinutes || 60)} دقیقه</small></div><em>${esc(({completed:'انجام شد',partial:'نیمه‌تمام',missed:'انجام نشد',pending:'در انتظار'})[task.status] || 'در انتظار')}</em></article>`).join('') || '<div class="counselor-list-empty"><p>هنوز برنامه‌ای ثبت نشده است.</p></div>';
    }
    function renderReport(history, results, reports) {
        const box = document.getElementById('admin-study-report'); const rows = reports.slice(-12).reverse().map(item => `<tr><td>${esc(item.date || '—')}</td><td><strong>${esc(item.subject || '—')}</strong><small>${esc(item.notes || '')}</small></td><td>${esc(item.start || '—')}–${esc(item.end || '—')}</td><td>${pd(item.minutes || 0)} دقیقه</td><td><span class="report-status ${esc(item.status || 'completed')}">${esc(({completed:'انجام شد',partial:'نیمه‌تمام',missed:'انجام نشد'})[item.status] || 'ثبت‌شده')}</span></td></tr>`).join('');
        const exams = results.slice(-5).reverse().map(item => `<li><span>${esc(item.examTitle || 'آزمون')}</span><strong>${pd(item.scorePercentage || 0)}٪</strong></li>`).join('');
        box.innerHTML = `<div class="counselor-report-table"><table><thead><tr><th>تاریخ</th><th>درس و توضیح</th><th>بازه</th><th>مدت</th><th>نتیجه</th></tr></thead><tbody>${rows || '<tr><td colspan="5">هنوز گزارش دستی ثبت نشده است.</td></tr>'}</tbody></table></div><aside><h5>آخرین آزمون‌ها</h5><ul>${exams || '<li><span>آزمونی ثبت نشده است.</span></li>'}</ul><p>${pd(history.length)} روز سابقه پومودورو ثبت شده است.</p></aside>`;
    }
    async function linkStudent() {
        const input = document.getElementById('advisor-link-username'), button = document.getElementById('advisor-link-submit'), username = input?.value.trim().toLowerCase(); if (!/^[a-z0-9_.-]{3,32}$/.test(username || '')) return Utils.showToast('نام کاربری معتبر وارد کنید.', 'warning'); if (button) button.disabled = true;
        try { await request('/api/admin-students', { method: 'POST', body: JSON.stringify({ action: 'linkStudent', username }) }); input.value = ''; await refreshOverview(false); await selectStudent(username, false); Utils.showToast('دانش‌آموز به پنل شما اضافه شد.', 'success'); } catch (error) { Utils.showToast(error.message, 'error'); } finally { if (button) button.disabled = false; }
    }
    async function unlinkSelectedStudent() {
        if (!selectedUsername || !confirm(`ارتباط شما با @${selectedUsername} قطع شود؟ اطلاعات دانش‌آموز حذف نخواهد شد.`)) return;
        try { await request('/api/admin-students', { method: 'DELETE', body: JSON.stringify({ action: 'unlinkStudent', username: selectedUsername }) }); students = students.filter(item => item.username !== selectedUsername); clearSelection(); applyFilters(); renderPriority(); renderStats(); Storage.saveUsers(students); Utils.showToast('ارتباط با دانش‌آموز قطع شد.', 'info'); } catch (error) { Utils.showToast(error.message, 'error'); }
    }
    async function savePrivateNote() {
        if (!selectedUsername) return; const button = document.getElementById('admin-note-save'); if (button) button.disabled = true;
        try { const payload = await request('/api/admin-students', { method: 'PATCH', body: JSON.stringify({ action: 'saveNote', username: selectedUsername, note: document.getElementById('admin-private-note').value }) }); document.getElementById('admin-note-updated').textContent = `همین حالا توسط ${Storage.getCurrentUser().name || Storage.getCurrentUser().username}`; selectedPayload.data.admin_note = { text: payload.note, updatedAt: new Date().toISOString() }; Utils.showToast('یادداشت ذخیره شد.', 'success'); } catch (error) { Utils.showToast(error.message, 'error'); } finally { if (button) button.disabled = false; }
    }
    function openStudentSchedule() { if (selectedUsername) Schedule.openForStudent(selectedUsername); }
    function openStudentChat() { if (!selectedUsername) return; Communications.selectStudent(selectedUsername); Communications.open('chat'); }
    function saveSystemSettings() { const settings = Storage.getSettings(); settings.aiModel = document.getElementById('admin-ai-model')?.value || 'gapgpt-qwen-3.5'; Storage.saveSettings(settings); Utils.showToast('مدل هوش مصنوعی ذخیره شد.', 'success'); }
    async function changeSelectedPlan(plan) {
        if (accountType !== 'admin' || !selectedPayload || !['free','silver','gold'].includes(plan)) return;
        try { await request('/api/users', { method: 'PUT', body: JSON.stringify({ user: { ...selectedPayload.student, plan } }) }); selectedPayload.student.plan = plan; const match = students.find(item => item.username === selectedUsername); if (match) match.plan = plan; renderStudentDetail(); Utils.showToast('اشتراک دانش‌آموز تغییر کرد.', 'success'); } catch (error) { Utils.showToast(error.message, 'error'); }
    }
    async function deleteSelectedStudent() {
        if (accountType !== 'admin' || !selectedUsername) return; const username = selectedUsername, typed = prompt(`برای حذف دائمی، نام کاربری ${username} را وارد کنید:`); if (typed?.trim().toLowerCase() !== username) return Utils.showToast('حذف لغو شد.', 'warning'); if (!confirm(`تمام اطلاعات @${username} برای همیشه حذف شود؟`)) return;
        try { await request('/api/admin-students', { method: 'DELETE', body: JSON.stringify({ action: 'deleteStudent', username, confirmation: typed }) }); students = students.filter(item => item.username !== username); clearSelection(); applyFilters(); renderPriority(); renderStats(); Storage.saveUsers(students); Utils.showToast('حساب و داده‌های دانش‌آموز حذف شد.', 'success'); } catch (error) { Utils.showToast(error.message, 'error'); }
    }
    return { init, refreshOverview, applyFilters, selectStudent, linkStudent, unlinkSelectedStudent, savePrivateNote, openStudentSchedule, openStudentChat, saveSystemSettings, changeSelectedPlan, deleteSelectedStudent };
})();
window.Admin = Admin;
