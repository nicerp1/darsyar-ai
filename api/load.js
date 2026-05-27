// api/load.js - API بارگذاری داده‌های کاربر
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { username, key } = req.query;
    
    if (!username || !key) {
        return res.status(400).json({ error: 'اطلاعات ناقص است' });
    }

    try {
        const url = `${process.env.UPSTASH_REDIS_REST_URL}/get/${username}_${key}`;
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` }
        });
        const data = await response.json();
        
        return res.status(200).json({
            success: true,
            data: JSON.parse(data.result || 'null')
        });
    } catch (error) {
        return res.status(500).json({ error: 'خطای سرور' });
    }
}