// Private objects. Only the authenticated messenger endpoint can serve bytes.
const bucket='darsyar-chat-private';
let ready;
async function call(path,options={}){
    const key=process.env.SUPABASE_SERVICE_ROLE_KEY,url=process.env.SUPABASE_URL;
    if(!key||!url)throw Error('Private storage is not configured');
    return fetch(`${url}/storage/v1/${path}`,{...options,signal:AbortSignal.timeout(15000),headers:{apikey:key,Authorization:`Bearer ${key}`,...options.headers}});
}
async function ensureBucket(){
    if(!ready)ready=(async()=>{
        let response=await call(`bucket/${bucket}`);
        if(!response.ok){
            if(![400,404].includes(response.status))throw Error('Private storage unavailable');
            await call('bucket',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:bucket,name:bucket,public:false,file_size_limit:2097152})});
            response=await call(`bucket/${bucket}`);
        }
        if(!response.ok||(await response.json()).public!==false)throw Error('Private bucket required');
    })().catch(error=>{ready=null;throw error;});
    return ready;
}
async function save(owner,thread,id,file){
    await ensureBucket();
    const bytes=Buffer.from(file.data,'base64'),digest=require('crypto').createHash('sha256').update(bytes).digest('hex');
    const path=`${owner}/${thread}/${id}/${digest}`;
    const response=await call(`object/${bucket}/${path}`,{method:'POST',headers:{'Content-Type':file.type,'x-upsert':'false'},body:bytes});
    if(!response.ok){const error=await response.json().catch(()=>({}));if(response.status!==409&&error.error!=='Duplicate'&&error.statusCode!=='409')throw Error('File upload failed');}
    const {data,...metadata}=file;return {...metadata,storagePath:path};
}
async function read(file){
    if(!file.storagePath)return Buffer.from(file.data,'base64'); // Existing private attachments remain readable.
    if(!/^[a-z0-9_.-]+\/[a-f0-9]{24}\/[a-f0-9-]{36}\/[a-f0-9]{64}$/.test(file.storagePath))throw Error('Invalid storage path');
    const response=await call(`object/authenticated/${bucket}/${file.storagePath}`);
    if(!response.ok)throw Error('File download failed');
    return Buffer.from(await response.arrayBuffer());
}
async function remove(owner,paths){
    if(paths.some(p=>typeof p!=='string'||!p.startsWith(owner+'/')||!/^[a-z0-9_.-]+\/[a-f0-9]{24}\/[a-f0-9-]{36}\/[a-f0-9]{64}$/.test(p)))throw Error('Invalid private file scope');
    for(let i=0;i<paths.length;i+=100){const response=await call(`object/${bucket}`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:paths.slice(i,i+100)})});if(!response.ok)throw Error('File removal failed');}
}
module.exports={save,read,remove};
