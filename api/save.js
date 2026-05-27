// api/save.js - API ذخیره داده‌های کاربر
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { username, key, value } = req.body;
    
    if (!username || !key) {
        return res.status(400).json({ error: 'اطلاعات ناقص است' });
    }

    try {
        const url = `${process.env.UPSTASH_REDIS_REST_URL}/set/${username}_${key}`;
        await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ value: JSON.stringify(value) })
        });

        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: 'خطای سرور' });
    }
}