(function () {
    'use strict';

    const dialog = document.getElementById('plan-log');
    const form = document.getElementById('plan-log-form');
    if (!dialog || !form) return;

    const fields = form.elements;
    const error = form.querySelector('.log-error');
    const save = form.querySelector('.log-save');
    const duration = document.getElementById('log-duration');
    const dateLabel = document.getElementById('log-persian-date');
    const history = dialog.querySelector('.log-history');
    let tasks = [];
    let saving = false;

    function dateKey() {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    }

    function clockNow() {
        return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
    }

    function toMinutes(time) {
        if (!time) return NaN;
        const [hour, minute] = time.split(':').map(Number);
        return hour * 60 + minute;
    }

    function fromMinutes(time) {
        return [Math.floor(time / 60), time % 60].map(value => String(value).padStart(2, '0')).join(':');
    }

    function updateDuration() {
        const minutes = toMinutes(fields.end.value) - toMinutes(fields.start.value);
        duration.textContent = minutes > 0 ? Utils.toPersianDigits(minutes) + ' دقیقه' : '—';
        form.querySelectorAll('[data-min]').forEach(button => {
            button.setAttribute('aria-pressed', String(minutes === Number(button.dataset.min)));
        });
        return minutes;
    }

    function updateDateLabel() {
        const day = fields.date.value;
        dateLabel.textContent = day ? StudyFlow.jalali(new Date(day + 'T12:00:00')) : '';
    }

    function updateSource() {
        const fromPlan = fields.mode.value === 'plan';
        form.querySelector('[data-log-source="plan"]').hidden = !fromPlan;
        form.querySelector('[data-log-source="manual"]').hidden = fromPlan;
        fields.task.disabled = !fromPlan;
        fields.task.required = fromPlan;
        fields.manualSubject.disabled = fromPlan;
        fields.manualSubject.required = !fromPlan;
    }

    function refreshContext() {
        const ownPlan = !Schedule.getState().manager;
        document.querySelectorAll('[data-open-plan-log]').forEach(button => { button.hidden = !ownPlan; });
        if (!ownPlan) close();
    }

    function open(selection) {
        if (dialog.open || saving || Schedule.getState().manager || !document.getElementById('view-schedule').classList.contains('active')) return;
        tasks = Schedule.getOwnDays().flatMap(day => day.tasks.map(task => ({ ...task, dayIndex: day.dayIndex, day: day.day })));
        form.reset();
        fields.task.replaceChildren(new Option('یک تسک انتخاب کن', ''));
        const groups = new Map();
        tasks.forEach((task, index) => {
            if (!groups.has(task.dayIndex)) {
                const group = document.createElement('optgroup');
                group.label = task.day;
                groups.set(task.dayIndex, group);
                fields.task.append(group);
            }
            groups.get(task.dayIndex).append(new Option(task.subject, String(index)));
        });
        fields.mode[0].disabled = !tasks.length;
        fields.mode.value = tasks.length ? 'plan' : 'manual';
        if (selection) {
            const index = tasks.findIndex(task => task.dayIndex === selection.dayIndex && task.id === selection.taskId);
            if (index >= 0) fields.task.value = String(index);
        }
        fields.date.max = dateKey();
        fields.date.value = fields.date.max;
        fields.end.value = clockNow();
        error.textContent = '';
        history.open = false;
        updateSource();
        updateDateLabel();
        updateDuration();
        Schedule.renderReports();
        dialog.showModal();
    }

    function close() {
        if (dialog.open) dialog.close();
    }

    document.addEventListener('click', event => {
        if (event.target.closest('[data-open-plan-log]')) open();
    });
    document.addEventListener('schedule:rendered', refreshContext);
    dialog.querySelector('.log-close').addEventListener('click', close);

    form.addEventListener('input', event => {
        error.textContent = '';
        if (event.target.name === 'mode') updateSource();
        if (event.target.name === 'date') updateDateLabel();
        if (event.target.name === 'start' || event.target.name === 'end') updateDuration();
    });

    form.querySelector('.log-presets').addEventListener('click', event => {
        const button = event.target.closest('[data-min]');
        if (!button) return;
        const length = Number(button.dataset.min);
        const end = toMinutes(fields.end.value || clockNow());
        if (end < length) {
            fields.start.value = '00:00';
            fields.end.value = fromMinutes(length);
        } else {
            fields.end.value = fromMinutes(end);
            fields.start.value = fromMinutes(end - length);
        }
        error.textContent = '';
        updateDuration();
    });

    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (saving || Schedule.getState().manager) return;
        const task = fields.mode.value === 'plan' && fields.task.value !== '' ? tasks[Number(fields.task.value)] : null;
        const subject = task?.subject || fields.manualSubject.value.trim();
        if (!subject) {
            error.textContent = 'درس یا عنوان تسک را وارد کن.';
            fields.manualSubject.focus();
            return;
        }
        if (!(updateDuration() > 0)) {
            error.textContent = 'ساعت پایان باید بعد از شروع و در همان روز باشد.';
            fields.end.focus();
            return;
        }
        const owner = Storage.getCurrentUser()?.username;
        saving = true;
        save.disabled = true;
        save.textContent = 'در حال ذخیره…';
        try {
            await StudyFlow.post({
                source: 'plan-report',
                date: fields.date.value,
                start: fields.start.value,
                end: fields.end.value,
                status: fields.status.value,
                notes: fields.notes.value,
                ...(task ? { taskId: task.id, dayIndex: task.dayIndex } : { subject })
            });
            if (owner !== Storage.getCurrentUser()?.username) return;
            close();
            if (document.getElementById('view-schedule').classList.contains('active') && !Schedule.getState().manager) {
                await Schedule.init();
            }
            if (document.getElementById('view-stats').classList.contains('active')) Stats.init();
            Utils.showToast('گزارش مطالعه ثبت شد.', 'success');
        } catch (failure) {
            if (dialog.open && owner === Storage.getCurrentUser()?.username) error.textContent = failure.message || 'ذخیره انجام نشد.';
        } finally {
            saving = false;
            save.disabled = false;
            save.textContent = 'ذخیرهٔ گزارش';
        }
    });

    window.PlanLog = { open, close };
})();
