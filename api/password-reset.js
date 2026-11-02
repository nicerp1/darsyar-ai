const { db, getSession, verifyPassword, hashPassword, crypto } = require('./_supabase');

const tokenKey = 'password_reset';
const ttlMs = 15 * 60 * 1000;
const usernamePattern = /^[a-z0-9_.-]{3,32}$/;
const tokenPattern = /^[a-f0-9]{64}$/;

module.exports = async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (req.method !== 'POST') return res.status(405).json({ error: 'درخواست معتبر نیست.' });
    const action = String(req.body?.action || '');
    const username = String(req.body?.username || '').trim().toLowerCase();
    if (!usernamePattern.test(username)) return res.status(400).json({ error: 'نام کاربری معتبر نیست.' });

    try {
        if (action === 'create') {
            const actor = await getSession(req);
            if (actor?.username !== 'kiankaki') return res.status(403).json({ error: 'فقط مدیر اصلی می‌تواند لینک بازیابی بسازد.' });
            if (!verifyPassword(String(req.body?.adminPassword || ''), actor.password_hash)) return res.status(401).json({ error: 'رمز عبور مدیر صحیح نیست.' });
            if (username === actor.username) return res.status(400).json({ error: 'برای حساب مدیر از بخش تغییر رمز پروفایل استفاده کنید.' });
            const target = await db(`profiles?username=eq.${encodeURIComponent(username)}&select=username`);
            if (!target?.length) return res.status(404).json({ error: 'کاربری با این نام پیدا نشد.' });
            const token = crypto.randomBytes(32).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            const expiresAt = new Date(Date.now() + ttlMs).toISOString();
            await db('app_data?on_conflict=username,key', {
                method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal',
                body: JSON.stringify({ username, key: tokenKey, value: { tokenHash, expiresAt }, updated_at: new Date().toISOString() })
            });
            return res.status(200).json({ token, username, expiresAt });
        }

        if (action === 'consume') {
            const token = String(req.body?.token || '').toLowerCase();
            const password = String(req.body?.password || '');
            const confirmation = String(req.body?.confirmation || '');
            if (!tokenPattern.test(token)) return res.status(400).json({ error: 'لینک بازیابی معتبر نیست.' });
            if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'رمز تازه باید بین ۸ تا ۱۲۸ نویسه باشد.' });
            if (password !== confirmation) return res.status(400).json({ error: 'تکرار رمز عبور یکسان نیست.' });
            const path = `app_data?username=eq.${encodeURIComponent(username)}&key=eq.${tokenKey}&select=value`;
            const record = (await db(path))?.[0]?.value;
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            const expiry = Date.parse(record?.expiresAt);
            if (!record || record.tokenHash !== tokenHash || !Number.isFinite(expiry) || expiry <= Date.now()) {
                return res.status(400).json({ error: 'این لینک نامعتبر یا منقضی شده است؛ از پشتیبانی لینک تازه بخواهید.' });
            }
            // The conditional delete consumes the token atomically: only one concurrent request can win.
            const consumed = await db(`app_data?username=eq.${encodeURIComponent(username)}&key=eq.${tokenKey}&value->>tokenHash=eq.${tokenHash}`, {
                method: 'DELETE', prefer: 'return=representation'
            });
            if (consumed?.length !== 1) return res.status(400).json({ error: 'این لینک قبلاً استفاده شده است؛ از پشتیبانی لینک تازه بخواهید.' });
            await db(`profiles?username=eq.${encodeURIComponent(username)}`, {
                method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ password_hash: hashPassword(password) })
            });
            await db(`sessions?username=eq.${encodeURIComponent(username)}`, { method: 'DELETE', prefer: 'return=minimal' });
            return res.status(200).json({ ok: true });
        }
        return res.status(400).json({ error: 'درخواست نامعتبر است.' });
    } catch (error) {
        console.error('password reset failed', error);
        return res.status(500).json({ error: 'در حال حاضر بازیابی رمز انجام نشد؛ لطفاً دوباره تلاش کنید.' });
    }
};
