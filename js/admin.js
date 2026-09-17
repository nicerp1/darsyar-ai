/**
 * StudyMate Pro - Admin Panel Controller (Management & Configuration)
 */

const Admin = (function () {
    function init() {
        renderUsersTable();
        loadSystemSettings();
        renderAdminStats();
    }

    function renderAdminStats() {
        const users = Storage.getUsers();
        const flashcards = Storage.get('flashcards', []);
        const exams = Storage.get('exams', []);
        const researches = Storage.get('researches', []);

        const elUsers = document.getElementById('admin-stat-users');
        const elCards = document.getElementById('admin-stat-cards');
        const elExams = document.getElementById('admin-stat-exams');
        const elResearches = document.getElementById('admin-stat-researches');

        const pd = typeof Utils !== 'undefined' ? Utils.toPersianDigits : (v => v);

        if (elUsers) elUsers.textContent = pd(users.length);
        if (elCards) elCards.textContent = pd(flashcards.length);
        if (elExams) elExams.textContent = pd(exams.length);
        if (elResearches) elResearches.textContent = pd(researches.length);
    }

    function renderUsersTable() {
        const tbody = document.getElementById('admin-users-tbody');
        if (!tbody) return;

        const users = Storage.getUsers();
        const pd = typeof Utils !== 'undefined' ? Utils.toPersianDigits : (v => v);

        tbody.innerHTML = users.map(u => `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 20px;">${u.avatar || '👩‍🎓'}</span>
                        <div>
                            <div style="font-weight: 700;">${u.name}</div>
                            <div style="font-size: 11px; color: var(--text-dim);">${u.username}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <select class="form-control" style="padding: 4px 8px; font-size: 12px; width: auto;" onchange="Admin.changeUserRole('${u.username}', this.value)">
                        <option value="user" ${u.role === 'user' ? 'selected' : ''}>دانش‌آموز</option>
                        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>مدیر سیستم</option>
                    </select>
                </td>
                <td>
                    <select class="form-control" style="padding: 4px 8px; font-size: 12px; width: auto;" onchange="Admin.changeUserPlan('${u.username}', this.value)">
                        <option value="free" ${u.plan === 'free' ? 'selected' : ''}>رایگان</option>
                        <option value="silver" ${u.plan === 'silver' ? 'selected' : ''}>نقره‌ای</option>
                        <option value="gold" ${u.plan === 'gold' ? 'selected' : ''}>طلایی (VIP)</option>
                    </select>
                </td>
                <td><strong style="color: var(--gold-light);">${pd(u.xp || 0)} XP</strong> (سطح ${pd(u.level || 1)})</td>
                <td>
                    <button style="background: transparent; border: none; color: var(--danger); cursor: pointer;" title="حذف کاربر" onclick="Admin.deleteUser('${u.username}')">
                        <span class="material-symbols-outlined" style="font-size: 18px;">delete</span>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    function changeUserRole(username, newRole) {
        const users = Storage.getUsers();
        const user = users.find(u => u.username === username);
        if (user) {
            user.role = newRole;
            Storage.saveUsers(users);
            if (typeof Utils !== 'undefined') {
                Utils.showToast(`نقش کاربر «${user.name}» به ${newRole === 'admin' ? 'مدیر' : 'کاربر'} تغییر یافت.`, 'success');
            }
        }
    }

    function changeUserPlan(username, newPlan) {
        const users = Storage.getUsers();
        const user = users.find(u => u.username === username);
        if (user) {
            user.plan = newPlan;
            Storage.saveUsers(users);
            if (typeof Utils !== 'undefined') {
                Utils.showToast(`پلن کاربر «${user.name}» به ${newPlan} تغییر یافت.`, 'success');
            }
        }
    }

    function deleteUser(username) {
        const currentUser = Storage.getCurrentUser();
        if (currentUser && currentUser.username === username) {
            if (typeof Utils !== 'undefined') {
                Utils.showToast('شما نمی‌توانید حساب کاربری جاری خود را حذف کنید!', 'error');
            }
            return;
        }

        if (confirm(`آیا از حذف کاربر «${username}» اطمینان کامل دارید؟`)) {
            let users = Storage.getUsers();
            users = users.filter(u => u.username !== username);
            Storage.saveUsers(users);
            renderUsersTable();
            renderAdminStats();
            if (typeof Utils !== 'undefined') {
                Utils.showToast('کاربر با موفقیت حذف گردید.', 'info');
            }
        }
    }

    function loadSystemSettings() {
        const settings = Storage.getSettings();
        const modelSelect = document.getElementById('admin-ai-model');
        if (modelSelect) modelSelect.value = settings.aiModel || 'gapgpt-qwen-3.5';
    }

    function saveSystemSettings() {
        const modelSelect = document.getElementById('admin-ai-model');

        const settings = Storage.getSettings();
        settings.aiModel = modelSelect ? modelSelect.value : 'gapgpt-qwen-3.5';

        Storage.saveSettings(settings);

        if (typeof Utils !== 'undefined') {
            Utils.showToast('تنظیمات سرویس هوش مصنوعی GapGPT با موفقیت ذخیره شد.', 'success');
        }
    }

    function resetDemoData() {
        if (confirm('آیا مایل به بازنشانی تمام داده‌های سامانه به حالت اولیه کارخانه هستید؟')) {
            if (typeof DefaultContent !== 'undefined') {
                DefaultContent.initStorage(true);
                location.reload();
            }
        }
    }

    function exportBackupJSON() {
        const data = {
            users: Storage.getUsers(),
            settings: Storage.getSettings(),
            flashcards: Storage.get('flashcards', []),
            exams: Storage.get('exams', []),
            schedule: Storage.get('schedule', []),
            studyHistory: Storage.get('study_history', [])
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `studymate-backup-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);

        if (typeof Utils !== 'undefined') {
            Utils.showToast('فایل پشتیبان داده‌ها دانلود شد.', 'success');
        }
    }

    return {
        init,
        renderUsersTable,
        changeUserRole,
        changeUserPlan,
        deleteUser,
        saveSystemSettings,
        resetDemoData,
        exportBackupJSON
    };
})();

if (typeof window !== 'undefined') {
    window.Admin = Admin;
}
