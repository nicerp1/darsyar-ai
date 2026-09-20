const { db, getSession, decorateUser, listManagedStudents } = require('./_supabase');
module.exports = async (req, res) => {
    try {
        const user = await getSession(req);
        if (!user) return res.status(200).json({ user: null, data: {} });
        const rows = await db(`app_data?username=eq.${encodeURIComponent(user.username)}&select=key,value`);
        const privateKeys = new Set(['chat_reports']);
        const data = Object.fromEntries((rows || []).filter(row => !privateKeys.has(row.key)).map(row => [row.key, row.value]));
        const decorated = await decorateUser(user);
        const users = ['admin', 'advisor'].includes(decorated.accountType) ? await listManagedStudents(user) : undefined;
        res.status(200).json({ user: decorated, data, users });
    } catch (error) { console.error('api/bootstrap.js failed:', error); res.status(500).json({ error: 'در حال حاضر ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.' }); }
};
