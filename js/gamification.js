/**
 * StudyMate Pro - Gamification, XP, Badges & Hall of Fame
 */

const Gamification = (function () {
    const levels = [
        { level: 1, title: 'دانش‌آموز تازه‌کار 🌱', minXP: 0, maxXP: 200 },
        { level: 2, title: 'پوینده کوشا 📚', minXP: 200, maxXP: 600 },
        { level: 3, title: 'پژوهشگر پرتلاش 🔬', minXP: 600, maxXP: 1200 },
        { level: 4, title: 'نخبه علمی 🎯', minXP: 1200, maxXP: 2500 },
        { level: 5, title: 'استاد بزرگ درسیار 👑', minXP: 2500, maxXP: 5000 }
    ];

    function init() {
        renderLevelProgress();
        renderBadges();
        renderChallenges();
        renderLeaderboard();
    }

    function renderLevelProgress() {
        const user = Storage.getCurrentUser() || { xp: 350, level: 2 };
        const userXP = user.xp || 0;

        let currentLvl = levels[0];
        for (let l of levels) {
            if (userXP >= l.minXP) {
                currentLvl = l;
            }
        }

        const nextLvl = levels.find(l => l.level === currentLvl.level + 1) || currentLvl;
        const xpInCurrentLevel = userXP - currentLvl.minXP;
        const levelRange = Math.max(1, nextLvl.maxXP - currentLvl.minXP);
        const percent = Math.min(100, Math.round((xpInCurrentLevel / levelRange) * 100));

        const titleEl = document.getElementById('game-level-title');
        const xpTextEl = document.getElementById('game-level-xp-text');
        const fillEl = document.getElementById('game-level-progress-fill');
        const sideLevelBadge = document.getElementById('sidebar-user-level');
        const sideXPBar = document.getElementById('sidebar-xp-bar');

        const pd = typeof Utils !== 'undefined' ? Utils.toPersianDigits : (v => v);

        if (titleEl) titleEl.textContent = `سطح ${pd(currentLvl.level)}: ${currentLvl.title}`;
        if (xpTextEl) xpTextEl.textContent = `${pd(userXP)} / ${pd(nextLvl.maxXP)} XP (${pd(percent)}٪)`;
        if (fillEl) fillEl.style.width = `${percent}%`;

        if (sideLevelBadge) sideLevelBadge.textContent = `سطح ${pd(currentLvl.level)}`;
        if (sideXPBar) sideXPBar.style.width = `${percent}%`;
    }

    function renderBadges() {
        const grid = document.getElementById('game-badges-grid');
        if (!grid) return;

        const badges = Storage.get('badges', []);
        const pd = typeof Utils !== 'undefined' ? Utils.toPersianDigits : (v => v);

        grid.innerHTML = badges.map(b => `
            <div class="badge-item-card ${b.unlocked ? 'unlocked' : 'locked'}">
                <div class="badge-icon-wrap">
                    ${b.icon}
                </div>
                <div>
                    <div class="badge-card-title">${b.title} ${b.unlocked ? '✅' : '🔒'}</div>
                    <div class="badge-card-desc">${b.description}</div>
                    <div style="font-size: 11px; color: var(--gold-light); font-weight: 700; margin-top: 4px;">
                        پاداش: +${pd(b.xpReward)} XP
                    </div>
                </div>
            </div>
        `).join('');
    }

    function renderChallenges() {
        const container = document.getElementById('game-challenges-list');
        if (!container) return;

        const challenges = Storage.get('daily_challenges', [
            { id: 'c1', title: 'تکمیل ۳ جلسه پومودورو امروز', xp: 50, progress: 2, total: 3, claimed: false },
            { id: 'c2', title: 'مرور ۱۰ فلش‌کارت در جعبه لایتنر', xp: 40, progress: 10, total: 10, claimed: true },
            { id: 'c3', title: 'شرکت در یک آزمون آنلاین و کسب درصد بالای ۷۰', xp: 80, progress: 1, total: 1, claimed: false }
        ]);

        const pd = typeof Utils !== 'undefined' ? Utils.toPersianDigits : (v => v);

        container.innerHTML = challenges.map(c => {
            const isCompleted = c.progress >= c.total;
            return `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); margin-bottom: 10px;">
                    <div>
                        <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">${c.title}</div>
                        <div style="font-size: 12px; color: var(--text-muted);">
                            پیشرفت: ${pd(c.progress)} از ${pd(c.total)} | پاداش: <strong style="color: var(--gold-light);">+${pd(c.xp)} XP</strong>
                        </div>
                    </div>
                    <div>
                        ${c.claimed ? `
                            <span style="font-size: 12px; color: var(--text-dim); background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: var(--radius-full);">دریافت شده</span>
                        ` : isCompleted ? `
                            <button class="btn-gold" style="padding: 6px 14px; font-size: 12px;" onclick="Gamification.claimChallenge('${c.id}')">دریافت پاداش 🎉</button>
                        ` : `
                            <span style="font-size: 12px; color: var(--text-dim);">در حال انجام</span>
                        `}
                    </div>
                </div>
            `;
        }).join('');
    }

    function claimChallenge(id) {
        const challenges = Storage.get('daily_challenges', []);
        const ch = challenges.find(c => c.id === id);
        if (ch && !ch.claimed) {
            ch.claimed = true;
            Storage.set('daily_challenges', challenges);
            Storage.addXP(ch.xp);

            renderLevelProgress();
            renderChallenges();

            if (typeof Utils !== 'undefined') {
                Utils.showToast(`🎉 تبریک! پاداش +${Utils.toPersianDigits(ch.xp)} امتیاز دریافت شد!`, 'success');
                Utils.launchConfetti();
            }
        }
    }

    function renderLeaderboard() {
        const tbody = document.getElementById('game-leaderboard-tbody');
        if (!tbody) return;

        const board = [
            { rank: 1, name: 'مهندس رضوانی', avatar: '👨‍🏫', xp: 2850, level: 'استاد بزرگ', badge: '🥇' },
            { rank: 2, name: 'سارا محمدی', avatar: '👩‍🎓', xp: 1950, level: 'نخبه علمی', badge: '🥈' },
            { rank: 3, name: 'آرش کیانی', avatar: '🧑‍💻', xp: 1420, level: 'نخبه علمی', badge: '🥉' },
            { rank: 4, name: 'مریم صالحی', avatar: '👩‍⚕️', xp: 1100, level: 'پژوهشگر', badge: '۴' },
            { rank: 5, name: 'امیرحسین دهقان', avatar: '👨‍💼', xp: 870, level: 'پژوهشگر', badge: '۵' }
        ];

        const pd = typeof Utils !== 'undefined' ? Utils.toPersianDigits : (v => v);

        tbody.innerHTML = board.map(item => `
            <tr>
                <td style="font-size: 18px; font-weight: 800; text-align: center;">${item.badge}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 20px;">${item.avatar}</span>
                        <span style="font-weight: 700;">${item.name}</span>
                    </div>
                </td>
                <td><span class="brand-badge">${item.level}</span></td>
                <td><strong style="color: var(--gold-light);">${pd(item.xp)} XP</strong></td>
            </tr>
        `).join('');
    }

    return {
        init,
        renderLevelProgress,
        claimChallenge
    };
})();

if (typeof window !== 'undefined') {
    window.Gamification = Gamification;
}
