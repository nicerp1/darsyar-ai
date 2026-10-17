const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../lib/chat-files.js'),'utf8');
function storage(publicBucket=false){let exists=false;const calls=[];const scope={module:{exports:{}},require,Buffer,AbortSignal,process:{env:{SUPABASE_URL:'https://storage.invalid',SUPABASE_SERVICE_ROLE_KEY:'test-only'}},fetch:async(url,options)=>{
    calls.push({url,options});const method=options.method||'GET';
    if(url.endsWith('/bucket')&&method==='POST'){assert.equal(JSON.parse(options.body).public,false);exists=true;return {ok:true};}
    if(url.includes('/bucket/'))return{ok:exists,status:exists?200:404,json:async()=>({public:publicBucket})};
    if(url.includes('/object/authenticated/'))return{ok:true,arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer};
    return{ok:true};
}};vm.runInNewContext(source,scope);return {api:scope.module.exports,calls};}
async function main(){
    const a=storage(),id='12345678-1234-1234-1234-123456789012',hash='a'.repeat(24),file={name:'voice.webm',type:'audio/webm',voice:true,duration:10,size:3,data:Buffer.from([1,2,3]).toString('base64')};
    const saved=await a.api.save('alice',hash,id,file);assert(saved.storagePath.startsWith('alice/'));assert(!saved.data);
    assert.equal(a.calls.filter(c=>c.url.endsWith('/bucket')&&c.options.method==='POST').length,1);
    const upload=a.calls.find(c=>c.url.includes('/object/')&&c.options.method==='POST');assert(Buffer.isBuffer(upload.options.body));assert.equal(upload.options.headers['x-upsert'],'false');
    assert.deepEqual([...await a.api.read(saved)],[1,2,3]);await assert.rejects(a.api.remove('bob',[saved.storagePath]),/scope/);await a.api.remove('alice',[saved.storagePath]);
    const b=storage(true);await assert.rejects(b.api.save('alice',hash,id,file),/Private bucket/);assert(!b.calls.some(c=>c.url.includes('/object/')));
    console.log('PASS: private-only bucket creation, binary upload, authenticated download, owner-scoped removal, reject public bucket');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
