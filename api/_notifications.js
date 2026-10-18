const { db, crypto } = require('./_supabase');
async function notify(username, type, title, target = '') {
    if (!username) return;
    const id = `${type === 'news' ? 'news' : 'notice'}_${crypto.randomUUID()}`;
    await db('app_data', { method:'POST', prefer:'return=minimal', body:JSON.stringify({username,key:id,value:{id,type,title:String(title).slice(0,300),target,createdAt:new Date().toISOString()},updated_at:new Date().toISOString()}) });
}
async function markMessengerRead(username,target) {
    if(!username||!target)return;
    const rows=await db(`app_data?username=eq.${encodeURIComponent(username)}&key=like.notice_*&select=value&order=updated_at.desc&limit=100`);
    const ids=(rows||[]).map(row=>row.value).filter(n=>n?.type==='messenger'&&n.target===target&&/^notice_[a-f0-9-]{36}$/.test(n.id)).map(n=>n.id);
    if(ids.length)await db('app_data?on_conflict=username,key',{method:'POST',prefer:'resolution=merge-duplicates,return=minimal',body:JSON.stringify(ids.map(id=>({username,key:`read_${id}`,value:true,updated_at:new Date().toISOString()})))});
}
module.exports = { notify, markMessengerRead };
