/** Real, opt-in student league and friendships. */
const Gamification = (function () {
    let model = null;
    const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));
    const pd = value => typeof Utils !== 'undefined' ? Utils.toPersianDigits(value) : value;
    async function request(options = {}) {
        const response = await fetch('/api/social', { credentials:'same-origin', headers:{ 'Content-Type':'application/json' }, ...options });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'خطا در ارتباط با لیگ');
        return payload;
    }
    function levelTitle(level) { return ['تازه‌کار','پوینده','پرتلاش','نخبه','استاد'][Math.max(1, Math.min(5, Number(level)||1))-1]; }
    function renderLevelProgress() {
        const user = Storage.getCurrentUser(); if (!user) return;
        const thresholds = [0,200,600,1200,2500,5000], level = Math.max(1, Number(user.level)||1), min = thresholds[level-1], max = thresholds[level] || thresholds.at(-1);
        const percent = Math.min(100, Math.max(0, Math.round(((Number(user.xp)||0)-min) / Math.max(1,max-min) * 100)));
        const title = document.getElementById('game-level-title'); if (title) title.textContent = `سطح ${pd(level)}: ${levelTitle(level)}`;
        const xp = document.getElementById('game-level-xp-text'); if (xp) xp.textContent = `${pd(user.xp||0)} از ${pd(max)} امتیاز`;
        const fill = document.getElementById('game-level-progress-fill'); if (fill) fill.style.width = `${percent}%`;
        const side = document.getElementById('sidebar-user-level'); if (side) side.textContent = `سطح ${pd(level)}`;
        const sideBar = document.getElementById('sidebar-xp-bar'); if (sideBar) sideBar.style.width = `${percent}%`;
    }
    function personCard(person, actions = '') {
        return `<article class="social-person-card"><span class="social-avatar">${esc(person.avatar || '👩‍🎓')}</span><div><strong>${esc(person.name)}</strong><small>@${esc(person.username)}${person.grade ? ` · ${esc(person.grade)}` : ''}</small><em>${pd(person.xp)} امتیاز · ${esc(levelTitle(person.level))}</em></div>${actions}</article>`;
    }
    function render() {
        renderLevelProgress();
        const settings = model.settings || {};
        const toggle = document.getElementById('league-visible'); if (toggle) toggle.checked = settings.leagueVisible;
        const grade = document.getElementById('league-show-grade'); if (grade) grade.checked = settings.showGrade;
        const bio = document.getElementById('league-bio'); if (bio) bio.value = settings.bio || '';
        const board = document.getElementById('game-leaderboard');
        if (board) board.innerHTML = model.leaderboard.length ? model.leaderboard.map(item => `<article class="league-row ${item.isMe ? 'is-me' : ''}"><strong class="league-rank">${item.rank <= 3 ? `<span class="material-symbols-outlined" aria-hidden="true">${item.rank === 1 ? 'trophy' : 'military_tech'}</span><small>${pd(item.rank)}</small>` : pd(item.rank)}</strong><span class="social-avatar">${esc(item.avatar)}</span><div><strong>${esc(item.name)}${item.isMe ? ' (شما)' : ''}</strong><small>${esc(levelTitle(item.level))}${item.isFriend ? ' · دوست شما' : ''}</small></div><b>${pd(item.seasonPoints || 0)}<small> امتیاز فصل</small></b></article>`).join('') : '<div class="social-empty"><span class="material-symbols-outlined" aria-hidden="true">groups</span><p>هنوز کسی با رضایت خودش وارد لیگ نشده است.</p></div>';
        const friends = document.getElementById('friends-list'); if (friends) friends.innerHTML = model.friends.length ? model.friends.map(item => personCard(item, `<button type="button" class="social-icon-button danger" onclick="Gamification.friendAction('remove','${esc(item.username)}')" aria-label="حذف ${esc(item.name)} از دوستان"><span class="material-symbols-outlined" aria-hidden="true">person_remove</span></button>`)).join('') : '<div class="social-empty"><p>هنوز دوستی اضافه نکرده‌اید.</p></div>';
        const requests = document.getElementById('friend-requests');
        if (requests) { requests.classList.toggle('hidden', !model.requests.length); requests.innerHTML = model.requests.map(item => personCard(item, `<div class="social-actions"><button type="button" onclick="Gamification.friendAction('accept','${esc(item.username)}')">پذیرش</button><button type="button" class="secondary" onclick="Gamification.friendAction('reject','${esc(item.username)}')">رد</button></div>`)).join(''); }
    }
    async function init() {
        renderLevelProgress();
        const user = Storage.getCurrentUser(), shell = document.getElementById('game-social-shell');
        if (user?.accountType !== 'student') { if (shell) shell.innerHTML = '<div class="social-empty"><span class="material-symbols-outlined">school</span><p>لیگ و دوستان برای حساب دانش‌آموز فعال است.</p></div>'; return; }
        if (shell) shell.classList.add('is-loading');
        try { model = await request(); render(); } catch (error) { Utils.showToast(error.message, 'error'); }
        finally { if (shell) shell.classList.remove('is-loading'); }
    }
    async function saveSettings() {
        const button = document.getElementById('league-save'); if (button) button.disabled = true;
        try { await request({ method:'POST', body:JSON.stringify({ action:'settings', leagueVisible:document.getElementById('league-visible')?.checked, showGrade:document.getElementById('league-show-grade')?.checked, bio:document.getElementById('league-bio')?.value }) }); Utils.showToast('تنظیمات پروفایل لیگ ذخیره شد.', 'success'); await init(); }
        catch (error) { Utils.showToast(error.message, 'error'); } finally { if (button) button.disabled = false; }
    }
    async function sendRequest() {
        const input = document.getElementById('friend-username'), username = input?.value.trim().toLowerCase(); if (!username) return;
        try { await request({ method:'POST', body:JSON.stringify({ action:'request', username }) }); if (input) input.value=''; Utils.showToast('درخواست دوستی ارسال شد.', 'success'); }
        catch (error) { Utils.showToast(error.message, 'error'); }
    }
    async function friendAction(action, username) {
        try { await request({ method:'POST', body:JSON.stringify({ action, username }) }); await init(); Utils.showToast(action === 'accept' ? 'دوست جدید اضافه شد.' : 'فهرست دوستان به‌روزرسانی شد.', 'success'); }
        catch (error) { Utils.showToast(error.message, 'error'); }
    }
    return { init, renderLevelProgress, saveSettings, sendRequest, friendAction };
})();
window.Gamification = Gamification;
