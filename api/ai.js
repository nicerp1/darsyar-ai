const { getSession } = require('./_supabase');
module.exports = async (req, res) => {
    try {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        if (!(await getSession(req))) return res.status(401).json({ error: 'ابتدا وارد حساب شوید.' });
        if (!process.env.GAPGPT_API_KEY) return res.status(503).json({ error: 'AI API is not configured' });
        const upstream = await fetch('https://api.gapgpt.app/v1/chat/completions', {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GAPGPT_API_KEY}` },
            body: JSON.stringify(req.body)
        });
        const payload = await upstream.json();
        res.status(upstream.status).json(payload);
    } catch (error) { res.status(500).json({ error: error.message }); }
};
