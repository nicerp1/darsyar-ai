const { db, getSession, publicUser } = require('./_supabase');

const days = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
const times = ['۰۸:۰۰ - ۱۰:۰۰', '۱۰:۰۰ - ۱۲:۰۰', '۱۴:۰۰ - ۱۶:۰۰', '۱۶:۰۰ - ۱۸:۰۰', '۱۸:۰۰ - ۲۰:۰۰', '۲۰:۰۰ - ۲۲:۰۰'];
const emptySchedule = () => days.map((day, dayIndex) => ({ day, dayIndex, slots: times.map(time => ({ time, subject: '', note: '', color: '#05319e' })) }));

async function requireOwner(req, res) {
    const actor = await getSession(req);
    if (!actor || actor.username !== 'kiankaki') {
        res.status(403).json({ error: 'دسترسی فقط برای مدیر اصلی مجاز است.' });
        return null;
    }
    return actor;
}

async function getStudent(username) {
    return (await db(`profiles?username=eq.${encodeURIComponent(username)}&select=*`))[0] || null;
}

async function getData(username) {
    const rows = await db(`app_data?username=eq.${encodeURIComponent(username)}&select=key,value`);
    return Object.fromEntries((rows || []).map(row => [row.key, row.value]));
}

async function saveSchedule(username, schedule) {
    await db('app_data?on_conflict=username,key', {
        method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal',
        body: JSON.stringify({ username, key: 'schedule', value: schedule, updated_at: new Date().toISOString() })
    });
}

module.exports = async (req, res) => {
    try {
        if (!(await requireOwner(req, res))) return;
        const username = String(req.method === 'GET' ? req.query?.username : req.body?.username || '').trim().toLowerCase();
        if (!username || username === 'kiankaki') return res.status(400).json({ error: 'دانش‌آموز معتبر انتخاب نشده است.' });
        const student = await getStudent(username);
        if (!student) return res.status(404).json({ error: 'کاربر پیدا نشد.' });

        if (req.method === 'GET') {
            return res.status(200).json({ student: publicUser(student), data: await getData(username) });
        }

        const data = await getData(username);
        const schedule = Array.isArray(data.schedule) && data.schedule.length === 7 ? data.schedule : emptySchedule();
        const dayIndex = Number(req.body?.dayIndex);
        const slotIndex = Number(req.body?.slotIndex);
        if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6 || !Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 5) {
            return res.status(400).json({ error: 'روز یا بازه زمانی معتبر نیست.' });
        }

        if (req.method === 'POST') {
            const subject = String(req.body?.subject || '').trim().slice(0, 100);
            if (!subject) return res.status(400).json({ error: 'عنوان درس الزامی است.' });
            const previousStatus = schedule[dayIndex].slots[slotIndex]?.status;
            schedule[dayIndex].slots[slotIndex] = {
                time: times[slotIndex], subject,
                note: String(req.body?.note || '').trim().slice(0, 300),
                color: /^#[0-9a-f]{6}$/i.test(req.body?.color) ? req.body.color : '#05319e',
                status: ['pending', 'completed', 'partial', 'missed'].includes(previousStatus) ? previousStatus : 'pending',
                assignedBy: 'kiankaki', assignedAt: new Date().toISOString()
            };
        } else if (req.method === 'DELETE') {
            schedule[dayIndex].slots[slotIndex] = { time: times[slotIndex], subject: '', note: '', color: '#05319e' };
        } else return res.status(405).json({ error: 'Method not allowed' });

        await saveSchedule(username, schedule);
        return res.status(200).json({ ok: true, schedule });
    } catch (error) { return res.status(500).json({ error: error.message }); }
};
