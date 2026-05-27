// api/register.js - API ثبت‌نام کاربر جدید
export default async function handler(req, res) {
    // فقط POST قبول کن
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { username, email, password, name } = req.body;
    
    // اعتبارسنجی
    if (!username || !password || !email) {
        return res.status(400).json({ error: 'نام کاربری، ایمیل و رمز عبور الزامی است' });
    }

    if (username.length < 3) {
        return res.status(400).json({ error: 'نام کاربری حداقل ۳ کاراکتر باشد' });
    }

    if (password.length < 4) {
        return res.status(400).json({ error: 'رمز عبور حداقل ۴ کاراکتر باشد' });
    }

    try {
        // گرفتن لیست کاربران از Upstash
        const checkUrl = `${process.env.UPSTASH_REDIS_REST_URL}/get/users`;
        const checkResponse = await fetch(checkUrl, {
            headers: { 'Authorization': `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` }
        });
        const checkData = await checkResponse.json();
        let users = JSON.parse(checkData.result || '{}');
        
        // چک کن کاربر قبلاً نباشه
        if (users[username]) {
            return res.status(400).json({ error: 'این نام کاربری قبلاً ثبت شده است' });
        }

        // ساختن کاربر جدید
        users[username] = {
            password,
            email,
            name: name || username,
            role: 'user',
            subscription: 'free',
            subscriptionExpire: null,
            createdAt: new Date().toISOString()
        };

        // ذخیره توی Upstash
        const saveUrl = `${process.env.UPSTASH_REDIS_REST_URL}/set/users`;
        await fetch(saveUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ value: JSON.stringify(users) })
        });

        // برگردوندن موفقیت + اطلاعات کاربر
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
        return res.status(500).json({ error: 'خطای سرور. دوباره تلاش کنید.' });
    }
}