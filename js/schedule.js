/** Day-first study plan with advisor-estimated task durations. */
const Schedule = (function () {
    let editDay = 0, editTask = -1, adminTarget = null, adminSchedule = null, requestedTarget = null;
    const days = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
    const statuses = { pending: ['در انتظار', 'schedule-status-pending'], completed: ['انجام شد', 'schedule-status-completed'], partial: ['بخشی انجام شد', 'schedule-status-partial'], missed: ['انجام نشد', 'schedule-status-missed'] };
    const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
    const blank = () => days.map((day, dayIndex) => ({ day, dayIndex, tasks: [] }));
    const localDate = () => { const now = new Date(), offset = now.getTimezoneOffset(); return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10); };

    function normalize(source) {
        const stored = source || Storage.get('schedule', []);
        if (!Array.isArray(stored) || stored.length !== 7) return blank();
        return days.map((day, dayIndex) => {
            const legacy = Array.isArray(stored[dayIndex]?.slots) ? stored[dayIndex].slots : [];
            const tasks = Array.isArray(stored[dayIndex]?.tasks) ? stored[dayIndex].tasks : legacy.filter(item => item?.subject);
            return { day, dayIndex, tasks: tasks.filter(Boolean).map((task, index) => ({
                id: task.id || `task-${dayIndex}-${index}-${Date.now()}`,
                subject: String(task.subject || '').slice(0, 100), note: String(task.note || '').slice(0, 300),
                durationMinutes: Math.min(600, Math.max(5, Number(task.durationMinutes) || 60)),
                color: /^#[0-9a-f]{6}$/i.test(task.color) ? task.color : '#2856d8',
                status: statuses[task.status] ? task.status : 'pending', assignedBy: task.assignedBy
            })).filter(task => task.subject) };
        });
    }
    const current = () => normalize(adminTarget ? adminSchedule : null);

    async function init() {
        const isAdmin = Storage.isManager();
        document.getElementById('schedule-admin-tools')?.classList.toggle('hidden', !isAdmin);
        populateStudents();
        const date = document.getElementById('report-date'); if (date) { date.max = localDate(); if (!date.value) date.value = date.max; }
        if (isAdmin && requestedTarget) { const target = requestedTarget; requestedTarget = null; await selectAdminStudent(target); }
        else { adminTarget = null; adminSchedule = null; updateContext(); renderDays(); renderReports(); }
    }
    function populateStudents() {
        const select = document.getElementById('schedule-admin-student'); if (!select || !Storage.isManager()) return;
        const students = Storage.getUsers().filter(user => user.accountType !== 'advisor' && user.username !== 'kiankaki');
        select.innerHTML = '<option value="">برنامه خودم</option>' + students.map(user => `<option value="${esc(user.username)}">${esc(user.name || user.username)} (@${esc(user.username)})</option>`).join('');
        select.value = adminTarget?.username || '';
    }
    function toggleAdminDrawer(forceOpen) {
        const drawer = document.getElementById('schedule-admin-drawer'), button = document.getElementById('schedule-admin-toggle'); if (!drawer || !button) return;
        const open = typeof forceOpen === 'boolean' ? forceOpen : drawer.hidden; drawer.hidden = !open; button.setAttribute('aria-expanded', String(open));
    }
    async function selectAdminStudent(username) {
        const clean = String(username || '').trim().toLowerCase();
        if (!clean) { adminTarget = null; adminSchedule = null; updateContext(); renderDays(); renderReports(); return; }
        const select = document.getElementById('schedule-admin-student'); if (select) select.disabled = true;
        try {
            const response = await fetch(`/api/admin-students?username=${encodeURIComponent(clean)}`, { credentials: 'same-origin' });
            const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'دریافت برنامه انجام نشد.');
            adminTarget = payload.student; adminSchedule = normalize(payload.data?.schedule); if (select) select.value = clean;
            updateContext(); renderDays(); renderReports(); Utils.showToast(`برنامه ${adminTarget.name || adminTarget.username} باز شد.`, 'success');
        } catch (error) { Utils.showToast(error.message, 'error'); } finally { if (select) select.disabled = false; }
    }
    function updateContext() {
        const banner = document.getElementById('schedule-context-banner'), currentLabel = document.getElementById('schedule-admin-current');
        if (currentLabel) currentLabel.textContent = adminTarget ? `در حال ویرایش: ${adminTarget.name || adminTarget.username}` : 'در حال مشاهده برنامه خودم';
        if (banner) { banner.classList.toggle('hidden', !adminTarget); banner.innerHTML = adminTarget ? `<span class="material-symbols-outlined" aria-hidden="true">school</span><span>تسک‌های روزانه <strong>${esc(adminTarget.name || adminTarget.username)}</strong> را تنظیم می‌کنید.</span>` : ''; }
        document.querySelector('.manual-report-card')?.classList.toggle('hidden', Boolean(adminTarget));
    }
    function renderDays() {
        const root = document.getElementById('schedule-days-list'); if (!root) return;
        root.innerHTML = current().map((day, dayIndex) => {
            const total = day.tasks.reduce((sum, task) => sum + Number(task.durationMinutes || 0), 0);
            const tasks = day.tasks.map((task, taskIndex) => { const status = statuses[task.status] || statuses.pending; return `<article class="day-task" style="--task-color:${task.color}">
                <button class="day-task-main" type="button" onclick="Schedule.openEditTaskModal(${dayIndex},${taskIndex})">
                    <span class="day-task-number">${Utils.toPersianDigits(taskIndex + 1)}</span><span class="day-task-copy"><strong>${esc(task.subject)}</strong><small>${esc(task.note || 'بدون توضیح تکمیلی')}</small></span>
                    <span class="day-task-duration"><span class="material-symbols-outlined" aria-hidden="true">schedule</span>${Utils.toPersianDigits(task.durationMinutes)} دقیقه</span>
                </button>
                <div class="day-task-footer"><span class="schedule-status ${status[1]}">${status[0]}</span><button class="task-focus-button" type="button" onclick="Schedule.launchPomoForTask(${dayIndex},${taskIndex})" aria-label="شروع تمرکز برای ${esc(task.subject)}"><span class="material-symbols-outlined" aria-hidden="true">play_arrow</span> تمرکز</button></div>
            </article>`; }).join('') || '<div class="day-empty">هنوز تسکی برای این روز ثبت نشده است.</div>';
            return `<section class="schedule-day-card"><header><div><span class="schedule-day-index">${Utils.toPersianDigits(dayIndex + 1)}</span><h3>${day.day}</h3></div><span>${Utils.toPersianDigits(day.tasks.length)} تسک · ${Utils.toPersianDigits(total)} دقیقه</span></header><div class="schedule-day-tasks">${tasks}</div><button class="schedule-add-task" type="button" onclick="Schedule.openEditTaskModal(${dayIndex},-1)"><span class="material-symbols-outlined" aria-hidden="true">add</span> افزودن تسک برای ${day.day}</button></section>`;
        }).join('');
    }
    function openEditTaskModal(dayIndex, taskIndex) {
        editDay = dayIndex; editTask = taskIndex; const task = current()[dayIndex]?.tasks?.[taskIndex] || {};
        document.getElementById('edit-slot-day-name').textContent = `${days[dayIndex]} · ${taskIndex < 0 ? 'تسک جدید' : `تسک ${Utils.toPersianDigits(taskIndex + 1)}`}`;
        document.getElementById('input-slot-subject').value = task.subject || ''; document.getElementById('input-slot-note').value = task.note || '';
        document.getElementById('input-task-duration').value = task.durationMinutes || 60; document.getElementById('input-slot-color').value = task.color || '#2856d8';
        document.getElementById('input-slot-status').value = task.status || 'pending'; document.getElementById('slot-status-group').classList.toggle('hidden', Boolean(adminTarget));
        document.getElementById('delete-schedule-task')?.classList.toggle('hidden', taskIndex < 0);
        Utils.openModal('modal-edit-schedule-slot');
    }
    async function deleteCurrentTask() {
        if (editTask < 0 || !confirm('این تسک از برنامه حذف شود؟')) return;
        try {
            if (adminTarget) {
                const response = await fetch('/api/admin-students', { method:'DELETE', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ username:adminTarget.username, dayIndex:editDay, taskIndex:editTask }) });
                const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'حذف انجام نشد.'); adminSchedule = normalize(payload.schedule);
            } else { const schedule = current(); schedule[editDay].tasks.splice(editTask,1); Storage.set('schedule',schedule); }
            renderDays(); Utils.closeModal('modal-edit-schedule-slot'); Utils.showToast('تسک حذف شد.','info');
        } catch (error) { Utils.showToast(error.message,'error'); }
    }
    async function saveTaskSubmit() {
        const subject = document.getElementById('input-slot-subject')?.value.trim(); if (!subject) return Utils.showToast('عنوان تسک الزامی است.', 'warning');
        const values = { subject, note: document.getElementById('input-slot-note')?.value.trim() || '', durationMinutes: Math.min(600, Math.max(5, Number(document.getElementById('input-task-duration')?.value) || 60)), color: document.getElementById('input-slot-color')?.value || '#2856d8' };
        try {
            if (adminTarget) {
                const response = await fetch('/api/admin-students', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: adminTarget.username, dayIndex: editDay, taskIndex: editTask, ...values }) });
                const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'ذخیره انجام نشد.'); adminSchedule = normalize(payload.schedule);
            } else {
                const schedule = current(), tasks = schedule[editDay].tasks;
                const task = { id: tasks[editTask]?.id || `task-${Date.now()}`, ...values, status: document.getElementById('input-slot-status')?.value || 'pending' };
                if (editTask < 0) tasks.push(task); else tasks[editTask] = { ...tasks[editTask], ...task }; Storage.set('schedule', schedule);
            }
            renderDays(); Utils.closeModal('modal-edit-schedule-slot'); Utils.showToast('تسک در دیتابیس ذخیره شد.', 'success');
        } catch (error) { Utils.showToast(error.message, 'error'); }
    }
    function launchPomoForTask(dayIndex, taskIndex) { const task = current()[dayIndex]?.tasks?.[taskIndex]; if (!task) return; Pomodoro?.setTaskFromExternal(task.subject, task.durationMinutes); App?.navigate('pomodoro'); }
    function minutesBetween(start, end) { const [sh, sm] = start.split(':').map(Number), [eh, em] = end.split(':').map(Number); return eh * 60 + em - sh * 60 - sm; }
    function updateReportDuration() {
        const start = document.getElementById('report-start')?.value, end = document.getElementById('report-end')?.value, output = document.getElementById('report-duration-preview');
        const minutes = start && end ? Math.max(0, minutesBetween(start, end)) : 0;
        if (output) output.innerHTML = `<strong>${Utils.toPersianDigits(minutes)}</strong><small>دقیقه</small>`;
    }
    function saveManualReport() {
        if (adminTarget) return Utils.showToast('گزارش کار را خود دانش‌آموز ثبت می‌کند.', 'warning');
        const date = document.getElementById('report-date').value, subject = document.getElementById('report-subject').value.trim(), start = document.getElementById('report-start').value, end = document.getElementById('report-end').value, minutes = minutesBetween(start, end);
        if (!date || !subject || !start || !end || minutes <= 0) return Utils.showToast('زمان و اطلاعات گزارش را درست کامل کنید.', 'warning');
        const reports = Array.isArray(Storage.get('manual_reports', [])) ? Storage.get('manual_reports', []) : [];
        reports.push({ id: `report-${Date.now()}`, date, subject: subject.slice(0,100), start, end, minutes, status: document.getElementById('report-status').value, notes: document.getElementById('report-notes').value.trim().slice(0,500), createdAt: new Date().toISOString() });
        Storage.set('manual_reports', reports); document.getElementById('manual-report-form').reset(); document.getElementById('report-date').value = localDate(); updateReportDuration(); renderReports(); Utils.showToast('گزارش در دیتابیس ثبت شد.', 'success');
    }
    function renderReports() {
        const box = document.getElementById('manual-report-list'); if (!box || adminTarget) return; const reports = Storage.get('manual_reports', []) || [];
        box.innerHTML = reports.slice().reverse().map(report => { const status = statuses[report.status] || statuses.completed; return `<article class="manual-report-item"><span class="manual-report-subject-icon material-symbols-outlined" aria-hidden="true">menu_book</span><div class="manual-report-copy"><div><strong>${esc(report.subject)}</strong><span class="schedule-status ${status[1]}">${status[0]}</span></div><span><span class="material-symbols-outlined" aria-hidden="true">calendar_today</span>${esc(report.date)}<span class="material-symbols-outlined" aria-hidden="true">schedule</span>${esc(report.start)} تا ${esc(report.end)}</span><small>${esc(report.notes || 'بدون توضیح')}</small></div><div class="manual-report-duration"><strong>${Utils.toPersianDigits(Math.round(Number(report.minutes)||0))}</strong><small>دقیقه</small><button class="admin-icon-button" type="button" aria-label="حذف گزارش" onclick="Schedule.removeManualReport('${esc(report.id)}')"><span class="material-symbols-outlined" aria-hidden="true">delete</span></button></div></article>`; }).join('') || '<div class="admin-list-empty">هنوز گزارشی ثبت نشده است؛ اولین مطالعه واقعی خود را ثبت کنید.</div>';
    }
    function removeManualReport(id) { if (!confirm('این گزارش حذف شود؟')) return; Storage.set('manual_reports', (Storage.get('manual_reports',[])||[]).filter(item => item.id !== id)); renderReports(); }
    function openForStudent(username) { requestedTarget = username; App.navigate('schedule'); toggleAdminDrawer(true); }
    function printSchedule() { Utils?.printElement('schedule-printable-area', adminTarget ? `برنامه ${adminTarget.name || adminTarget.username}` : 'برنامه مطالعاتی هفتگی درسیار'); }
    return { init, toggleAdminDrawer, selectAdminStudent, openEditTaskModal, saveTaskSubmit, deleteCurrentTask, launchPomoForTask, updateReportDuration, saveManualReport, removeManualReport, openForStudent, printSchedule };
})();
window.Schedule = Schedule;
