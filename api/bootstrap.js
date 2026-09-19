const { db, getSession, decorateUser, listManagedStudents } = require('./_supabase');
module.exports = async (req, res) => {
    try {
        const user = await getSession(req);
        if (!user) return res.status(200).json({ user: null, data: {} });
        const rows = await db(`app_data?username=eq.${encodeURIComponent(user.username)}&select=key,value`);
        const data = Object.fromEntries((rows || []).map(row => [row.key, row.value]));
        const decorated = await decorateUser(user);
        const users = ['admin', 'advisor'].includes(decorated.accountType) ? await listManagedStudents(user) : undefined;
        res.status(200).json({ user: decorated, data, users });
    } catch (error) { res.status(500).json({ error: error.message }); }
};
