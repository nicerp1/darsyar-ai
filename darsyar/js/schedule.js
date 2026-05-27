// ============ WEEKLY SCHEDULE ============
const Schedule = {
    render() {
        const days = ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنج‌شنبه','جمعه'];
        const hours = ['۸-۱۰','۱۰-۱۲','۱۲-۱۴','۱۴-۱۶','۱۶-۱۸','۱۸-۲۰'];
        let html = '<div class="schedule-cell time-header">ساعت</div>';
        days.forEach(d => html += `<div class="schedule-cell header">${d}</div>`);
        hours.forEach(h => {
            html += `<div class="schedule-cell time-header">${h}</div>`;
            days.forEach(d => {
                const key = `${d}-${h}`;
                const val = Storage.weeklySchedule[key];
                html += `<div class="schedule-cell ${val?.title ? 'filled' : ''}" data-key="${key}" onclick="Schedule.openModal('${key}')">${val?.title || '➕'}</div>`;
            });
        });
        document.getElementById('scheduleGrid').innerHTML = html;
    },
    
    openModal(key) {
        const existing = Storage.weeklySchedule[key] || { title: '', desc: '' };
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal">
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
                <h3>📝 برنامه ${key}</h3>
                <div class="input-group"><label>عنوان</label><input type="text" id="schedTitle" value="${existing.title}"></div>
                <div class="input-group"><label>توضیحات</label><textarea id="schedDesc" rows="3">${existing.desc||''}</textarea></div>
                <button class="btn btn-primary" id="saveSchedBtn">ذخیره</button>
            </div>`;
        document.body.appendChild(modal);
        modal.querySelector('#saveSchedBtn').addEventListener('click', () => {
            const t = modal.querySelector('#schedTitle').value.trim();
            const d = modal.querySelector('#schedDesc').value.trim();
            if (t) Storage.weeklySchedule[key] = { title: t, desc: d };
            else delete Storage.weeklySchedule[key];
            Storage.updateSchedule();
            modal.remove();
            this.render();
            Pomodoro.populateTaskSelect();
        });
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    }
};