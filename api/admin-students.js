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

async function saveData(username, key, value) {
    await db('app_data?on_conflict=username,key', {
        method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal',
        body: JSON.stringify({ username, key, value, updated_at: new Date().toISOString() })
    });
}

function buildSummary(student, rows) {
    const data = Object.fromEntries(rows.map(row => [row.key, row.value]));
    const schedule = Array.isArray(data.schedule) ? data.schedule : [];
    const slots = schedule.flatMap(day => Array.isArray(day.slots) ? day.slots : []).filter(slot => slot.subject);
    const activityRows = rows.filter(row => ['manual_reports', 'study_history', 'exam_results', 'flashcards'].includes(row.key) || (row.key === 'schedule' && slots.some(slot => slot.status && slot.status !== 'pending')));
    const reports = Array.isArray(data.manual_reports) ? data.manual_reports : [];
    const completed = slots.filter(slot => slot.status === 'completed').length;
    const missed = slots.filter(slot => slot.status === 'missed').length;
    const reportMinutes = reports.reduce((sum, item) => sum + Number(item.minutes || 0), 0);
    const latest = activityRows.map(row => row.updated_at).filter(Boolean).sort().at(-1) || student.registered_at;
    const staleDays = latest ? Math.floor((Date.now() - new Date(latest).getTime()) / 864e5) : 999;
    const reasons = [];
    if (!activityRows.length) reasons.push('بدون فعالیت');
    else if (staleDays >= 7) reasons.push(`${staleDays} روز بدون ثبت`);
    if (missed) reasons.push(`${missed} برنامه انجام‌نشده`);
    return { username: student.username, latestActivity: latest, staleDays, planned: slots.length, completed, missed, reports: reports.length, reportMinutes, adherence: slots.length ? Math.round((completed / slots.length) * 100) : 0, status: reasons.length ? 'attention' : 'active', reasons };
}

module.exports = async (req, res) => {
    try {
        if (!(await requireOwner(req, res))) return;
        const username = String(req.method === 'GET' ? req.query?.username : req.body?.username || '').trim().toLowerCase();
        if (req.method === 'GET' && !username) {
            const students = (await db('profiles?username=neq.kiankaki&select=*')).map(publicUser);
            const rows = await db('app_data?select=username,key,value,updated_at');
            return res.status(200).json({ students, summaries: students.map(student => buildSummary(student, rows.filter(row => row.username === student.username))) });
        }
        if (!username || username === 'kiankaki') return res.status(400).json({ error: 'دانش‌آموز معتبر انتخاب نشده است.' });
        const student = await getStudent(username);
        if (!student) return res.status(404).json({ error: 'کاربر پیدا نشد.' });

        if (req.method === 'GET') {
            return res.status(200).json({ student: publicUser(student), data: await getData(username) });
        }

        if (req.method === 'PATCH' && req.body?.action === 'saveNote') {
            const note = String(req.body?.note || '').trim().slice(0, 2000);
            await saveData(username, 'admin_note', { text: note, updatedAt: new Date().toISOString(), updatedBy: 'kiankaki' });
            return res.status(200).json({ ok: true, note });
        }

        if (req.method === 'DELETE' && req.body?.action === 'deleteStudent') {
            if (String(req.body?.confirmation || '').trim().toLowerCase() !== username) return res.status(400).json({ error: 'برای حذف، نام کاربری باید دقیق وارد شود.' });
            await db(`profiles?username=eq.${encodeURIComponent(username)}`, { method: 'DELETE' });
            return res.status(200).json({ ok: true, deleted: username });
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
