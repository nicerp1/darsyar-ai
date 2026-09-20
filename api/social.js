const { db, getSession, getAccountType } = require('./_supabase');

const normalize = value => String(value || '').trim().toLowerCase();
const unique = values => [...new Set((Array.isArray(values) ? values : []).map(normalize).filter(Boolean))];
const getData = async (username, key, fallback) => (await db(`app_data?username=eq.${encodeURIComponent(username)}&key=eq.${encodeURIComponent(key)}&select=value`))?.[0]?.value ?? fallback;
const putData = (username, key, value) => db('app_data?on_conflict=username,key', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: JSON.stringify({ username, key, value, updated_at: new Date().toISOString() }) });
const present = (profile, social = {}) => ({ username: profile.username, name: String(social.displayName || profile.name || profile.username).slice(0, 40), avatar: profile.avatar || '👩‍🎓', grade: social.showGrade === false ? '' : (profile.grade || ''), bio: String(social.bio || '').slice(0, 120), xp: Math.max(0, Number(profile.xp) || 0), level: Math.max(1, Number(profile.level) || 1) });
const period = () => new Date().toISOString().slice(0, 7);

async function visibleStudents() {
    const rows = (await db('app_data?key=eq.social_profile&select=username,value')).filter(row => row.value?.leagueVisible === true);
    const output = [];
    for (const row of rows) {
        const profile = (await db(`profiles?username=eq.${encodeURIComponent(row.username)}&select=username,name,avatar,grade,xp,level`))?.[0];
        if (profile && await getAccountType(profile.username) === 'student') {
            const points = await getData(profile.username, 'league_points', {});
            output.push({ ...present(profile, row.value), seasonPoints: points.period === period() ? Math.max(0, Number(points.points) || 0) : 0 });
        }
    }
    return output;
}

module.exports = async (req, res) => {
    try {
        const actor = await getSession(req);
        if (!actor) return res.status(401).json({ error: 'ابتدا وارد حساب شوید.' });
        if (await getAccountType(actor.username) !== 'student') return res.status(403).json({ error: 'فضای دوستان و لیگ مخصوص حساب دانش‌آموز است.' });
        if (req.method === 'GET') {
            const social = await getData(actor.username, 'social_profile', { leagueVisible: false, showGrade: true, bio: '' });
            const friends = unique(await getData(actor.username, 'friends', []));
            const requests = unique(await getData(actor.username, 'friend_requests', []));
            const people = {};
            for (const username of unique([...friends, ...requests])) {
                const profile = (await db(`profiles?username=eq.${encodeURIComponent(username)}&select=username,name,avatar,grade,xp,level`))?.[0];
                if (profile) people[username] = present(profile, await getData(username, 'social_profile', {}));
            }
            const leaderboard = (await visibleStudents()).sort((a, b) => b.seasonPoints - a.seasonPoints || a.username.localeCompare(b.username)).slice(0, 50).map((item, index) => ({ ...item, rank: index + 1, isFriend: friends.includes(item.username), isMe: item.username === actor.username }));
            return res.status(200).json({ profile: present(actor, social), settings: { leagueVisible: social.leagueVisible === true, showGrade: social.showGrade !== false, bio: String(social.bio || '') }, friends: friends.map(username => people[username]).filter(Boolean), requests: requests.map(username => people[username]).filter(Boolean), leaderboard, season: { title: 'لیگ ماهانه مطالعه', prize: 'یک ماه اشتراک ویژه برای ۳ نفر اول', verificationRequired: true } });
        }
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        const action = String(req.body?.action || '');
        if (action === 'activity') {
            const today = new Date().toISOString().slice(0, 10), current = await getData(actor.username, 'league_points', {});
            const state = current.period === period() ? current : { period: period(), points: 0, daily: {} };
            const daily = { ...(state.daily || {}) }, used = Math.max(0, Number(daily[today]) || 0);
            const requested = Math.min(100, Math.max(0, Math.round(Number(req.body.points) || 0))), awarded = Math.min(requested, Math.max(0, 300 - used));
            if (awarded) { daily[today] = used + awarded; await putData(actor.username, 'league_points', { period: state.period, points: Math.max(0, Number(state.points) || 0) + awarded, daily }); }
            return res.status(200).json({ ok: true, awarded });
        }
        if (action === 'settings') {
            const current = await getData(actor.username, 'social_profile', {});
            const value = { ...current, leagueVisible: req.body.leagueVisible === true, showGrade: req.body.showGrade !== false, bio: String(req.body.bio || '').trim().slice(0, 120), displayName: String(req.body.displayName || actor.name || actor.username).trim().slice(0, 40) };
            await putData(actor.username, 'social_profile', value);
            return res.status(200).json({ ok: true, settings: value });
        }
        const target = normalize(req.body?.username);
        if (!/^[a-z0-9_.-]{3,32}$/.test(target) || target === actor.username) return res.status(400).json({ error: 'نام کاربری دوست معتبر نیست.' });
        const profile = (await db(`profiles?username=eq.${encodeURIComponent(target)}&select=username`))?.[0];
        if (!profile || await getAccountType(target) !== 'student') return res.status(404).json({ error: 'دانش‌آموزی با این نام کاربری پیدا نشد.' });
        const mine = unique(await getData(actor.username, 'friends', []));
        const theirs = unique(await getData(target, 'friends', []));
        if (action === 'request') {
            if (mine.includes(target)) return res.status(409).json({ error: 'این دانش‌آموز در فهرست دوستان شماست.' });
            const pending = unique(await getData(target, 'friend_requests', []));
            if (!pending.includes(actor.username)) await putData(target, 'friend_requests', [...pending, actor.username]);
        } else if (action === 'accept') {
            const pending = unique(await getData(actor.username, 'friend_requests', []));
            if (!pending.includes(target)) return res.status(404).json({ error: 'درخواست فعالی وجود ندارد.' });
            await Promise.all([putData(actor.username, 'friend_requests', pending.filter(item => item !== target)), putData(actor.username, 'friends', unique([...mine, target])), putData(target, 'friends', unique([...theirs, actor.username]))]);
        } else if (action === 'reject') {
            await putData(actor.username, 'friend_requests', unique(await getData(actor.username, 'friend_requests', [])).filter(item => item !== target));
        } else if (action === 'remove') {
            await Promise.all([putData(actor.username, 'friends', mine.filter(item => item !== target)), putData(target, 'friends', theirs.filter(item => item !== actor.username))]);
        } else return res.status(400).json({ error: 'درخواست نامعتبر است.' });
        return res.status(200).json({ ok: true });
    } catch (error) { console.error('api/social.js failed:', error); res.status(500).json({ error: 'در حال حاضر ارتباط با لیگ برقرار نشد. لطفاً دوباره تلاش کنید.' }); }
};
