// api/login.js - API لاگین کاربر (نسخه اصلاح شده)
export default async function handler(req, res) {
    // فقط POST قبول کن
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { username, password } = req.body;
    
    // اعتبارسنجی
    if (!username || !password) {
        return res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است' });
    }

    // admin محلی - همیشه کار میکنه
    if (username === 'admin' && password === '1234') {
        return res.status(200).json({
            success: true,
            user: {
                username: 'admin',
                name: 'مدیر سیستم',
                email: 'admin@darsyar.ir',
                role: 'admin',
                subscription: 'gold',
                subscriptionExpire: null
            }
        });
    }

    try {
        // گرفتن کاربران از Upstash
        const url = `${process.env.UPSTASH_REDIS_REST_URL}/get/users`;
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` }
        });
        
        if (!response.ok) {
            // Upstash در دسترس نیست
            return res.status(503).json({ error: 'سرور موقتاً در دسترس نیست' });
        }
        
        const data = await response.json();
        let users = {};
        
        try {
            users = JSON.parse(data.result || '{}');
        } catch(e) {
            users = {};
        }
        
        // چک کردن کاربر
        if (!users[username]) {
            return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
        }

        if (users[username].password !== password) {
            return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
        }

        // برگردوندن اطلاعات کاربر
        return res.status(200).json({
            success: true,
            user: {
                username: username,
                name: users[username].name || username,
                email: users[username].email || '',
                role: users[username].role || 'user',
                subscription: users[username].subscription || 'free',
                subscriptionExpire: users[username].subscriptionExpire || null
            }
        });
        
    } catch (error) {
        return res.status(500).json({ error: 'خطای سرور' });
    }
}
