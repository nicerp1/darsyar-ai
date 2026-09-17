/**
 * StudyMate Pro - VIP & Premium Subscription Manager
 */

const Subscription = (function () {
    function init() {
        updateCurrentPlanIndicator();
    }

    function updateCurrentPlanIndicator() {
        const user = Storage.getCurrentUser() || { plan: 'free' };
        const currentPlan = user.plan || 'free';

        const btnFree = document.getElementById('btn-plan-free');
        const btnSilver = document.getElementById('btn-plan-silver');
        const btnGold = document.getElementById('btn-plan-gold');

        if (btnFree) {
            btnFree.textContent = currentPlan === 'free' ? 'پلن فعال شما' : 'طرح پیش‌فرض';
            btnFree.disabled = currentPlan === 'free';
        }
        if (btnSilver) {
            btnSilver.textContent = currentPlan === 'silver' ? 'پلن فعال شما' : 'ارتقا به نقره‌ای';
            btnSilver.disabled = currentPlan === 'silver';
        }
        if (btnGold) {
            btnGold.textContent = currentPlan === 'gold' ? 'پلن فعال شما (VIP)' : 'ارتقا به طلایی';
            btnGold.disabled = currentPlan === 'gold';
        }
    }

    function upgradePlan(planKey) {
        const user = Storage.getCurrentUser();
        if (!user) return;

        user.plan = planKey;
        Storage.updateUser(user);

        updateCurrentPlanIndicator();

        if (typeof App !== 'undefined') {
            App.renderUserHeader();
        }

        const planNames = { 'silver': 'نقره‌ای', 'gold': 'طلایی (VIP)' };

        if (typeof Utils !== 'undefined') {
            Utils.showToast(`🎉 تبریک! حساب کاربری شما با موفقیت به پلن «${planNames[planKey] || planKey}» ارتقا یافت! تمام دسترسی‌ها باز شدند.`, 'success', 5000);
            Utils.launchConfetti();
        }
    }

    return {
        init,
        upgradePlan
    };
})();

if (typeof window !== 'undefined') {
    window.Subscription = Subscription;
}
