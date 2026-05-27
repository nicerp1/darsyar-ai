// api/register.js - API ثبت‌نام کاربر جدید (نسخه اصلاح شده)
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { username, email, password, name } = req.body;
    
    if (!username || !password || !email) {
        return res.status(400).json({ error: 'نام کاربری، ایمیل و رمز عبور الزامی است' });
    }

    if (username.length < 3) {
        return res.status(400).json({ error: 'نام کاربری حداقل ۳ کاراکتر باشد' });
    }

    if (password.length < 4) {
        return res.status(400).json({ error: 'رمز عبور حداقل ۴ کاراکتر باشد' });
    }

    // نمی‌ذاره admin ثبت‌نام کنه
    if (username === 'admin') {
        return res.status(400).json({ error: 'این نام کاربری مجاز نیست' });
    }

    try {
        const checkUrl = `${process.env.UPSTASH_REDIS_REST_URL}/get/users`;
        const checkResponse = await fetch(checkUrl, {
            headers: { 'Authorization': `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` }
        });
        
        if (!checkResponse.ok) {
            return res.status(503).json({ error: 'سرور موقتاً در دسترس نیست' });
        }
        
        const checkData = await checkResponse.json();
        let users = {};
        try { users = JSON.parse(checkData.result || '{}'); } catch(e) { users = {}; }
        
        if (users[username]) {
            return res.status(400).json({ error: 'این نام کاربری قبلاً ثبت شده است' });
        }

        users[username] = {
            password,
            email,
            name: name || username,
            role: 'user',
            subscription: 'free',
            subscriptionExpire: null,
            createdAt: new Date().toISOString()
        };

        const saveUrl = `${process.env.UPSTASH_REDIS_REST_URL}/set/users`;
        await fetch(saveUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ value: JSON.stringify(users) })
        });

        return res.status(200).json({
            success: true,
            message: 'ثبت‌نام با موفقیت انجام شد',
            user: {
                username,
                name: users[username].name,
                email: users[username].email,
                role: 'user',
                subscription: 'free'
            }
        });
    } catch (error) {
        return res.status(500).json({ error: 'خطای سرور' });
    }
}
