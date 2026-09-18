const { db, getSession } = require('./_supabase');
module.exports = async (req, res) => {
    try {
        const user = await getSession(req);
        if (!user) return res.status(401).json({ error: 'ابتدا وارد حساب شوید.' });
        const key = String(req.body?.key || '').trim();
        if (!key || key.length > 80) return res.status(400).json({ error: 'کلید داده معتبر نیست.' });
        if (['advisor_chat', 'admin_note'].includes(key)) return res.status(403).json({ error: 'این داده فقط از مسیر امن اختصاصی قابل تغییر است.' });
        if (req.method === 'DELETE') await db(`app_data?username=eq.${encodeURIComponent(user.username)}&key=eq.${encodeURIComponent(key)}`, { method: 'DELETE' });
        else if (req.method === 'POST') await db('app_data?on_conflict=username,key', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: JSON.stringify({ username: user.username, key, value: req.body.value, updated_at: new Date().toISOString() }) });
        else return res.status(405).json({ error: 'Method not allowed' });
        res.status(200).json({ ok: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
};
