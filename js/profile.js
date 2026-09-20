/**
 * StudyMate Pro - User Profile & Account Settings
 */

const Profile = (function () {
    let selectedAvatar = '👩‍🎓';

    function init() {
        loadProfileData();
        renderAvatarOptions();
    }

    function loadProfileData() {
        const user = Storage.getCurrentUser() || {};

        const nameInput = document.getElementById('profile-name');
        const usernameInput = document.getElementById('profile-username');
        const gradeSelect = document.getElementById('profile-grade');
        const emailInput = document.getElementById('profile-email');
        const avatarPreview = document.getElementById('profile-avatar-preview');
        const roleBadge = document.getElementById('profile-role-badge');
        const planBadge = document.getElementById('profile-plan-badge');

        if (nameInput) nameInput.value = user.name || '';
        if (usernameInput) usernameInput.value = user.username || '';
        if (gradeSelect) { if (user.grade && ![...gradeSelect.options].some(option => option.value === user.grade)) gradeSelect.add(new Option(user.grade, user.grade)); gradeSelect.value = user.grade || 'دوازدهم تجربی'; }
        if (emailInput) emailInput.value = user.email || `${user.username}@studymate.ir`;

        selectedAvatar = user.avatar || '👩‍🎓';
        if (avatarPreview) avatarPreview.textContent = selectedAvatar;

        if (roleBadge) {
            roleBadge.textContent = user.accountType === 'admin' ? 'مدیر ارشد سیستم 👑' : user.accountType === 'advisor' ? 'مشاور تحصیلی 👨‍🏫' : 'دانش‌آموز کوشا 🎓';
        }
        if (planBadge) {
            const planNames = { 'free': 'رایگان 🌱', 'silver': 'نقره‌ای 🥈', 'gold': 'طلایی VIP 👑' };
            planBadge.textContent = `پلن: ${planNames[user.plan] || 'رایگان'}`;
        }
    }

    function renderAvatarOptions() {
        const container = document.getElementById('profile-avatar-picker');
        if (!container) return;

        const avatars = ['👩‍🎓', '👨‍🎓', '👩‍🏫', '👨‍🏫', '🔬', '💡', '🧑‍💻', '👩‍⚕️', '🚀', '🎯', '👑', '🌟'];

        container.innerHTML = avatars.map(av => `
            <div style="font-size: 26px; padding: 8px; border-radius: var(--radius-md); background: ${selectedAvatar === av ? 'var(--primary)' : 'var(--bg-surface)'}; border: 1.5px solid ${selectedAvatar === av ? 'var(--gold)' : 'var(--border-subtle)'}; cursor: pointer; text-align: center; transition: 0.2s;" onclick="Profile.selectAvatar('${av}')">
                ${av}
            </div>
        `).join('');
    }

    function selectAvatar(avatar) {
        selectedAvatar = avatar;
        const preview = document.getElementById('profile-avatar-preview');
        if (preview) preview.textContent = avatar;
        renderAvatarOptions();
    }

    async function saveProfileSubmit() {
        const nameInput = document.getElementById('profile-name');
        const gradeSelect = document.getElementById('profile-grade');
        const emailInput = document.getElementById('profile-email');
        const newPassInput = document.getElementById('profile-new-password');
        const currentPassInput = document.getElementById('profile-current-password');

        if (!nameInput || !nameInput.value.trim()) {
            if (typeof Utils !== 'undefined') {
                Utils.showToast('نام و نام خانوادگی الزامی است.', 'warning');
            }
            return;
        }

        const user = Storage.getCurrentUser();
        if (!user) return;

        user.name = nameInput.value.trim();
        user.grade = gradeSelect ? gradeSelect.value : user.grade;
        user.email = emailInput ? emailInput.value.trim() : user.email;
        user.avatar = selectedAvatar;

        try {
            if (newPassInput?.value) {
                if (!currentPassInput?.value) return Utils.showToast('برای تغییر رمز، رمز عبور فعلی را وارد کنید.', 'warning');
                await Storage.changePassword(currentPassInput.value, newPassInput.value);
                newPassInput.value = ''; currentPassInput.value = '';
            }
            Storage.updateUser(user);
        } catch (error) { return Utils.showToast(error.message || 'ذخیره تغییرات انجام نشد.', 'error'); }

        if (typeof App !== 'undefined') {
            App.renderUserHeader();
        }

        if (typeof Utils !== 'undefined') {
            Utils.showToast('اطلاعات حساب کاربری با موفقیت به‌روزرسانی شد.', 'success');
        }
    }

    function openDeleteAccount() {
        if (Storage.getCurrentUser()?.username === 'kiankaki') return Utils.showToast('حساب مدیر اصلی از داخل برنامه قابل حذف نیست.', 'warning');
        const username = document.getElementById('delete-account-username'), password = document.getElementById('delete-account-password');
        if (username) username.value = '';
        if (password) password.value = '';
        Utils.openModal('modal-delete-account');
        setTimeout(() => username?.focus(), 80);
    }

    async function confirmDeleteAccount() {
        const confirmation = document.getElementById('delete-account-username')?.value.trim().toLowerCase();
        const password = document.getElementById('delete-account-password')?.value || '';
        const button = document.getElementById('delete-account-submit');
        if (!confirmation || !password) return Utils.showToast('نام کاربری و رمز عبور را وارد کنید.', 'warning');
        if (button) button.disabled = true;
        try {
            await Storage.deleteAccount(confirmation, password);
            Utils.closeModal('modal-delete-account');
            Utils.showToast('حساب و اطلاعات شما برای همیشه حذف شد.', 'success');
            App.onUserChanged();
        } catch (error) { Utils.showToast(error.message || 'حذف حساب انجام نشد.', 'error'); }
        finally { if (button) button.disabled = false; }
    }

    return {
        init,
        selectAvatar,
        saveProfileSubmit,
        openDeleteAccount,
        confirmDeleteAccount
    };
})();

if (typeof window !== 'undefined') {
    window.Profile = Profile;
}
