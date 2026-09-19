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

    function saveProfileSubmit() {
        const nameInput = document.getElementById('profile-name');
        const gradeSelect = document.getElementById('profile-grade');
        const emailInput = document.getElementById('profile-email');
        const newPassInput = document.getElementById('profile-new-password');

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

        if (newPassInput && newPassInput.value.trim().length > 0) {
            user.password = newPassInput.value.trim();
            newPassInput.value = '';
        }

        Storage.updateUser(user);

        if (typeof App !== 'undefined') {
            App.renderUserHeader();
        }

        if (typeof Utils !== 'undefined') {
            Utils.showToast('اطلاعات حساب کاربری با موفقیت به‌روزرسانی شد.', 'success');
        }
    }

    return {
        init,
        selectAvatar,
        saveProfileSubmit
    };
})();

if (typeof window !== 'undefined') {
    window.Profile = Profile;
}
