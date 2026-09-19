const { getSession } = require('./_supabase');
module.exports = async (req, res) => {
    try {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        if (!(await getSession(req))) return res.status(401).json({ error: 'ابتدا وارد حساب شوید.' });
        if (!process.env.GAPGPT_API_KEY) return res.status(503).json({ error: 'AI API is not configured' });
        const allowedModels = new Set(['gapgpt-qwen-3.5', 'gapgpt-llama-3', 'gapgpt-deepseek']);
        const messages = Array.isArray(req.body?.messages) ? req.body.messages.slice(-12).map(item => ({ role: ['system','user','assistant'].includes(item?.role) ? item.role : 'user', content: String(item?.content || '').slice(0, 30000) })) : [];
        if (!messages.length) return res.status(400).json({ error: 'پیام معتبر ارسال نشده است.' });
        const safeBody = { ...req.body, model: allowedModels.has(req.body?.model) ? req.body.model : 'gapgpt-qwen-3.5', messages, max_tokens: Math.min(6000, Math.max(256, Number(req.body?.max_tokens) || 1200)) };
        const upstream = await fetch('https://api.gapgpt.app/v1/chat/completions', {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GAPGPT_API_KEY}` },
            body: JSON.stringify(safeBody)
        });
        const payload = await upstream.json();
        res.status(upstream.status).json(payload);
    } catch (error) { res.status(500).json({ error: error.message }); }
};
