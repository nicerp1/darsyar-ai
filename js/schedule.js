/** Weekly schedule, completion tracking and manual reports. */
const Schedule = (function () {
    let editDay = 0, editSlot = 0, adminTarget = null, adminSchedule = null, requestedTarget = null;
    const days = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
    const times = ['۰۸:۰۰ - ۱۰:۰۰', '۱۰:۰۰ - ۱۲:۰۰', '۱۴:۰۰ - ۱۶:۰۰', '۱۶:۰۰ - ۱۸:۰۰', '۱۸:۰۰ - ۲۰:۰۰', '۲۰:۰۰ - ۲۲:۰۰'];
    const statuses = { pending: ['در انتظار', 'schedule-status-pending'], completed: ['انجام شد', 'schedule-status-completed'], partial: ['بخشی انجام شد', 'schedule-status-partial'], missed: ['انجام نشد', 'schedule-status-missed'] };
    const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
    const blank = () => days.map((day, dayIndex) => ({ day, dayIndex, slots: times.map(time => ({ time, subject: '', note: '', color: '#05319e', status: 'pending' })) }));
    const localDate = () => { const now = new Date(), offset = now.getTimezoneOffset(); return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10); };

    function normalize(source) {
        const stored = source || Storage.get('schedule', []);
        if (!Array.isArray(stored) || stored.length !== 7) return blank();
        return days.map((day, dayIndex) => ({ day, dayIndex, slots: times.map((time, slotIndex) => ({ time, subject: '', note: '', color: '#05319e', status: 'pending', ...(stored[dayIndex]?.slots?.[slotIndex] || {}) })) }));
    }
    const current = () => normalize(adminTarget ? adminSchedule : null);

    async function init() {
        const isAdmin = Storage.getCurrentUser()?.username === 'kiankaki';
        document.getElementById('schedule-admin-tools')?.classList.toggle('hidden', !isAdmin);
        populateStudents();
        const date = document.getElementById('report-date');
        if (date) { date.max = localDate(); if (!date.value) date.value = date.max; }
        if (isAdmin && requestedTarget) { const target = requestedTarget; requestedTarget = null; await selectAdminStudent(target); }
        else { adminTarget = null; adminSchedule = null; updateContext(); renderGrid(); renderReports(); }
    }

    function populateStudents() {
        const select = document.getElementById('schedule-admin-student');
        if (!select || Storage.getCurrentUser()?.username !== 'kiankaki') return;
        const students = Storage.getUsers().filter(user => user.username !== 'kiankaki');
        select.innerHTML = '<option value="">برنامه خودم</option>' + students.map(user => `<option value="${esc(user.username)}">${esc(user.name || user.username)} (@${esc(user.username)})</option>`).join('');
        select.value = adminTarget?.username || '';
    }

    function toggleAdminDrawer(forceOpen) {
        const drawer = document.getElementById('schedule-admin-drawer'), button = document.getElementById('schedule-admin-toggle');
        if (!drawer || !button) return;
        const open = typeof forceOpen === 'boolean' ? forceOpen : drawer.hidden;
        drawer.hidden = !open; button.setAttribute('aria-expanded', String(open));
    }

    async function selectAdminStudent(username) {
        const clean = String(username || '').trim().toLowerCase();
        if (!clean) { adminTarget = null; adminSchedule = null; updateContext(); renderGrid(); renderReports(); return; }
        const select = document.getElementById('schedule-admin-student'); if (select) select.disabled = true;
        try {
            const response = await fetch(`/api/admin-students?username=${encodeURIComponent(clean)}`, { credentials: 'same-origin' });
            const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'دریافت برنامه انجام نشد.');
            adminTarget = payload.student; adminSchedule = normalize(payload.data?.schedule); if (select) select.value = clean;
            updateContext(); renderGrid(); renderReports(); Utils.showToast(`برنامه ${adminTarget.name || adminTarget.username} باز شد.`, 'success');
        } catch (error) { Utils.showToast(error.message, 'error'); }
        finally { if (select) select.disabled = false; }
    }

    function updateContext() {
        const banner = document.getElementById('schedule-context-banner'), currentLabel = document.getElementById('schedule-admin-current');
        if (currentLabel) currentLabel.textContent = adminTarget ? `در حال ویرایش: ${adminTarget.name || adminTarget.username}` : 'در حال مشاهده برنامه خودم';
        if (banner) { banner.classList.toggle('hidden', !adminTarget); banner.innerHTML = adminTarget ? `<span class="material-symbols-outlined" aria-hidden="true">school</span><span>برنامه <strong>${esc(adminTarget.name || adminTarget.username)}</strong> را ویرایش می‌کنید؛ وضعیت انجام را خود دانش‌آموز ثبت می‌کند.</span>` : ''; }
        document.querySelector('.manual-report-card')?.classList.toggle('hidden', Boolean(adminTarget));
    }

    function renderGrid() {
        const schedule = current(), tbody = document.getElementById('schedule-grid-tbody'); if (!tbody) return;
        tbody.innerHTML = times.map((time, slotIndex) => `<tr><td class="schedule-time-cell">${time}</td>${schedule.map((day, dayIndex) => {
            const slot = day.slots[slotIndex], hasPlan = Boolean(slot.subject), status = statuses[slot.status] || statuses.pending;
            const color = /^#[0-9a-f]{6}$/i.test(slot.color) ? slot.color : '#05319e';
            return `<td class="schedule-cell" style="border-right-color:${color}" onclick="Schedule.openEditSlotModal(${dayIndex},${slotIndex})"><div class="schedule-cell-subject">${esc(slot.subject || 'بدون برنامه')}</div><div class="schedule-cell-note">${esc(slot.note || '—')}</div>${hasPlan ? `<span class="schedule-status ${status[1]}">${status[0]}</span><button class="schedule-cell-pomo-btn" type="button" aria-label="شروع پومودورو برای ${esc(slot.subject)}" onclick="event.stopPropagation();Schedule.launchPomoForSlot(${dayIndex},${slotIndex})"><span class="material-symbols-outlined" aria-hidden="true">play_arrow</span></button>` : ''}</td>`;
        }).join('')}</tr>`).join('');
    }

    function openEditSlotModal(dayIndex, slotIndex) {
        editDay = dayIndex; editSlot = slotIndex; const day = current()[dayIndex], slot = day.slots[slotIndex];
        document.getElementById('edit-slot-day-name').textContent = `${day.day} - بازه ${slot.time}`;
        document.getElementById('input-slot-subject').value = slot.subject || '';
        document.getElementById('input-slot-note').value = slot.note || '';
        document.getElementById('input-slot-color').value = slot.color || '#05319e';
        document.getElementById('input-slot-status').value = slot.status || 'pending';
        document.getElementById('slot-status-group').classList.toggle('hidden', Boolean(adminTarget)); Utils.openModal('modal-edit-schedule-slot');
    }

    async function saveSlotSubmit() {
        const subject = document.getElementById('input-slot-subject')?.value.trim(); if (!subject) return Utils.showToast('عنوان درس الزامی است.', 'warning');
        const values = { subject, note: document.getElementById('input-slot-note')?.value.trim() || '', color: document.getElementById('input-slot-color')?.value || '#05319e' };
        try {
            if (adminTarget) {
                const response = await fetch('/api/admin-students', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: adminTarget.username, dayIndex: editDay, slotIndex: editSlot, ...values }) });
                const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'ذخیره انجام نشد.'); adminSchedule = normalize(payload.schedule);
            } else {
                const schedule = current(); schedule[editDay].slots[editSlot] = { ...schedule[editDay].slots[editSlot], ...values, status: document.getElementById('input-slot-status')?.value || 'pending' }; Storage.set('schedule', schedule);
            }
            renderGrid(); Utils.closeModal('modal-edit-schedule-slot'); Utils.showToast('برنامه در دیتابیس ذخیره شد.', 'success');
        } catch (error) { Utils.showToast(error.message, 'error'); }
    }

    function launchPomoForSlot(dayIndex, slotIndex) { const slot = current()[dayIndex]?.slots?.[slotIndex]; if (!slot?.subject) return; Pomodoro?.setTaskFromExternal(`${slot.subject} (${slot.note || 'مطالعه برنامه هفتگی'})`); App?.navigate('pomodoro'); }
    function minutesBetween(start, end) { const [sh, sm] = start.split(':').map(Number), [eh, em] = end.split(':').map(Number); return eh * 60 + em - sh * 60 - sm; }

    function saveManualReport() {
        if (adminTarget) return Utils.showToast('گزارش کار را خود دانش‌آموز ثبت می‌کند.', 'warning');
        const date = document.getElementById('report-date').value, subject = document.getElementById('report-subject').value.trim(), start = document.getElementById('report-start').value, end = document.getElementById('report-end').value, minutes = minutesBetween(start, end);
        if (!date || !subject || !start || !end) return Utils.showToast('همه فیلدهای اصلی گزارش را کامل کنید.', 'warning');
        if (minutes <= 0) return Utils.showToast('ساعت پایان باید بعد از ساعت شروع باشد.', 'warning');
        const reports = Array.isArray(Storage.get('manual_reports', [])) ? Storage.get('manual_reports', []) : [];
        reports.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, date, subject: subject.slice(0, 100), start, end, minutes, status: document.getElementById('report-status').value, notes: document.getElementById('report-notes').value.trim().slice(0, 500), createdAt: new Date().toISOString() });
        Storage.set('manual_reports', reports); document.getElementById('manual-report-form').reset(); document.getElementById('report-date').value = localDate(); renderReports(); Utils.showToast('گزارش کار در دیتابیس ثبت شد.', 'success');
    }

    function renderReports() {
        const box = document.getElementById('manual-report-list'); if (!box || adminTarget) return;
        const reports = Array.isArray(Storage.get('manual_reports', [])) ? Storage.get('manual_reports', []) : [];
        box.innerHTML = reports.slice().reverse().map(report => { const status = statuses[report.status] || statuses.completed; return `<article class="manual-report-item"><div><strong>${esc(report.subject)}</strong><span>${esc(report.date)} · ${esc(report.start)} تا ${esc(report.end)} · ${Math.round(Number(report.minutes) || 0)} دقیقه</span><small>${esc(report.notes || 'بدون توضیح')}</small></div><div class="manual-report-actions"><span class="schedule-status ${status[1]}">${status[0]}</span><button class="admin-icon-button" type="button" aria-label="حذف گزارش ${esc(report.subject)}" onclick="Schedule.removeManualReport('${esc(report.id)}')"><span class="material-symbols-outlined" aria-hidden="true">delete</span></button></div></article>`; }).join('') || '<div class="admin-list-empty">هنوز گزارشی ثبت نشده است. اولین مطالعه واقعی خود را بالا ثبت کنید.</div>';
    }

    function removeManualReport(id) { if (!window.confirm('این گزارش کار حذف شود؟')) return; Storage.set('manual_reports', (Storage.get('manual_reports', []) || []).filter(report => report.id !== id)); renderReports(); Utils.showToast('گزارش حذف شد.', 'info'); }
    function openForStudent(username) { requestedTarget = username; App.navigate('schedule'); toggleAdminDrawer(true); }
    function printSchedule() { Utils?.printElement('schedule-printable-table', adminTarget ? `برنامه ${adminTarget.name || adminTarget.username}` : 'برنامه مطالعاتی هفتگی درسیار'); }
    return { init, toggleAdminDrawer, selectAdminStudent, openEditSlotModal, saveSlotSubmit, launchPomoForSlot, saveManualReport, removeManualReport, openForStudent, printSchedule };
})();
window.Schedule = Schedule;
