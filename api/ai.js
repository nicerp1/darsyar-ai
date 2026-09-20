const { getSession } = require('./_supabase');
module.exports = async (req, res) => {
    try {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        if (!(await getSession(req))) return res.status(401).json({ error: 'ابتدا وارد حساب شوید.' });
        if (!process.env.GAPGPT_API_KEY) return res.status(503).json({ error: 'ابزار هوشمند موقتاً در دسترس نیست. لطفاً بعداً دوباره تلاش کنید.' });
        const allowedModels = new Set(['gapgpt-qwen-3.5', 'gapgpt-llama-3', 'gapgpt-deepseek']);
        const inputMessages = Array.isArray(req.body?.messages) ? req.body.messages.slice(-12).map(item => ({ role: item?.role === 'assistant' ? 'assistant' : 'user', content: String(item?.content || '').slice(0, 12000) })) : [];
        const messages = [{ role: 'system', content: 'تو دستیار آموزشی فارسی درسیار برای کاربران همه سنین هستی. پاسخ‌ها باید ایمن، محترمانه، متناسب با سن و صرفاً آموزشی باشند. از تولید محتوای جنسی، خشونت‌آمیز، خودآزاری، نفرت‌پراکن، مجرمانه یا درخواست اطلاعات شخصی خودداری کن. در موضوع خطر فوری، کاربر را به والد یا سرپرست و خدمات فوریتی محلی ارجاع بده. اطلاعات قطعی‌نما یا منبع ساختگی نساز و محدودیت خود را شفاف بیان کن.' }, ...inputMessages];
        if (!inputMessages.length) return res.status(400).json({ error: 'پیام معتبر ارسال نشده است.' });
        const safeBody = { ...req.body, model: allowedModels.has(req.body?.model) ? req.body.model : 'gapgpt-qwen-3.5', messages, max_tokens: Math.min(6000, Math.max(256, Number(req.body?.max_tokens) || 1200)) };
        const upstream = await fetch('https://api.gapgpt.app/v1/chat/completions', {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GAPGPT_API_KEY}` },
            body: JSON.stringify(safeBody)
        });
        const payload = await upstream.json();
        res.status(upstream.status).json(payload);
    } catch (error) { console.error('api/ai.js failed:', error); res.status(500).json({ error: 'در حال حاضر ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.' }); }
};
