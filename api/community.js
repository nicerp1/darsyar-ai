const {db,getSession,getDataValue,getAccountType} = require('./_supabase');
const {notify} = require('./_notifications');
module.exports = async(req,res) => {
    res.setHeader('Cache-Control','private, no-store');
    try {
        const actor=await getSession(req); if(!actor)return res.status(401).json({error:'ابتدا وارد حساب شوید.'});
        if(req.method==='GET' && req.query?.profile){
            const username=String(req.query.profile).trim().toLowerCase();
            if(!/^[a-z0-9_.-]{3,40}$/.test(username))return res.status(400).json({error:'نام کاربری معتبر نیست.'});
            const person=(await db(`profiles?username=eq.${encodeURIComponent(username)}&select=username,name,avatar`))?.[0];
            if(!person)return res.status(404).json({error:'کاربر پیدا نشد.'});
            const social=await getDataValue(username,'social_profile',{});
            return res.status(200).json({profile:{...person,bio:String(social.bio||'').slice(0,120),accountType:await getAccountType(username)}});
        }
        if(req.method==='GET'){
            const [personal,news,read]=await Promise.all([
                db(`app_data?username=eq.${encodeURIComponent(actor.username)}&key=like.notice_*&select=value&order=updated_at.desc&limit=60`),
                db('app_data?username=eq.kiankaki&key=like.news_*&select=value&order=updated_at.desc&limit=20'),
                db(`app_data?username=eq.${encodeURIComponent(actor.username)}&key=like.read_*&select=key&order=updated_at.desc&limit=300`)
            ]);
            const seen=new Set((read||[]).map(r=>r.key.slice(5)));
            return res.status(200).json({items:[...(personal||[]),...(news||[])].map(r=>({...r.value,read:seen.has(r.value.id)})).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))});
        }
        if(req.method==='POST' && req.body?.action==='news'){
            if(actor.username!=='kiankaki')return res.status(403).json({error:'فقط مدیر سایت می‌تواند اطلاعیه منتشر کند.'});
            const title=String(req.body.title||'').trim(); if(!title||title.length>300)return res.status(400).json({error:'متن اطلاعیه باید بین ۱ تا ۳۰۰ نویسه باشد.'});
            await notify('kiankaki','news',title); return res.status(200).json({ok:true});
        }
        if(req.method==='POST' && req.body?.action==='read'){
            const ids=[...new Set(Array.isArray(req.body.ids)?req.body.ids:[])].slice(0,80).filter(id=>/^(notice|news)_[a-f0-9-]{36}$/.test(id));
            if(ids.length)await db('app_data?on_conflict=username,key',{method:'POST',prefer:'resolution=merge-duplicates,return=minimal',body:JSON.stringify(ids.map(id=>({username:actor.username,key:`read_${id}`,value:true,updated_at:new Date().toISOString()})))});
            return res.status(200).json({ok:true});
        }
        return res.status(405).json({error:'درخواست معتبر نیست.'});
    }catch(error){console.error('community failed',error);return res.status(500).json({error:'ارتباط برقرار نشد؛ دوباره تلاش کنید.'});}
};
