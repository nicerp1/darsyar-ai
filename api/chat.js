const { db, getSession, getAccountType, canManageStudent } = require('./_supabase');
const crypto = require('crypto');

async function getMessages(username) {
    const rows = await db(`app_data?username=eq.${encodeURIComponent(username)}&key=eq.advisor_chat&select=value`);
    return Array.isArray(rows?.[0]?.value) ? rows[0].value : [];
}

async function getChatState(username) {
    const rows = await db(`app_data?username=eq.${encodeURIComponent(username)}&key=in.(chat_blocked,chat_reports)&select=key,value`);
    return Object.fromEntries((rows || []).map(row => [row.key, row.value]));
}

async function saveValue(username, key, value) {
    await db('app_data?on_conflict=username,key', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: JSON.stringify({ username, key, value, updated_at: new Date().toISOString() }) });
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
        if (req.method === 'GET') {
            const state = await getChatState(username);
            return res.status(200).json({ messages: await getMessages(username), blocked: state.chat_blocked || null });
        }
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        const action = String(req.body?.action || 'send');
        if (action === 'report') {
            const messageId = String(req.body?.messageId || '').slice(0, 100);
            const reason = String(req.body?.reason || 'محتوای نامناسب').trim().slice(0, 300);
            const message = (await getMessages(username)).find(item => item.id === messageId);
            if (!message) return res.status(404).json({ error: 'پیام موردنظر پیدا نشد.' });
            const state = await getChatState(username), reports = Array.isArray(state.chat_reports) ? state.chat_reports.slice(-49) : [];
            reports.push({ id: crypto.randomUUID(), messageId, reason, reportedBy: actor.username, reportedAt: new Date().toISOString(), snapshot: { sender: message.sender, text: String(message.text || '').slice(0, 500) } });
            await saveValue(username, 'chat_reports', reports);
            return res.status(200).json({ ok: true });
        }
        if (action === 'block') {
            const state = await getChatState(username);
            if (req.body?.blocked !== true && state.chat_blocked?.by && state.chat_blocked.by !== actor.username && accountType !== 'admin') return res.status(403).json({ error: 'فقط کاربری که گفت‌وگو را متوقف کرده یا مدیر می‌تواند آن را دوباره فعال کند.' });
            const blocked = req.body?.blocked === true ? { by: actor.username, at: new Date().toISOString() } : null;
            await saveValue(username, 'chat_blocked', blocked);
            return res.status(200).json({ ok: true, blocked });
        }
        const state = await getChatState(username);
        if (state.chat_blocked) return res.status(403).json({ error: 'این گفت‌وگو متوقف شده است. برای ادامه با پشتیبانی درسیار تماس بگیرید.' });
        const text = String(req.body?.text || '').trim().slice(0, 1000);
        if (!text) return res.status(400).json({ error: 'متن پیام خالی است.' });
        const messages = (await getMessages(username)).slice(-199);
        messages.push({ id: `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`, sender: isManager ? 'advisor' : 'student', senderName: actor.name || (isManager ? 'مشاور' : actor.username), text, createdAt: new Date().toISOString() });
        await saveValue(username, 'advisor_chat', messages);
        return res.status(200).json({ ok: true, messages });
    } catch (error) { console.error('api/chat.js failed:', error); return res.status(500).json({ error: 'در حال حاضر ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.' }); }
};
