const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const rows = new Map();
const sessions = new Map([['old-session', 'student1']]);
const passwords = new Map([['kiankaki', 'admin-hash'], ['student1', 'old-hash']]);
let actor = null;

const supabasePath = require.resolve('../api/_supabase');
const originalCache = require.cache[supabasePath];
require.cache[supabasePath] = { id: supabasePath, filename: supabasePath, loaded: true, exports: {
    crypto,
    getSession: async () => actor,
    verifyPassword: (password, stored) => password === 'admin-secret' && stored === 'admin-hash',
    hashPassword: password => `hashed:${password}`,
    db: async (path, options = {}) => {
        if (path.startsWith('profiles?') && options.method === 'PATCH') {
            passwords.set('student1', JSON.parse(options.body).password_hash); return null;
        }
        if (path.startsWith('profiles?')) return path.includes('student1') ? [{ username: 'student1' }] : [];
        if (path.startsWith('sessions?') && options.method === 'DELETE') { sessions.clear(); return null; }
        if (path.startsWith('app_data?on_conflict=')) { const data = JSON.parse(options.body); rows.set(data.username, data.value); return null; }
        if (path.startsWith('app_data?') && options.method === 'DELETE') {
            const username = decodeURIComponent(path.match(/username=eq\.([^&]+)/)?.[1] || '');
            const hash = path.match(/tokenHash=eq\.([a-f0-9]+)/)?.[1];
            if (rows.get(username)?.tokenHash !== hash) return [];
            rows.delete(username); return [{ username }];
        }
        if (path.startsWith('app_data?')) {
            const username = decodeURIComponent(path.match(/username=eq\.([^&]+)/)?.[1] || '');
            return rows.has(username) ? [{ value: rows.get(username) }] : [];
        }
        throw new Error(`Unexpected DB query: ${path}`);
    }
} };
const handler = require('../api/password-reset');
if (originalCache) require.cache[supabasePath] = originalCache;
else delete require.cache[supabasePath];

async function call(body) {
    const response = { code: 200, headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } };
    await handler({ method: 'POST', body }, response);
    return response;
}

test('only owner with fresh password can create a link', async () => {
    actor = null;
    assert.equal((await call({ action: 'create', username: 'student1', adminPassword: 'admin-secret' })).code, 403);
    actor = { username: 'kiankaki', password_hash: 'admin-hash' };
    assert.equal((await call({ action: 'create', username: 'student1', adminPassword: 'wrong' })).code, 401);
    const created = await call({ action: 'create', username: 'student1', adminPassword: 'admin-secret' });
    assert.equal(created.code, 200);
    assert.match(created.body.token, /^[a-f0-9]{64}$/);
    assert.notEqual(rows.get('student1').tokenHash, created.body.token);
});

test('reset rejects wrong, expired and reused links; successful reset revokes sessions', async () => {
    const created = await call({ action: 'create', username: 'student1', adminPassword: 'admin-secret' });
    const valid = { action: 'consume', username: 'student1', token: created.body.token, password: 'new-secret-123', confirmation: 'new-secret-123' };
    assert.equal((await call({ ...valid, token: '0'.repeat(64) })).code, 400);
    rows.get('student1').expiresAt = new Date(Date.now() - 1000).toISOString();
    assert.equal((await call(valid)).code, 400);
    const replacement = await call({ action: 'create', username: 'student1', adminPassword: 'admin-secret' });
    assert.equal((await call(valid)).code, 400);
    valid.token = replacement.body.token;
    assert.equal((await call(valid)).code, 200);
    assert.equal(passwords.get('student1'), 'hashed:new-secret-123');
    assert.equal(sessions.size, 0);
    assert.equal(rows.has('student1'), false);
    assert.equal((await call(valid)).code, 400);
});
