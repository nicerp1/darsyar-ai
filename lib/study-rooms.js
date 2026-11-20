const { db, getSession, crypto } = require('../api/_supabase');

// Reserved im_* records are already excluded from generic data writes and account exports to other users.
const MEMBER = 'im_sr_member';
const ROOM = 'im_sr_room_';
const LEASE = 30000;
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const username = /^[a-z0-9_.-]{3,40}$/;
const enc = encodeURIComponent;
const presets = new Set(['library', 'rain', 'cafe', 'forest']);
const reactions = new Set(['ready', 'nice', 'wave']);
const localDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' });
const s = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const bounded = (v, min, max, fallback) => Number.isInteger(v) && v >= min && v <= max ? v : fallback;
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const notFound = () => fail(404, 'اتاق پیدا نشد یا دعوت دیگر معتبر نیست.');
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && /^[0-9a-f]{48}$/.test(a) && /^[0-9a-f]{48}$/.test(b) && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const pathFor = key => 'app_data?key=eq.' + enc(key);
const owned = (key, user) => pathFor(key) + '&username=eq.' + enc(user);
const getMember = async user => (await db(owned(MEMBER, user) + '&select=value'))?.[0]?.value;
const getRoom = async id => uuid.test(id || '') ? (await db(pathFor(ROOM + id) + '&select=username,value&limit=1'))?.[0] : null;

async function write(user, key, next, previous) {
    const value = { ...next, rev: crypto.randomUUID() };
    const data = { value, updated_at: new Date().toISOString() };
    const rows = previous
        ? await db(owned(key, user) + '&value->>rev=eq.' + enc(previous.rev), { method: 'PATCH', body: JSON.stringify(data) })
        : await db('app_data?on_conflict=username,key', { method: 'POST', prefer: 'resolution=ignore-duplicates,return=representation', body: JSON.stringify({ username: user, key, ...data }) });
    return rows?.length ? value : null;
}

async function change(user, key, read, next) {
    for (let i = 0; i < 5; i++) {
        const before = await read();
        const value = await next(before);
        if (value === before) return before;
        const saved = await write(user, key, value, before);
        if (saved) return saved;
    }
    fail(409, 'وضعیت هم‌زمان تغییر کرد؛ دوباره تلاش کن.');
}

function phase(run, now) {
    if (run?.paused) return 'paused';
    if (!run || now >= run.restEnd) return 'idle';
    return now < run.focusEnd ? 'focus' : 'break';
}

function makeRun(focus, rest, now) {
    return { start: now, focusEnd: now + focus * 60000, restEnd: now + (focus + rest) * 60000 };
}

function credit(member, room, now) {
    if (!member.room || !member.seen) return member;
    const runs = member.mode === 'solo' ? [member.solo] : [room?.previous, room?.run];
    if (now <= member.seen) return { ...member };
    const until = Math.min(now, member.seen + LEASE);
    const days = { ...member.days };
    const totals = { ...member.totals };
    for (const run of runs.filter(Boolean)) {
        const start = Math.max(member.seen, run.start);
        const end = Math.min(until, run.focusEnd, run.paused || Infinity);
        if (end <= start) continue;
        const date = localDate.format(new Date(start));
        const last = localDate.format(new Date(end - 1));
        let boundary = end;
        if (date !== last) {
            let low = start, high = end;
            while (high - low > 1) {
                const mid = Math.floor((low + high) / 2);
                if (localDate.format(new Date(mid)) === date) low = mid; else high = mid;
            }
            boundary = high;
            days[last] = (days[last] || 0) + end - boundary;
        }
        days[date] = (days[date] || 0) + boundary - start;
        totals[member.room] = (totals[member.room] || 0) + end - start;
    }
    return { ...member, days, totals, seen: now };
}

const empty = () => ({ room: null, seen: 0, mode: 'group', rooms: [], days: {}, totals: {}, hidden: false, solo: null, reaction: null, blocks: [] });
const history = member => Object.entries(member?.days || {}).sort().map(([date, ms]) => ({ date, hours: ms / 3600000, sessions: 0 }));
const roomInfo = (id, room, now) => ({ id, name: room.name, visibility: room.visibility, theme: room.theme, focus: room.focus, rest: room.rest, capacity: room.capacity, run: room.run, phase: phase(room.run, now) });
const fresh = now => '&value->>seen=gte.' + (now - LEASE);

async function directory(actor, now) {
    const member = await getMember(actor);
    const privateIds = (member?.rooms || []).filter(id => uuid.test(id)).slice(0, 40);
    const [all, mine, active] = await Promise.all([
        db('app_data?key=like.im_sr_room_*&value->>visibility=eq.public&value->>closed=eq.false&select=key,value&order=updated_at.desc&limit=60'),
        privateIds.length ? db('app_data?key=in.(' + privateIds.map(id => ROOM + id).join(',') + ')&value->>closed=eq.false&select=key,value&limit=40') : [],
        db(pathFor(MEMBER) + '&value->>room=not.is.null' + fresh(now) + '&select=value&limit=500')
    ]);
    const counts = new Map();
    for (const { value } of active || []) counts.set(value.room, (counts.get(value.room) || 0) + 1);
    const toEntry = ({key, value}) => ({ ...roomInfo(key.slice(ROOM.length), value, now), members: counts.get(key.slice(ROOM.length)) || 0 });
    return { public: (all || []).map(toEntry), private: (mine || []).filter(row => row.value.visibility === 'private' && !row.value.bans?.includes(actor)).map(toEntry), current: member?.room || null, history: history(member), now };
}

async function snapshot(id, record, actor, member, now) {
    const r = record.value;
    const records = await db(pathFor(MEMBER) + '&value->>room=eq.' + id + fresh(now) + '&select=username,value&limit=100');
    const filtered = (records || []).filter(item => !r.bans?.includes(item.username) && !member.blocks?.includes(item.username));
    const usernames = filtered.map(item => item.username).filter(n => username.test(n));
    const profiles = usernames.length ? await db('profiles?username=in.(' + usernames.map(enc).join(',') + ')&select=username,name,avatar') : [];
    const names = new Map((profiles || []).map(p => [p.username, p]));
    return {
        now, room: roomInfo(id, r, now), host: actor === record.username, mode: member.mode, solo: member.solo,
        invite: actor === record.username ? r.invite : undefined, hidden: member.hidden,
        history: history(member),
        people: filtered.map(({ username, value }) => ({
            id: username, name: names.get(username)?.name || username, avatar: /^avatar:[1-6]$/.test(names.get(username)?.avatar) ? names.get(username).avatar : null, self: username === actor, host: username === record.username,
            seconds: value.hidden && username !== actor ? null : Math.floor((value.totals?.[id] || 0) / 1000),
            phase: phase(value.mode === 'solo' ? value.solo : r.run, now),
            reaction: value.reaction?.at > now - 10000 ? value.reaction.kind : null
        }))
    };
}

async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    try {
        if (req.method !== 'POST') return res.status(405).json({ error: 'درخواست معتبر نیست.' });
        if (req.headers?.['sec-fetch-site'] === 'cross-site') fail(403, 'درخواست معتبر نیست.');
        const actor = await getSession(req, 'username');
        if (!actor) return res.status(401).json({ error: 'ابتدا وارد حساب شوید.' });
        const user = actor.username, body = req.body || {}, now = Date.now();
        if (body.expectedUser && user !== body.expectedUser) fail(409, 'حساب کاربری تغییر کرده است.');
        const { action } = body;
        if (action === 'list') return res.status(200).json(await directory(user, now));
        let id = typeof body.id === 'string' ? body.id : '', record, member;
        if (action === 'create') {
            const name = s(body.name, 60);
            if (name.length < 2) fail(400, 'نام اتاق را وارد کن.');
            const open = await db('app_data?username=eq.' + enc(user) + '&key=like.im_sr_room_*&value->>closed=eq.false&select=key&limit=8');
            if (open?.length >= 8) fail(409, 'حداکثر ۸ اتاق باز می‌توانی داشته باشی.');
            id = crypto.randomUUID();
            const value = await write(user, ROOM + id, { name, visibility: body.visibility === 'public' ? 'public' : 'private', theme: presets.has(body.theme) ? body.theme : 'library', focus: bounded(body.focus, 5, 120, 50), rest: bounded(body.rest, 1, 30, 10), capacity: bounded(body.capacity, 2, 32, 12), invite: crypto.randomBytes(24).toString('hex'), closed: false, bans: [], run: null }, null);
            record = { username: user, value };
        } else record = await getRoom(id);
        if (!record?.value || record.value.closed || record.value.bans?.includes(user)) {
            if (['leave','suspend','pulse'].includes(action) && uuid.test(id)) {
                const member = await change(user, MEMBER, () => getMember(user), previous => previous?.room === id ? { ...credit(previous, record?.value, now), room:null, seen:0, solo:null } : previous);
                if (action === 'pulse') notFound();
                return res.status(200).json({now,history:history(member)});
            }
            notFound();
        }
        const room = record.value, host = user === record.username, joining = ['join', 'create'].includes(action);
        const prior = await getMember(user);
        if (joining) {
            if (!host && room.visibility === 'private' && !prior?.rooms?.includes(id) && !same(room.invite, body.invite)) notFound();
            if (prior?.room !== id || prior.seen < now - LEASE) {
                const present = await db(pathFor(MEMBER) + '&value->>room=eq.' + id + fresh(now) + '&select=username&limit=33');
                if ((present || []).filter(p => p.username !== user && !room.bans?.includes(p.username)).length >= room.capacity) fail(409, 'ظرفیت اتاق تکمیل است.');
            }
        } else if (prior?.room !== id) notFound();

        if (['start', 'end', 'settings', 'invite', 'kick', 'close'].includes(action)) {
            if (!host) fail(403, 'این گزینه فقط برای میزبان است.');
            const value = await change(user, ROOM + id, async () => (await getRoom(id))?.value, latest => {
                if (!latest || latest.closed) notFound();
                if (action === 'start') {
                    if (phase(latest.run, now) !== 'idle') fail(409, 'جلسه هنوز تمام نشده.');
                    return { ...latest, previous: latest.run, run: makeRun(latest.focus, latest.rest, now) };
                }
                if (action === 'end') {
                    if (phase(latest.run, now) === 'idle') return latest;
                    return { ...latest, run: { ...latest.run, focusEnd: Math.min(latest.run.focusEnd, now), restEnd: now } };
                }
                if (action === 'close') return { ...latest, closed: true, run: phase(latest.run,now) === 'idle' ? latest.run : { ...latest.run, focusEnd:Math.min(now,latest.run.focusEnd),restEnd:now } };
                if (action === 'invite') return { ...latest, invite: crypto.randomBytes(24).toString('hex') };
                if (action === 'kick') {
                    const target = s(body.target, 40);
                    if (target === user || !username.test(target)) fail(400, 'عضو معتبر نیست.');
                    return { ...latest, bans: [...new Set([...(latest.bans || []), target])].slice(-250) };
                }
                const name = s(body.name, 60);
                return { ...latest, name: name.length >= 2 ? name : latest.name, theme: presets.has(body.theme) ? body.theme : latest.theme,
                    focus: bounded(body.focus, 5, 120, latest.focus), rest: bounded(body.rest, 1, 30, latest.rest),
                    capacity: bounded(body.capacity, 2, 32, latest.capacity) };
            });
            record = { ...record, value };
        }
        if (!['create','join','pulse','suspend','leave','mode','soloStart','soloPause','soloResume','soloReset','privacy','react','report','block','start','end','settings','invite','kick','close'].includes(action)) fail(400, 'عملیات شناخته نشد.');
        if (action === 'report') {
            const target = s(body.target, 40), reason = s(body.reason, 150);
            if (target === user || !reason || (target && (!username.test(target) || (await getMember(target))?.room !== id))) fail(400, 'مورد گزارش معتبر نیست.');
            const bucket = Math.floor(now / 60000), key = 'im_sr_report_' + id + '_' + bucket;
            await write(user, key, { room: id, target, reason, at: now }, null);
        }
        member = await change(user, MEMBER, () => getMember(user), async stored => {
            const before = stored || empty();
            if (!joining && before.room !== id) notFound();
            const priorRoom = before.room === id ? record.value : before.room && (await getRoom(before.room))?.value;
            const effective = Math.max(now, before.seen);
            const updated = credit(before, priorRoom, effective);
            if (action === 'leave' || action === 'close') return { ...updated, room: null, solo: null, reaction: null };
            if (action === 'suspend') return { ...updated, seen: 0, solo: updated.solo && phase(updated.solo, effective) !== 'idle' && !updated.solo.paused ? { ...updated.solo, paused:effective } : updated.solo };
            if (joining && before.room !== id) return { ...updated, room: id, seen: now, mode: 'group', solo: null, reaction: null, rooms: [id, ...before.rooms.filter(x => x !== id)].slice(0, 40) };
            if (action === 'privacy') updated.hidden = body.hidden === true;
            if (action === 'block' && username.test(body.target || '') && body.target !== user) updated.blocks = [...new Set([...updated.blocks, body.target])].slice(-100);
            if (action === 'react' && reactions.has(body.kind) && phase(record.value.run, now) !== 'focus' && (!updated.reaction || now - updated.reaction.at >= 2500)) updated.reaction = { kind: body.kind, at: now };
            if (action === 'mode') {
                const next = body.mode === 'solo' ? 'solo' : 'group';
                if (next !== updated.mode) { updated.mode = next; updated.solo = null; }
            }
            if (updated.mode === 'solo') {
                const solo = updated.solo;
                if (action === 'soloStart' && (!solo || (!solo.paused && phase(solo, now) === 'idle'))) updated.solo = makeRun(bounded(body.focus, 5, 120, 25), bounded(body.rest, 1, 30, 5), now);
                if (action === 'soloPause' && solo && !solo.paused && phase(solo, now) !== 'idle') updated.solo = { ...solo, paused: now };
                if (action === 'soloResume' && solo?.paused) {
                    const shift = now - solo.paused;
                    updated.solo = { start: solo.start + shift, focusEnd: solo.focusEnd + shift, restEnd: solo.restEnd + shift };
                }
                if (action === 'soloReset') updated.solo = null;
            }
            return { ...updated, seen: effective };
        });
        if (['leave','close','suspend'].includes(action)) return res.status(200).json({ now, history: history(member) });
        return res.status(200).json(await snapshot(id, record, user, member, now));
    } catch (error) {
        if (!error.status) console.error('study rooms failed', error.message);
        return res.status(error.status || 500).json({ error: error.status ? error.message : 'اتصال به اتاق برقرار نشد. دوباره تلاش کن.' });
    }
}

module.exports = { handler, credit, phase, makeRun, history, getMember };
