const { db, getSession, getAccountType, canManageStudent } = require('./_supabase');
const crypto = require('crypto');

async function getMessages(username) {
    const rows = await db(`app_data?username=eq.${encodeURIComponent(username)}&key=eq.advisor_chat&select=value`);
    return Array.isArray(rows?.[0]?.value) ? rows[0].value : [];
}

module.exports = async (req, res) => {
    try {
        const actor = await getSession(req);
        if (!actor) return res.status(401).json({ error: 'ابتدا وارد حساب شوید.' });
        const accountType = await getAccountType(actor.username);
        const isManager = ['admin', 'advisor'].includes(accountType);
        const requested = String((req.method === 'GET' ? req.query?.username : req.body?.username) || '').trim().toLowerCase();
        const username = isManager ? requested : actor.username;
        if (!username || username === 'kiankaki') return res.status(400).json({ error: 'دانش‌آموز معتبر انتخاب نشده است.' });
        if (isManager && !(await canManageStudent(actor, username))) return res.status(403).json({ error: 'این دانش‌آموز به حساب شما متصل نیست.' });
        if (req.method === 'GET') return res.status(200).json({ messages: await getMessages(username) });
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        const text = String(req.body?.text || '').trim().slice(0, 1000);
        if (!text) return res.status(400).json({ error: 'متن پیام خالی است.' });
        const messages = (await getMessages(username)).slice(-199);
        messages.push({ id: `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`, sender: isManager ? 'advisor' : 'student', senderName: actor.name || (isManager ? 'مشاور' : actor.username), text, createdAt: new Date().toISOString() });
        await db('app_data?on_conflict=username,key', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: JSON.stringify({ username, key: 'advisor_chat', value: messages, updated_at: new Date().toISOString() }) });
        return res.status(200).json({ ok: true, messages });
    } catch (error) { return res.status(500).json({ error: error.message }); }
};
