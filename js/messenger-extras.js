/* Voice and structured study reports; recordings stay in memory until sent. */
const MessengerExtras=(()=>{
    let api,recorder,stream,tick,recordingToken=0,previewURL=null,voice=null,dialog=null;
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const ascii=v=>String(v).replace(/[۰-۹]/g,c=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/[٠-٩]/g,c=>'٠١٢٣٤٥٦٧٨٩'.indexOf(c));
    const fa=v=>Number(v).toLocaleString('fa-IR');
    const icon=path=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="${path}"/></svg>`;
    function mount(bridge){
        api=bridge;if(document.getElementById('im-extra-actions'))return;
        const actions=document.createElement('div');actions.id='im-extra-actions';
        actions.innerHTML=`<button type="button" id="im-voice">${icon('M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0ZM5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8')}پیام صوتی</button><button type="button" id="im-study-report">${icon('M6 3h12v19H6ZM9 8h6M9 12h6M9 16h4')}گزارش مطالعه</button><span id="im-connection" role="status"></span>`;
        document.getElementById('im-compose').before(actions);
        actions.querySelector('#im-voice').onclick=startVoice;actions.querySelector('#im-study-report').onclick=openReport;
        document.getElementById('im-log').addEventListener('change',e=>{if(e.target.matches('[data-audio-rate]'))e.target.closest('.im-voice-card').querySelector('audio').playbackRate=Number(e.target.value);});
        document.getElementById('im-log').addEventListener('click',e=>{const button=e.target.closest('[data-review-study]');if(button)review(button.dataset.reviewStudy);});
        update();
    }
    function update(){if(!api)return;const s=api.state();const mic=document.getElementById('im-voice'),report=document.getElementById('im-study-report');if(mic)mic.disabled=s.blocked||s.peer==='~ai'||!s.peer;if(report){report.hidden=!s.canReport;report.disabled=s.blocked;}}
    function connection(text){const node=document.getElementById('im-connection');if(node&&node.textContent!==text)node.textContent=text;}
    function modal(title){close();dialog=document.createElement('dialog');dialog.className='im-extra-dialog';dialog.setAttribute('aria-label',title);dialog.innerHTML=`<header><h2>${esc(title)}</h2><button type="button" aria-label="بستن">×</button></header><div class="im-extra-content"></div>`;document.body.append(dialog);dialog.querySelector('header button').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.showModal();return dialog.querySelector('.im-extra-content');}
    function stopTracks(){stream?.getTracks().forEach(t=>t.stop());stream=null;clearInterval(tick);tick=null;}
    function close(){recordingToken++;if(recorder&&recorder.state!=='inactive')recorder.stop();recorder=null;stopTracks();if(previewURL)URL.revokeObjectURL(previewURL);previewURL=null;voice=null;if(dialog){dialog.close();dialog.remove();dialog=null;}}
    async function startVoice(){
        const context=api.state();if(context.blocked||context.peer==='~ai')return;
        const body=modal('پیام صوتی');const token=recordingToken;
        if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){body.textContent='مرورگر شما ضبط صدا را پشتیبانی نمی‌کند. از مرورگر به‌روز و اتصال HTTPS استفاده کن.';return;}
        body.innerHTML='<p role="status">برای شروع ضبط، دسترسی میکروفن را تأیید کن.</p>';
        try{
            const tracks=await navigator.mediaDevices.getUserMedia({audio:true});
            if(token!==recordingToken){tracks.getTracks().forEach(t=>t.stop());return;}
            stream=tracks;
            const mime=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
            recorder=new MediaRecorder(stream,{...(mime?{mimeType:mime}:{}),audioBitsPerSecond:48000});
            const chunks=[],started=Date.now();let duration=0,bytes=0;
            body.innerHTML='<div class="im-recording"><span class="im-record-dot"></span><strong id="im-record-time">۰۰:۰۰</strong><p>در حال ضبط · حداکثر ۳ دقیقه</p></div><button type="button" class="im-primary" id="im-stop-voice">توقف و گوش‌دادن</button><button type="button" id="im-cancel-voice">لغو ضبط</button>';
            const finish=()=>{if(recorder?.state==='recording'){duration=Math.min(180,(Date.now()-started)/1000);recorder.stop();stopTracks();}};
            recorder.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);bytes+=e.data.size;if(bytes>1900000)finish();}};
            recorder.onerror=()=>{if(token!==recordingToken)return;stopTracks();body.innerHTML='<p role="alert">ضبط صدا ناموفق بود؛ پنجره را ببند و دوباره تلاش کن.</p>';};
            recorder.onstop=async()=>{
                if(token!==recordingToken)return;stopTracks();duration=duration||Math.min(180,(Date.now()-started)/1000);
                const type=recorder.mimeType||mime||'audio/webm',blob=new Blob(chunks,{type});
                if(!blob.size||blob.size>2*1024*1024){body.textContent='فایل صوتی خالی یا بزرگ‌تر از ۲ مگابایت است؛ دوباره ضبط کن.';return;}
                previewURL=URL.createObjectURL(blob);const extension=type.includes('mp4')?'m4a':type.includes('ogg')?'ogg':'webm';
                const data=await base64(blob);if(token!==recordingToken)return;
                voice={name:`voice-${Date.now()}.${extension}`,data,voice:true,duration:Math.max(1,duration)};
                body.innerHTML=`<p>قبل از ارسال گوش بده · ${fa(Math.ceil(duration))} ثانیه</p><audio controls preload="metadata" src="${previewURL}"></audio><div class="im-extra-buttons"><button type="button" class="im-primary" id="im-confirm-voice">ارسال ویس</button><button type="button" id="im-discard-voice">حذف و لغو</button></div><p id="im-voice-status" role="status"></p>`;
                body.querySelector('#im-discard-voice').onclick=close;
                body.querySelector('#im-confirm-voice').onclick=async e=>{e.target.disabled=true;body.querySelector('#im-voice-status').textContent='در حال ارسال…';const ok=await api.sendFile(voice,context.peer);if(token!==recordingToken)return;if(ok)close();else{e.target.disabled=false;body.querySelector('#im-voice-status').textContent='ارسال نشد؛ ویس برای تلاش دوباره آماده است.';}};
            };
            recorder.start(1000);tick=setInterval(()=>{const elapsed=Math.min(180,Math.floor((Date.now()-started)/1000));const timer=document.getElementById('im-record-time');if(timer)timer.textContent=`${String(Math.floor(elapsed/60)).padStart(2,'0')}:${String(elapsed%60).padStart(2,'0')}`;if(elapsed>=180)finish();},250);
            body.querySelector('#im-stop-voice').onclick=finish;body.querySelector('#im-cancel-voice').onclick=close;
        }catch(error){stopTracks();if(token===recordingToken)body.textContent=error.name==='NotAllowedError'?'اجازهٔ میکروفن داده نشد. دسترسی میکروفن را در تنظیمات مرورگر فعال کن.':'میکروفن در دسترس نیست؛ اتصال و برنامه‌های دیگر را بررسی کن.';}
    }
    const base64=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(Error('خواندن فایل ناموفق بود.'));r.readAsDataURL(blob);});
    async function openReport(){
        const context=api.state();if(!context.canReport||context.blocked)return;
        const body=modal('گزارش مطالعه برای '+(context.peer==='~saved'?'خودم':'مشاور'));const token=recordingToken,id=crypto.randomUUID();body.textContent='در حال دریافت برنامه و گزارش‌ها…';
        try{
            const options=await api.request(null,`&action=reportOptions&peer=${encodeURIComponent(context.peer)}`);if(token!==recordingToken)return;
            const tasks=(options.schedule||[]).flatMap(d=>d.tasks||[]).filter(t=>t.id);
            const reports=options.reports||[],records=options.records||[];
            body.innerHTML=`<form id="im-report-form"><label>نوع گزارش<select name="source"><option value="manual">ثبت گزارش جدید</option><option value="existing">ارسال گزارش قبلی (بدون ثبت دوباره)</option><option value="timer">زمان ثبت‌شده با تایمر (بدون افزودن زمان)</option></select></label><div data-mode="manual"><label>تسک برنامه<select name="taskId"><option value="">مطالعه آزاد</option>${tasks.map(t=>`<option value="${esc(t.id)}">${esc(t.subject)}</option>`).join('')}</select></label><label>درس و مبحث<input name="subject" maxlength="100" placeholder="مثلاً زیست؛ فصل دوم"></label><label>تاریخ شمسی<input name="date" inputmode="numeric" value="${esc(StudyFlow.jalali())}"></label><div class="im-form-grid"><label>از ساعت<input name="start" inputmode="numeric" placeholder="۱۴:۰۰"></label><label>تا ساعت<input name="end" inputmode="numeric" placeholder="۱۵:۳۰"></label></div><label>وضعیت<select name="status"><option value="completed">کامل</option><option value="partial">ناقص</option><option value="missed">انجام‌نشده</option></select></label><label>تعداد تست (اختیاری)<input name="testCount" inputmode="numeric" maxlength="4"></label></div><div data-mode="existing" hidden><label>گزارش قبلی<select name="reportId">${reports.slice().reverse().map(r=>`<option value="${esc(r.id)}">${esc(r.subject)} · ${esc(r.date)} · ${fa(r.minutes)} دقیقه</option>`).join('')}</select></label></div><div data-mode="timer" hidden><p>زمان‌های یک درس را انتخاب کن؛ ساعت مطالعه دوباره شمرده نمی‌شود.</p>${records.slice(-100).reverse().map(r=>`<label class="im-record-choice"><input type="checkbox" name="recordId" value="${esc(r.id)}"><span>${esc(r.subject)} · ${esc(new Date(r.endedAt).toLocaleDateString('fa-IR'))} · ${fa(Math.floor(r.seconds/60))} دقیقه و ${fa(r.seconds%60)} ثانیه</span></label>`).join('')||'<p>زمانی با تایمر ثبت نشده است.</p>'}</div><label>توضیح برای مشاور<textarea name="notes" rows="3" maxlength="500"></textarea></label><label>عکس کار (اختیاری)<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label><p class="im-report-hint">ثبت جدید فقط یک‌بار به آمار اضافه می‌شود. اگر با تایمر مطالعه کرده‌ای، گزینهٔ تایمر را انتخاب کن.</p><p id="im-report-error" role="alert"></p><button class="im-primary" type="submit">ثبت و ارسال گزارش</button></form>`;
            const form=body.querySelector('form');form.elements.source.onchange=()=>form.querySelectorAll('[data-mode]').forEach(n=>n.hidden=n.dataset.mode!==form.elements.source.value);
            form.elements.taskId.onchange=()=>{const task=tasks.find(t=>t.id===form.elements.taskId.value);if(task)form.elements.subject.value=task.subject;};
            form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;button.textContent='در حال ثبت و ارسال…';
                try{
                    const f=form.elements,source=f.source.value;let photo=null;
                    if(f.photo.files[0]){const file=f.photo.files[0];if(file.size>2*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('عکس JPG، PNG یا WebP تا ۲ مگابایت انتخاب کن.');photo={name:file.name,data:await base64(file)};}
                    const report={source,taskId:f.taskId.value,subject:f.subject.value,date:StudyFlow.iso(f.date.value),start:ascii(f.start.value),end:ascii(f.end.value),status:f.status.value,testCount:ascii(f.testCount.value),notes:f.notes.value,reportId:f.reportId.value,recordIds:[...form.querySelectorAll('[name=recordId]:checked')].map(n=>n.value)};
                    await api.submitReport({id,report,file:photo},context.peer);if(token===recordingToken)close();
                }catch(error){if(token===recordingToken){body.querySelector('#im-report-error').textContent=error.message;button.disabled=false;button.textContent='تلاش دوباره برای ارسال';}}
            };
        }catch(error){if(token===recordingToken)body.textContent=error.message;}
    }
    function reportHTML(message){const r=message.studyReport;if(!r)return '';const status={completed:'کامل',partial:'ناقص',missed:'انجام‌نشده'}[r.status]||'ثبت شده';const seconds=Math.round(r.seconds??Number(r.minutes||0)*60);return `<section class="im-study-card"><small>گزارش مطالعه · ${esc(r.source==='timer'?'زمان تایمر':'گزارش دستی')}</small><h3>${esc(r.subject)}</h3><div class="im-study-metrics"><strong>${fa(Math.floor(seconds/60))}<small>دقیقه${seconds%60?` و ${fa(seconds%60)} ثانیه`:''}</small></strong><span>${status}</span></div><p>${esc(r.date?new Date(r.date+'T12:00:00').toLocaleDateString('fa-IR'):'')}${r.start?` · ${esc(r.start)} تا ${esc(r.end)}`:''}</p>${r.testCount!=null?`<p>${fa(r.testCount)} تست</p>`:''}${r.notes?`<p dir="auto">${esc(r.notes)}</p>`:''}${r.review?`<div class="im-study-review"><strong>بررسی‌شده توسط مشاور</strong><p dir="auto">${esc(r.review.feedback||'گزارشت بررسی شد؛ به مسیرت ادامه بده.')}</p></div>`:'<small>هنوز بررسی نشده</small>'}${api?.state().canReview?`<button type="button" data-review-study="${esc(message.id)}">${r.review?'ویرایش بازخورد':'بررسی و بازخورد'}</button>`:''}</section>`;}
    function voiceHTML(file,url){return `<div class="im-voice-card"><small>پیام صوتی · ${fa(file.duration||0)} ثانیه</small><audio controls preload="none" src="${esc(url)}" aria-label="پیام صوتی"></audio><label>سرعت پخش<select data-audio-rate><option value="1">۱×</option><option value="1.5">۱٫۵×</option><option value="2">۲×</option></select></label></div>`;}
    function review(id){const context=api.state(),body=modal('بازخورد گزارش'),token=recordingToken;body.innerHTML='<form><label>یادداشت برای دانش‌آموز<textarea name="feedback" rows="4" maxlength="1000" placeholder="نکته یا قدم بعدی را بنویس…"></textarea></label><p role="alert"></p><button class="im-primary" type="submit">بررسی شد؛ ارسال بازخورد</button></form>';body.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,b=f.querySelector('button');b.disabled=true;try{await api.review(id,f.elements.feedback.value,context.peer);if(token===recordingToken)close();}catch(error){if(token!==recordingToken)return;f.querySelector('p').textContent=error.message;b.disabled=false;}};}
    return {mount,update,connection,close,reportHTML,voiceHTML};
})();
window.MessengerExtras=MessengerExtras;
