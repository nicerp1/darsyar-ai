// Authenticated, bounded SSE bridge for the existing custom-session database.
// Only the owner's conversation revision is emitted; no messages or service keys.
module.exports=async function events(req,res,actor,db){
    res.setHeader('Content-Type','text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control','private, no-cache, no-transform');
    res.setHeader('X-Accel-Buffering','no');
    res.flushHeaders?.();
    let closed=false,previous=req.headers?.['last-event-id']||null;
    const close=()=>{closed=true;};res.on('close',close);
    const deadline=Date.now()+8000;
    res.write('retry: 750\n\n');
    try{
        while(!closed&&Date.now()<deadline){
            const rows=await db(`app_data?username=eq.${encodeURIComponent(actor.username)}&or=(key.like.im_thread_*,key.like.im_signal_*)&select=key,updated_at&order=updated_at.desc,key.desc&limit=1`);
            if(closed)break;
            const revision=require('crypto').createHash('sha256').update(JSON.stringify(rows||[])).digest('hex');
            if(revision!==previous){res.write(`id: ${revision}\nevent: changed\ndata: {}\n\n`);previous=revision;}
            else res.write(': heartbeat\n\n');
            await new Promise(resolve=>setTimeout(resolve,1000));
        }
    }catch{if(!closed)res.write('event: unavailable\ndata: {}\n\n');}
    finally{res.off('close',close);if(!closed)res.end();}
};
