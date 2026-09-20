/** StudyMate server-backed store. Nothing is persisted in browser storage. */
const Storage = (function () {
    const cache = Object.create(null);
    let currentUser = null;
    let saveChain = Promise.resolve();

    async function request(url, options = {}) {
        const response = await fetch(url, {
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
            ...options
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'خطا در ارتباط با سرور');
        return payload;
    }

    async function init() {
        const payload = await request('/api/bootstrap');
        currentUser = payload.user || null;
        Object.assign(cache, payload.data || {});
        if (payload.users) cache.users = payload.users;
    }

    function get(key, defaultValue = null) {
        return Object.prototype.hasOwnProperty.call(cache, key) ? cache[key] : defaultValue;
    }

    function persist(key, value, remove = false) {
        if (!currentUser) return;
        saveChain = saveChain.then(() => request('/api/data', {
            method: remove ? 'DELETE' : 'POST', body: JSON.stringify({ key, value })
        })).catch(error => {
            console.error('Database sync failed:', error);
            if (typeof Utils !== 'undefined') Utils.showToast('ذخیره در دیتابیس انجام نشد.', 'error');
        });
    }

    function set(key, value) { cache[key] = value; persist(key, value); return true; }
    function remove(key) { delete cache[key]; persist(key, null, true); return true; }
    function getCurrentUser() { return currentUser; }
    function setCurrentUser(user) { currentUser = user || null; }

    async function login(username, password) {
        const payload = await request('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'login', username, password }) });
        currentUser = payload.user;
        Object.keys(cache).forEach(key => delete cache[key]);
        Object.assign(cache, payload.data || {});
        if (payload.users) cache.users = payload.users;
        return currentUser;
    }

    async function register(user) {
        const payload = await request('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'register', ...user }) });
        currentUser = payload.user;
        Object.keys(cache).forEach(key => delete cache[key]);
        return currentUser;
    }

    async function logout() {
        await request('/api/auth', { method: 'DELETE' });
        currentUser = null;
        Object.keys(cache).forEach(key => delete cache[key]);
    }

    async function deleteAccount(confirmation, password) {
        await request('/api/users', { method: 'DELETE', body: JSON.stringify({ confirmation, password }) });
        currentUser = null;
        Object.keys(cache).forEach(key => delete cache[key]);
    }

    function getUsers() { return get('users', currentUser ? [currentUser] : []); }
    function saveUsers(users) {
        cache.users = users;
        if (currentUser?.accountType === 'admin') saveChain = saveChain.then(() => request('/api/users', { method: 'POST', body: JSON.stringify({ users }) })).catch(console.error);
        return true;
    }

    function updateUser(userData) {
        currentUser = { ...currentUser, ...userData };
        const users = getUsers();
        const index = users.findIndex(user => user.username === currentUser.username);
        if (index >= 0) users[index] = currentUser;
        cache.users = users;
        saveChain = saveChain.then(() => request('/api/users', { method: 'PUT', body: JSON.stringify({ user: currentUser }) })).catch(console.error);
        return true;
    }

    async function changePassword(currentPassword, newPassword) {
        if (!currentUser) throw new Error('ابتدا وارد حساب شوید.');
        await request('/api/users', { method: 'PUT', body: JSON.stringify({ user: { username: currentUser.username, currentPassword, newPassword } }) });
    }

    function addXP(amount) {
        if (!currentUser) return;
        const xp = (currentUser.xp || 0) + amount;
        const level = xp >= 2500 ? 5 : xp >= 1200 ? 4 : xp >= 600 ? 3 : xp >= 200 ? 2 : 1;
        updateUser({ ...currentUser, xp, level });
        saveChain = saveChain.then(() => request('/api/social', { method: 'POST', body: JSON.stringify({ action: 'activity', points: amount }) })).catch(console.error);
        return { xp, level, gained: amount };
    }

    function getSettings() {
        return get('settings', { theme: 'dark', aiModel: 'gapgpt-qwen-3.5', soundEnabled: true, dailyGoalHours: 4, pomodoroWork: 25, pomodoroShortBreak: 5, pomodoroLongBreak: 15 });
    }
    function isManager() { return ['admin', 'advisor'].includes(currentUser?.accountType); }
    function saveSettings(settings) { return set('settings', settings); }

    return { init, get, set, remove, getCurrentUser, setCurrentUser, login, register, logout, deleteAccount, getUsers, saveUsers, updateUser, changePassword, addXP, getSettings, saveSettings, isManager };
})();

window.Storage = Storage;
