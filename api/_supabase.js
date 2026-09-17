const crypto = require('crypto');
const baseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function db(path, options = {}) {
    if (!baseUrl || !serviceKey) throw new Error('Supabase environment variables are missing');
    const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
        ...options,
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: options.prefer || 'return=representation', ...(options.headers || {}) }
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    if (!response.ok) throw new Error(body?.message || body?.hint || 'Database request failed');
    return body;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}
function verifyPassword(password, stored) {
    const [salt, expected] = String(stored || '').split(':');
    if (!salt || !expected) return false;
    const actual = crypto.scryptSync(password, salt, 64), wanted = Buffer.from(expected, 'hex');
    return actual.length === wanted.length && crypto.timingSafeEqual(actual, wanted);
}
function parseCookies(req) {
    return Object.fromEntries(String(req.headers.cookie || '').split(';').filter(Boolean).map(part => {
        const index = part.indexOf('='); return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1))];
    }));
}
async function getSession(req) {
    const token = parseCookies(req).studymate_session;
    if (!token) return null;
    const sessions = await db(`sessions?token=eq.${encodeURIComponent(token)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=username`);
    if (!sessions?.[0]) return null;
    return (await db(`profiles?username=eq.${encodeURIComponent(sessions[0].username)}&select=*`))?.[0] || null;
}
function publicUser(row) { if (!row) return null; const { password_hash, ...user } = row; return user; }
module.exports = { db, hashPassword, verifyPassword, getSession, publicUser, crypto };
