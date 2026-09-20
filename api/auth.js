const { db, hashPassword, verifyPassword, decorateUser, listManagedStudents, findStudentAdvisor, crypto } = require('./_supabase');

function setCookie(res, token, maxAge = 60 * 60 * 24 * 30) {
    res.setHeader('Set-Cookie', `studymate_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`);
}

module.exports = async (req, res) => {
    try {
        if (req.method === 'DELETE') {
            const token = String(req.headers.cookie || '').match(/studymate_session=([^;]+)/)?.[1];
            if (token) await db(`sessions?token=eq.${encodeURIComponent(decodeURIComponent(token))}`, { method: 'DELETE' });
            setCookie(res, '', 0);
            return res.status(200).json({ ok: true });
        }
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        const { action, username: rawUsername, password, name, grade, accountType: rawAccountType, ageGroup, legalAccepted, parentalConsent } = req.body || {};
        const username = String(rawUsername || '').trim().toLowerCase();
        if (!/^[a-z0-9_.-]{3,32}$/.test(username) || String(password || '').length < 4) return res.status(400).json({ error: 'نام کاربری یا رمز عبور معتبر نیست.' });
        let profile;
        if (action === 'register') {
            if (String(password || '').length < 8) return res.status(400).json({ error: 'رمز عبور باید حداقل ۸ نویسه باشد.' });
            if (legalAccepted !== true) return res.status(400).json({ error: 'پذیرش قوانین و حریم خصوصی الزامی است.' });
            if (ageGroup === 'under18' && parentalConsent !== true) return res.status(400).json({ error: 'برای کاربران زیر ۱۸ سال تأیید رضایت والدین الزامی است.' });
            if ((await db(`profiles?username=eq.${encodeURIComponent(username)}&select=username`)).length) return res.status(409).json({ error: 'این نام کاربری قبلاً ثبت شده است.' });
            profile = (await db('profiles', { method: 'POST', body: JSON.stringify({
                username, password_hash: hashPassword(password), name: String(name || username).slice(0, 80), grade: String(grade || '').slice(0, 80),
                role: username === 'kiankaki' ? 'admin' : 'user', plan: 'free', avatar: rawAccountType === 'advisor' ? '👨‍🏫' : '👩‍🎓', xp: 0, level: 1, streak: 0
            }) }))[0];
            const accountType = username === 'kiankaki' ? 'admin' : rawAccountType === 'advisor' ? 'advisor' : 'student';
            await db('app_data?on_conflict=username,key', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: JSON.stringify({ username, key: 'account_type', value: accountType, updated_at: new Date().toISOString() }) });
            await db('app_data?on_conflict=username,key', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: JSON.stringify({ username, key: 'legal_consent', value: { ageGroup: ageGroup === 'under18' ? 'under18' : 'adult', parentalConsent: ageGroup === 'under18' ? true : false, acceptedAt: new Date().toISOString(), version: '2026-09-20' }, updated_at: new Date().toISOString() }) });
        } else if (action === 'login') {
            profile = (await db(`profiles?username=eq.${encodeURIComponent(username)}&select=*`))[0];
            if (!profile || !verifyPassword(password, profile.password_hash)) return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است.' });
        } else return res.status(400).json({ error: 'درخواست نامعتبر است.' });

        const token = crypto.randomBytes(32).toString('hex');
        await db('sessions', { method: 'POST', body: JSON.stringify({ token, username, expires_at: new Date(Date.now() + 30 * 864e5).toISOString() }) });
        setCookie(res, token);
        const rows = await db(`app_data?username=eq.${encodeURIComponent(username)}&select=key,value`);
        const data = Object.fromEntries((rows || []).filter(row => row.key !== 'chat_reports').map(row => [row.key, row.value]));
        const user = await decorateUser(profile);
        if (user.accountType === 'student') user.advisor = await findStudentAdvisor(user.username);
        const users = ['admin', 'advisor'].includes(user.accountType) ? await listManagedStudents(profile) : undefined;
        res.status(200).json({ user, data, users });
    } catch (error) { console.error('api/auth.js failed:', error); res.status(500).json({ error: 'در حال حاضر ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.' }); }
};
