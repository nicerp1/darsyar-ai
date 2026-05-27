// api/login.js - API لاگین کاربر
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است' });
    }

    try {
        // گرفتن کاربران از Upstash
        const url = `${process.env.UPSTASH_REDIS_REST_URL}/get/users`;
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` }
        });
        const data = await response.json();
        const users = JSON.parse(data.result || '{}');
        
        // چک کن کاربر هست یا نه
        if (!users[username]) {
            return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
        }

        // چک کردن رمز
        if (users[username].password !== password) {
            return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
        }

        // برگردوندن اطلاعات کاربر
        return res.status(200).json({
            success: true,
            user: {
                username,
                name: users[username].name,
                email: users[username].email,
                role: users[username].role,
                subscription: users[username].subscription,
                subscriptionExpire: users[username].subscriptionExpire
            }
        });
    } catch (error) {
        return res.status(500).json({ error: 'خطای سرور. دوباره تلاش کنید.' });
    }
}