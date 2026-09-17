const { db, getSession, publicUser } = require('./_supabase');
module.exports = async (req, res) => {
    try {
        const user = await getSession(req);
        if (!user) return res.status(200).json({ user: null, data: {} });
        const rows = await db(`app_data?username=eq.${encodeURIComponent(user.username)}&select=key,value`);
        const data = Object.fromEntries((rows || []).map(row => [row.key, row.value]));
        const users = user.username === 'kiankaki' ? (await db('profiles?select=*')).map(publicUser) : undefined;
        res.status(200).json({ user: publicUser(user), data, users });
    } catch (error) { res.status(500).json({ error: error.message }); }
};
