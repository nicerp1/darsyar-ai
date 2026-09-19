const { db, getSession, decorateUser, getAccountType, getLinkedStudents, canManageStudent, listManagedStudents } = require('./_supabase');

const days = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
const emptySchedule = () => days.map((day, dayIndex) => ({ day, dayIndex, tasks: [] }));
function normalizeSchedule(value) {
    if (!Array.isArray(value) || value.length !== 7) return emptySchedule();
    return days.map((day, dayIndex) => {
        const source = value[dayIndex] || {}, legacy = Array.isArray(source.slots) ? source.slots.filter(item => item?.subject) : [];
        const tasks = Array.isArray(source.tasks) ? source.tasks : legacy;
        return { day, dayIndex, tasks: tasks.map((task, index) => ({ id: task.id || `task-${dayIndex}-${index}`, subject: String(task.subject || '').slice(0,100), note: String(task.note || '').slice(0,300), durationMinutes: Math.min(600, Math.max(5, Number(task.durationMinutes) || 60)), color: /^#[0-9a-f]{6}$/i.test(task.color) ? task.color : '#2856d8', status: ['pending','completed','partial','missed'].includes(task.status) ? task.status : 'pending', assignedBy: task.assignedBy })).filter(task => task.subject) };
    });
}

async function requireManager(req, res) {
    const actor = await getSession(req);
    const accountType = actor ? await getAccountType(actor.username) : null;
    if (!actor || !['admin', 'advisor'].includes(accountType)) {
        res.status(403).json({ error: 'دسترسی فقط برای مدیر یا مشاور مجاز است.' });
        return null;
    }
    return { actor, accountType };
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
    const schedule = normalizeSchedule(data.schedule);
    const slots = schedule.flatMap(day => day.tasks || []);
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
        const manager = await requireManager(req, res); if (!manager) return;
        const { actor, accountType } = manager;
        const username = String((req.method === 'GET' ? req.query?.username : req.body?.username) || '').trim().toLowerCase();
        if (req.method === 'GET' && !username) {
            const students = await listManagedStudents(actor);
            const rows = await db('app_data?select=username,key,value,updated_at');
            return res.status(200).json({ students, accountType, summaries: students.map(student => buildSummary(student, rows.filter(row => row.username === student.username))) });
        }
        if (req.method === 'POST' && req.body?.action === 'linkStudent') {
            if (accountType !== 'advisor') return res.status(403).json({ error: 'این قابلیت برای حساب مشاور است.' });
            if (!username || username === actor.username || username === 'kiankaki') return res.status(400).json({ error: 'نام کاربری دانش‌آموز معتبر نیست.' });
            const target = await getStudent(username);
            if (!target || await getAccountType(username) !== 'student') return res.status(404).json({ error: 'دانش‌آموزی با این نام کاربری پیدا نشد.' });
            const linked = await getLinkedStudents(actor.username);
            if (!linked.includes(username)) linked.push(username);
            await saveData(actor.username, 'linked_students', linked);
            return res.status(200).json({ ok: true, student: await decorateUser(target) });
        }
        if (req.method === 'DELETE' && req.body?.action === 'unlinkStudent') {
            if (accountType !== 'advisor') return res.status(403).json({ error: 'این قابلیت برای حساب مشاور است.' });
            const linked = (await getLinkedStudents(actor.username)).filter(item => item !== username);
            await saveData(actor.username, 'linked_students', linked);
            return res.status(200).json({ ok: true });
        }
        if (!username || username === 'kiankaki') return res.status(400).json({ error: 'دانش‌آموز معتبر انتخاب نشده است.' });
        if (!(await canManageStudent(actor, username))) return res.status(403).json({ error: 'این دانش‌آموز به حساب شما متصل نیست.' });
        const student = await getStudent(username);
        if (!student) return res.status(404).json({ error: 'کاربر پیدا نشد.' });

        if (req.method === 'GET') {
            return res.status(200).json({ student: await decorateUser(student), data: await getData(username), manager: { username: actor.username, accountType } });
        }

        if (req.method === 'PATCH' && req.body?.action === 'saveNote') {
            const note = String(req.body?.note || '').trim().slice(0, 2000);
            await saveData(username, 'admin_note', { text: note, updatedAt: new Date().toISOString(), updatedBy: actor.username });
            return res.status(200).json({ ok: true, note });
        }

        if (req.method === 'DELETE' && req.body?.action === 'deleteStudent') {
            if (accountType !== 'admin') return res.status(403).json({ error: 'حذف کامل حساب فقط برای مدیر اصلی مجاز است.' });
            if (String(req.body?.confirmation || '').trim().toLowerCase() !== username) return res.status(400).json({ error: 'برای حذف، نام کاربری باید دقیق وارد شود.' });
            await db(`profiles?username=eq.${encodeURIComponent(username)}`, { method: 'DELETE' });
            return res.status(200).json({ ok: true, deleted: username });
        }

        const data = await getData(username);
        const schedule = normalizeSchedule(data.schedule);
        const dayIndex = Number(req.body?.dayIndex);
        const taskIndex = Number(req.body?.taskIndex);
        if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6 || !Number.isInteger(taskIndex) || taskIndex < -1) {
            return res.status(400).json({ error: 'روز یا تسک معتبر نیست.' });
        }

        if (req.method === 'POST') {
            const subject = String(req.body?.subject || '').trim().slice(0, 100);
            if (!subject) return res.status(400).json({ error: 'عنوان درس الزامی است.' });
            const previous = schedule[dayIndex].tasks[taskIndex];
            const task = {
                id: previous?.id || `task-${Date.now()}`, subject,
                note: String(req.body?.note || '').trim().slice(0, 300),
                durationMinutes: Math.min(600, Math.max(5, Number(req.body?.durationMinutes) || 60)),
                color: /^#[0-9a-f]{6}$/i.test(req.body?.color) ? req.body.color : '#2856d8',
                status: ['pending', 'completed', 'partial', 'missed'].includes(previous?.status) ? previous.status : 'pending',
                assignedBy: actor.username, assignedAt: new Date().toISOString()
            };
            if (taskIndex < 0) schedule[dayIndex].tasks.push(task); else schedule[dayIndex].tasks[taskIndex] = task;
        } else if (req.method === 'DELETE') {
            if (taskIndex >= schedule[dayIndex].tasks.length) return res.status(404).json({ error: 'تسک پیدا نشد.' });
            schedule[dayIndex].tasks.splice(taskIndex, 1);
        } else return res.status(405).json({ error: 'Method not allowed' });

        await saveSchedule(username, schedule);
        return res.status(200).json({ ok: true, schedule });
    } catch (error) { return res.status(500).json({ error: error.message }); }
};
