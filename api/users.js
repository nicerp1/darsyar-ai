const { db, getSession } = require('./_supabase');
const allowed = ['name', 'grade', 'role', 'plan', 'avatar', 'xp', 'level', 'streak'];
const clean = user => Object.fromEntries(allowed.filter(key => user[key] !== undefined).map(key => [key, user[key]]));

module.exports = async (req, res) => {
    try {
        const actor = await getSession(req);
        if (!actor) return res.status(401).json({ error: 'ابتدا وارد حساب شوید.' });
        if (req.method === 'PUT') {
            const target = req.body?.user || {};
            if (target.username !== actor.username && actor.username !== 'kiankaki') return res.status(403).json({ error: 'دسترسی ندارید.' });
            const patch = clean(target);
            if (actor.username !== 'kiankaki') { delete patch.role; delete patch.plan; }
            if (target.username !== 'kiankaki') delete patch.role;
            await db(`profiles?username=eq.${encodeURIComponent(target.username)}`, { method: 'PATCH', body: JSON.stringify(patch) });
        } else if (req.method === 'POST' && actor.username === 'kiankaki') {
            for (const user of req.body?.users || []) await db(`profiles?username=eq.${encodeURIComponent(user.username)}`, { method: 'PATCH', body: JSON.stringify(clean(user)) });
        } else return res.status(405).json({ error: 'Method not allowed' });
        res.status(200).json({ ok: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
};
