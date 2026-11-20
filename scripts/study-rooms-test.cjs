const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const records = new Map();
const people = new Map(['alice', 'bob', 'carol'].map(username => [username, {username,name:username,avatar:'avatar:2'}]));
const clone = value => structuredClone(value);

// Model PostgREST filters and compare-and-swap writes without connecting to production.
async function db(path, options = {}) {
    const u = new URL('http://db/' + path), p = u.searchParams;
    if (u.pathname === '/profiles') {
        const accepted = (p.get('username') || '').slice(4,-1).split(',');
        return [...people.values()].filter(row => accepted.includes(row.username));
    }
    const keyOf = (username,key) => username + ':' + key;
    if (options.method === 'POST') {
        const row = JSON.parse(options.body), key = keyOf(row.username,row.key);
        if (records.has(key) && options.prefer?.includes('ignore-duplicates')) return [];
        records.set(key,clone(row)); return [row];
    }
    const matches = [...records.values()].filter(row => {
        for (const [key, filter] of p) {
            if (['select','order','limit'].includes(key)) continue;
            const value = key.startsWith('value->>') ? row.value[key.slice(8)] : row[key];
            if (filter.startsWith('eq.') && String(value)!==filter.slice(3)) return false;
            if (filter.startsWith('gte.') && !(Number(value)>=Number(filter.slice(4)))) return false;
            if (filter.startsWith('like.') && !String(value).startsWith(filter.slice(5,-1))) return false;
            if (filter.startsWith('in.(') && !filter.slice(4,-1).split(',').includes(value)) return false;
            if (filter==='not.is.null' && value==null) return false;
        }
        return true;
    }).slice(0,Number(p.get('limit')||1000));
    if (options.method==='PATCH') {
        for (const row of matches) Object.assign(row,JSON.parse(options.body));
    }
    return clone(matches);
}
const supabase = require.resolve('../api/_supabase');
require.cache[supabase] = { exports: { db, getSession: async req => people.get(req.user), crypto:require('node:crypto') } };
const api = require('../lib/study-rooms');

async function call(user, action, data={}) {
    let status;
    const res={setHeader(){},status(n){status=n;return this;},json(body){return {status,body};}};
    return api.handler({method:'POST',user,body:{action,...data}},res);
}
async function good(user, action, data={}) {
    const result=await call(user,action,data);
    assert.equal(result.status,200,JSON.stringify(result));return result.body;
}

if (require.main === module) test('authenticated rooms: private links, shared timer, separate accounting and moderation', async t => {
    let clock=Date.UTC(2026,10,20,15);
    t.mock.method(Date,'now',()=>clock);
    assert.equal((await call(null,'list')).status,401);
    const {room,invite}=await good('alice','create',{name:'شب',visibility:'private',focus:5,rest:1});
    const id=room.id;
    assert.equal((await good('bob','list')).public.length,0);
    assert.equal((await call('bob','join',{id})).status,404);
    assert.equal((await call('bob','join',{id,invite:'f'.repeat(48)})).status,404);
    const joined=await good('bob','join',{id,invite});
    assert.equal(joined.invite,undefined);
    assert.equal(joined.people.length,2);
    assert.equal((await call('bob','start',{id})).status,403);
    const started=await good('alice','start',{id});
    const running=await good('bob','pulse',{id});
    assert.deepEqual(started.room.run,running.room.run);
    clock+=10000;
    const solo=await good('bob','mode',{id,mode:'solo'});
    assert.equal(solo.people.find(p=>p.self).seconds,10);
    await good('bob','soloStart',{id,focus:10,rest:2});
    clock+=5000;
    assert.equal((await good('bob','soloPause',{id})).people.find(p=>p.self).phase,'paused');
    clock+=12000;
    assert.equal((await good('bob','pulse',{id})).people.find(p=>p.self).seconds,15);
    await good('bob','soloResume',{id});
    clock+=5000;
    await Promise.all([good('bob','pulse',{id}), good('bob','pulse',{id})]);
    assert.equal((await good('bob','pulse',{id})).people.find(p=>p.self).seconds,20);
    clock+=4000;
    await good('bob','suspend',{id});
    clock+=80000;
    assert.equal((await good('bob','pulse',{id})).people.find(p=>p.self).seconds,24);
    await good('bob','privacy',{id,hidden:true});
    assert.equal((await good('alice','pulse',{id})).people.find(p=>p.id==='bob').seconds,null);
    await good('bob','report',{id,target:'alice',reason:'test'});
    const updated=await good('alice','invite',{id});
    assert.notEqual(updated.invite,invite);
    assert.equal((await call('carol','join',{id,invite})).status,404);
    const owner=await good('alice','kick',{id,target:'bob'});
    assert.equal(owner.people.some(p=>p.id==='bob'),false);
    assert.equal((await call('bob','pulse',{id})).status,404);
    const publicRoom=await good('carol','create',{name:'عمومی',visibility:'public',capacity:2});
    assert.equal((await good('bob','list')).public[0].id,publicRoom.room.id);
    await good('bob','join',{id:publicRoom.room.id});
    assert.equal((await call('alice','join',{id:publicRoom.room.id})).status,409);
    const done=await good('bob','leave',{id:publicRoom.room.id});
    assert.equal(Math.round(done.history.reduce((n,row)=>n+row.hours*3600,0)),24);
    assert.equal((await good('bob','list')).current,null);
});

if (require.main === module) test('focus credit clips expired presence, study phase and local-day boundary', () => {
    const now = Date.parse('2026-11-20T20:29:50Z'), id=randomUUID();
    const member={room:id,mode:'group',seen:now,days:{},totals:{}};
    const run=api.makeRun(1,1,now-39500);
    const next=api.credit(member,{run},now+90000);
    assert.equal(next.days['2026-11-20'],10000);
    assert.equal(next.days['2026-11-21'],10500);
    assert.equal(next.totals[id],20500);
    assert.equal(api.phase(run,run.focusEnd),'break');
});

module.exports = { call };
