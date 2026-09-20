const { db, getSession, verifyPassword, hashPassword } = require('./_supabase');
const allowed = ['name', 'grade', 'role', 'plan', 'avatar', 'xp', 'level', 'streak'];
const clean = user => Object.fromEntries(allowed.filter(key => user[key] !== undefined).map(key => [key, user[key]]));

module.exports = async (req, res) => {
    try {
        const actor = await getSession(req);
        if (!actor) return res.status(401).json({ error: 'ابتدا وارد حساب شوید.' });
        if (req.method === 'DELETE') {
            if (actor.username === 'kiankaki') return res.status(403).json({ error: 'حساب مدیر اصلی از داخل برنامه قابل حذف نیست.' });
            const confirmation = String(req.body?.confirmation || '').trim().toLowerCase();
            const password = String(req.body?.password || '');
            if (confirmation !== actor.username) return res.status(400).json({ error: 'نام کاربری تأییدشده صحیح نیست.' });
            if (!verifyPassword(password, actor.password_hash)) return res.status(401).json({ error: 'رمز عبور صحیح نیست.' });
            const advisors = await db('app_data?key=eq.linked_students&select=username,value');
            for (const row of advisors || []) {
                const linked = Array.isArray(row.value) ? row.value.filter(item => item !== actor.username) : [];
                if (linked.length !== row.value.length) await db(`app_data?username=eq.${encodeURIComponent(row.username)}&key=eq.linked_students`, { method: 'PATCH', body: JSON.stringify({ value: linked, updated_at: new Date().toISOString() }) });
            }
            await db(`profiles?username=eq.${encodeURIComponent(actor.username)}`, { method: 'DELETE' });
            res.setHeader('Set-Cookie', 'studymate_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
            return res.status(200).json({ ok: true });
        } else if (req.method === 'PUT') {
            const target = req.body?.user || {};
            if (target.username !== actor.username && actor.username !== 'kiankaki') return res.status(403).json({ error: 'دسترسی ندارید.' });
            const patch = clean(target);
            if (target.newPassword !== undefined) {
                if (target.username !== actor.username || !verifyPassword(String(target.currentPassword || ''), actor.password_hash)) return res.status(401).json({ error: 'رمز عبور فعلی صحیح نیست.' });
                if (String(target.newPassword).length < 8) return res.status(400).json({ error: 'رمز عبور جدید باید حداقل ۸ نویسه باشد.' });
                patch.password_hash = hashPassword(String(target.newPassword));
            }
            if (actor.username !== 'kiankaki') { delete patch.role; delete patch.plan; }
            if (target.username !== 'kiankaki') delete patch.role;
            await db(`profiles?username=eq.${encodeURIComponent(target.username)}`, { method: 'PATCH', body: JSON.stringify(patch) });
        } else if (req.method === 'POST' && actor.username === 'kiankaki') {
            for (const user of req.body?.users || []) await db(`profiles?username=eq.${encodeURIComponent(user.username)}`, { method: 'PATCH', body: JSON.stringify(clean(user)) });
        } else return res.status(405).json({ error: 'Method not allowed' });
        res.status(200).json({ ok: true });
    } catch (error) { console.error('api/users.js failed:', error); res.status(500).json({ error: 'در حال حاضر ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.' }); }
};
