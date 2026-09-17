const { db, hashPassword, verifyPassword, publicUser, crypto } = require('./_supabase');

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
        const { action, username: rawUsername, password, name, grade } = req.body || {};
        const username = String(rawUsername || '').trim().toLowerCase();
        if (!/^[a-z0-9_.-]{3,32}$/.test(username) || String(password || '').length < 4) return res.status(400).json({ error: 'نام کاربری یا رمز عبور معتبر نیست.' });
        let profile;
        if (action === 'register') {
            if ((await db(`profiles?username=eq.${encodeURIComponent(username)}&select=username`)).length) return res.status(409).json({ error: 'این نام کاربری قبلاً ثبت شده است.' });
            const existing = await db('profiles?select=username');
            profile = (await db('profiles', { method: 'POST', body: JSON.stringify({
                username, password_hash: hashPassword(password), name: String(name || username).slice(0, 80), grade: String(grade || '').slice(0, 80),
                role: existing.length ? 'user' : 'admin', plan: 'free', avatar: '👩‍🎓', xp: 100, level: 1, streak: 1
            }) }))[0];
        } else if (action === 'login') {
            profile = (await db(`profiles?username=eq.${encodeURIComponent(username)}&select=*`))[0];
            if (!profile || !verifyPassword(password, profile.password_hash)) return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است.' });
        } else return res.status(400).json({ error: 'درخواست نامعتبر است.' });

        const token = crypto.randomBytes(32).toString('hex');
        await db('sessions', { method: 'POST', body: JSON.stringify({ token, username, expires_at: new Date(Date.now() + 30 * 864e5).toISOString() }) });
        setCookie(res, token);
        const rows = await db(`app_data?username=eq.${encodeURIComponent(username)}&select=key,value`);
        const data = Object.fromEntries((rows || []).map(row => [row.key, row.value]));
        const users = profile.role === 'admin' ? (await db('profiles?select=*')).map(publicUser) : undefined;
        res.status(200).json({ user: publicUser(profile), data, users });
    } catch (error) { res.status(500).json({ error: error.message }); }
};
