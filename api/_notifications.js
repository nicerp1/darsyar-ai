const { db, crypto } = require('./_supabase');
async function notify(username, type, title, target = '') {
    if (!username) return;
    const id = `${type === 'news' ? 'news' : 'notice'}_${crypto.randomUUID()}`;
    await db('app_data', { method:'POST', prefer:'return=minimal', body:JSON.stringify({username,key:id,value:{id,type,title:String(title).slice(0,300),target,createdAt:new Date().toISOString()},updated_at:new Date().toISOString()}) });
}
module.exports = { notify };
