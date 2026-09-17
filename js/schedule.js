/**
 * StudyMate Pro - Weekly Study Schedule Manager
 */

const Schedule = (function () {
    let activeEditDayIndex = 0;
    let activeEditSlotIndex = 0;
    const dayNames = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
    const timeSlotsLabels = ['۰۸:۰۰ - ۱۰:۰۰', '۱۰:۰۰ - ۱۲:۰۰', '۱۴:۰۰ - ۱۶:۰۰', '۱۶:۰۰ - ۱۸:۰۰', '۱۸:۰۰ - ۲۰:۰۰', '۲۰:۰۰ - ۲۲:۰۰'];

    function normalizedSchedule() {
        const stored = Storage.get('schedule', []);
        if (Array.isArray(stored) && stored.length === 7) return stored;
        return dayNames.map((day, dayIndex) => ({ day, dayIndex, slots: timeSlotsLabels.map(time => ({ time, subject: '', note: '', color: '#05319e' })) }));
    }

    function init() {
        renderScheduleGrid();
    }

    function renderScheduleGrid() {
        const schedule = normalizedSchedule();
        const tbody = document.getElementById('schedule-grid-tbody');
        if (!tbody) return;

        let html = '';

        timeSlotsLabels.forEach((timeLabel, slotIdx) => {
            html += `<tr>`;
            html += `<td style="font-weight: 700; color: var(--gold-light); background: var(--bg-surface); text-align: center; white-space: nowrap; font-size: 13px;">${timeLabel}</td>`;

            schedule.forEach((dayObj, dayIdx) => {
                const slot = (dayObj.slots && dayObj.slots[slotIdx]) || { subject: '', note: '', color: '#05319e' };
                const hasPlan = Boolean(slot.subject);
                html += `
                    <td class="schedule-cell" style="border-right: 3px solid ${slot.color || '#05319e'};" onclick="Schedule.openEditSlotModal(${dayIdx}, ${slotIdx})">
                        <div class="schedule-cell-subject">${slot.subject || 'بدون برنامه'}</div>
                        <div class="schedule-cell-note">${slot.note || '—'}</div>
                        ${hasPlan ? `<button class="schedule-cell-pomo-btn" title="شروع پومودورو با این درس" onclick="event.stopPropagation(); Schedule.launchPomoForSlot('${slot.subject}', '${slot.note}')">
                            <span class="material-symbols-outlined" style="font-size: 14px;">play_arrow</span>
                        </button>` : ''}
                    </td>
                `;
            });

            html += `</tr>`;
        });

        tbody.innerHTML = html;
    }

    function openEditSlotModal(dayIdx, slotIdx) {
        activeEditDayIndex = dayIdx;
        activeEditSlotIndex = slotIdx;

        const schedule = normalizedSchedule();
        const dayObj = schedule[dayIdx];
        const slot = dayObj.slots[slotIdx];

        const dayNameEl = document.getElementById('edit-slot-day-name');
        const subjectInput = document.getElementById('input-slot-subject');
        const noteInput = document.getElementById('input-slot-note');
        const colorInput = document.getElementById('input-slot-color');

        if (dayNameEl) dayNameEl.textContent = `${dayObj.day} - بازه ${slot.time}`;
        if (subjectInput) subjectInput.value = slot.subject || '';
        if (noteInput) noteInput.value = slot.note || '';
        if (colorInput) colorInput.value = slot.color || '#05319e';

        if (typeof Utils !== 'undefined') {
            Utils.openModal('modal-edit-schedule-slot');
        }
    }

    function saveSlotSubmit() {
        const schedule = normalizedSchedule();
        const subjectInput = document.getElementById('input-slot-subject');
        const noteInput = document.getElementById('input-slot-note');
        const colorInput = document.getElementById('input-slot-color');

        if (!subjectInput || !subjectInput.value.trim()) {
            if (typeof Utils !== 'undefined') {
                Utils.showToast('عنوان درس الزامی است.', 'warning');
            }
            return;
        }

        schedule[activeEditDayIndex].slots[activeEditSlotIndex].subject = subjectInput.value.trim();
        schedule[activeEditDayIndex].slots[activeEditSlotIndex].note = noteInput ? noteInput.value.trim() : '';
        schedule[activeEditDayIndex].slots[activeEditSlotIndex].color = colorInput ? colorInput.value : '#05319e';

        Storage.set('schedule', schedule);
        renderScheduleGrid();

        if (typeof Utils !== 'undefined') {
            Utils.closeModal('modal-edit-schedule-slot');
            Utils.showToast('برنامه با موفقیت به‌روزرسانی شد.', 'success');
        }
    }

    function launchPomoForSlot(subject, note) {
        const taskFullName = `${subject} (${note || 'مطالعه برنامه هفتگی'})`;
        if (typeof Pomodoro !== 'undefined') {
            Pomodoro.setTaskFromExternal(taskFullName);
        }
        if (typeof App !== 'undefined') {
            App.navigate('pomodoro');
        }
    }

    function printSchedule() {
        if (typeof Utils !== 'undefined') {
            Utils.printElement('schedule-printable-table', 'برنامه مطالعاتی هفتگی درسیار');
        }
    }

    return {
        init,
        openEditSlotModal,
        saveSlotSubmit,
        launchPomoForSlot,
        printSchedule
    };
})();

if (typeof window !== 'undefined') {
    window.Schedule = Schedule;
}
