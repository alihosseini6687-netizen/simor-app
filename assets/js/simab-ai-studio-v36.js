/* Mango AI Studio v35: visible third-party embed (no scraping/captcha bypass),
   strict origin-bound completion messages, user-consented channel archive. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const base='https://pwjlyryrrgbaprfnrieq.supabase.co/functions/v1/simab-central-quests';
const embedOrigin='https://image-generation.perchance.org';
const tg=window.Telegram?.WebApp;
const jobs=new Map(),queue=[],urls=new Set(),planIds=new Set();
let settings=null,generating=false,done=0,total=0,received=0,failed=0,archiveQueue=Promise.resolve(),generationSerial=0,results=0;
const status=t=>{$('studio-error').textContent=t||'';};
const generationStatus=t=>{$('generation-status').textContent=t||'';};
try{tg?.ready();tg?.expand();tg?.BackButton?.show();tg?.BackButton?.onClick(()=>location.assign('../../index.html'));}catch{}
function tab(name){
 for(const key of ['generate','resize','save']){$('panel-'+key).hidden=key!==name;$('tab-'+key).setAttribute('aria-selected',String(key===name));}
 window.scrollTo({top:0,behavior:'smooth'});
}
for(const key of ['generate','resize','save'])$('tab-'+key).onclick=()=>tab(key);
function validPlan(p){return p&&typeof p.id==='string'&&/^[a-z0-9_-]{1,24}$/.test(p.id)&&Number.isSafeInteger(p.coins)&&p.coins>=1&&Number.isSafeInteger(p.minutes)&&p.minutes>=1;}
function access(r){
 settings=r;planIds.clear();$('plans').hidden=true;
 $('studio').hidden=!r.enabled||!r.active;
 $('access-label').textContent=!r.enabled?'غیرفعال':r.freeMode?'رایگان':r.active?'فعال':'نیازمند فعال‌سازی';
 $('access-status').textContent=!r.enabled?'این بخش توسط مدیریت بسته شده است.':r.freeMode?'استفاده فعلاً رایگان است.':r.active?'دسترسی تا '+new Date(r.expiresAt).toLocaleString('fa-IR')+' فعال است.':'برای ورود یکی از پلن‌ها را انتخاب کن.';
 if(r.enabled&&!r.freeMode&&!r.active){
  $('plans').hidden=false;const wrap=$('plan-options');wrap.replaceChildren();
  for(const [i,p] of (Array.isArray(r.plans)?r.plans:[]).filter(validPlan).entries()){
   planIds.add(p.id);const label=document.createElement('label');label.className='preset';
   const input=document.createElement('input');input.type='radio';input.name='ai-plan';input.value=p.id;input.checked=i===0;
   label.append(input,document.createTextNode(p.coins.toLocaleString('fa-IR')+' سکه / '+p.minutes.toLocaleString('fa-IR')+' دقیقه'));wrap.append(label);
  }
  $('activate').disabled=!planIds.size;
 }
 $('ai-terms-text').textContent=typeof r.termsText==='string'?r.termsText:'';
 $('ai-terms-box').hidden=!r.termsText;
 $('archive-consent').disabled=false;
 $('archive-status').hidden=true;
}
async function refresh(){await SimabWallet.ready;access(await SimabWallet.read('ai_studio_state'));}
$('activate').onclick=async()=>{
 const plan=document.querySelector('input[name="ai-plan"]:checked')?.value;if(!planIds.has(plan))return status('پلن معتبر نیست.');
 $('activate').disabled=true;status('در حال فعال‌سازی…');
 try{await SimabWallet.mutate('ai_studio_activate',{planId:plan});await refresh();status('دسترسی فعال شد.');}catch(e){status(e.message);}finally{$('activate').disabled=false;}
};
function safeID(){return SimabWallet.requestId();}
function promptText(){
 const idea=$('idea').value.trim();if(!idea)return '';
 return [idea,$('style').value&&('Style: '+$('style').value),$('color').value&&('Colors: '+$('color').value)].filter(Boolean).join('. ');
}
function clearJobs(){
 for(const job of jobs.values()){clearTimeout(job.timeout);job.frame.remove();}
 jobs.clear();queue.splice(0);$('generation-frames').replaceChildren();
}
function cancel(){
 generationSerial++;generating=false;clearJobs();$('generate-now').disabled=false;$('cancel-job').disabled=true;
 generationStatus('ساخت متوقف شد. تصویرهایی که قبلاً دریافت شده‌اند در گالری باقی می‌مانند.');
}
$('cancel-job').onclick=cancel;
function finish(job,err,blob){
 if(!jobs.has(job.id)||job.serial!==generationSerial)return;
 clearTimeout(job.timeout);jobs.delete(job.id);
 job.frame.parentElement?.remove();done++;
 if(blob){received++;addImage(blob,'mango-'+(results+1)+'.jpg',true).catch(e=>status(e.message));}
 else failed++;
 const progress='تصاویر دریافت‌شده: '+received+' از '+total+' | تلاش انجام‌شده: '+done+' از '+total;
 if(err&&received===0){
  generating=false;clearJobs();$('generate-now').disabled=false;$('cancel-job').disabled=true;
  generationStatus(progress+'\nهیچ تصویری برنگشت. ارتباط با مولد تصویر در مرورگر تلگرام برقرار نشد؛ دوباره امتحان کن.');
  return;
 }
 generationStatus(progress+(err?' | یک تلاش ناموفق بود.':''));
 if(queue.length)startNext();
 if(!jobs.size&&!queue.length){
  generating=false;$('generate-now').disabled=false;$('cancel-job').disabled=true;
  generationStatus('ساخت پایان یافت. '+received+' تصویر از '+total+' درخواست دریافت شد.'+(failed?' '+failed+' تلاش ناموفق بود.':''));
 }
}
function startNext(){
 if(!generating||jobs.size>=1||!queue.length)return;
 const job=queue.shift();const wrap=document.createElement('div');wrap.className='job';
 const frame=document.createElement('iframe');frame.title='ساخت تصویر '+(job.index+1);
 frame.loading='eager';frame.referrerPolicy='no-referrer';
 // Show the upstream frame without overlays: its ads/security prompts are not hidden.
 frame.allow='clipboard-write';
 const json={id:job.id,prompt:job.prompt,negativePrompt:job.negativePrompt,
  resolution:job.resolution,guidanceScale:7,seed:Math.floor(Math.random()*2147483647)};
 frame.src=embedOrigin+'/embed#'+encodeURIComponent(JSON.stringify(json));
 wrap.append(frame);const note=document.createElement('p');note.textContent='تلاش '+(job.index+1)+' از '+total+'؛ منتظر پاسخ سرویس تصویر…';wrap.append(note);
 $('generation-frames').append(wrap);job.frame=frame;
 job.timeout=setTimeout(()=>finish(job,'زمان انتظار پاسخ تمام شد.',null),55000);
 jobs.set(job.id,job);
 // Use a single visible generation frame at a time.
}
$('generate-now').onclick=()=>{
 if(generating)return;
 if(!settings?.enabled||!settings?.active)return status('ابتدا دسترسی را فعال کن.');
 const prompt=promptText();if(!prompt)return status('ابتدا توضیح تصویر را بنویس.');
 const count=Number($('count').value);if(![1,2,4,8,16,32].includes(count))return status('تعداد انتخاب‌شده معتبر نیست.');
 clearJobs();generationSerial++;done=0;received=0;failed=0;total=count;generating=true;
 const serial=generationSerial,negativePrompt=$('negative').value.trim(),resolution=$('ratio').value;
 for(let i=0;i<count;i++)queue.push({id:safeID(),serial,index:i,prompt,negativePrompt,resolution});
 $('generate-now').disabled=true;$('cancel-job').disabled=false;status('');
 generationStatus('تعداد درخواستی: '+count+' | تصاویر دریافت‌شده: ۰ | شروع تلاش اول…');
 startNext();
};
window.addEventListener('message',async e=>{
 if(e.origin!==embedOrigin||!e.data||typeof e.data!=='object'||e.data.type!=='finished')return;
 const job=[...jobs.values()].find(j=>j.frame.contentWindow===e.source&&j.id===e.data.id);
 if(!job)return;
 // Only accept bounded image bytes from the exact associated generation frame.
 const data=e.data.dataUrl;
 if(typeof data!=='string'||data.length>18000000||!/^data:image\/(jpeg|png|webp);base64,/.test(data))
  return finish(job,'تصویر معتبر از موتور دریافت نشد.',null);
 try{const blob=await (await fetch(data)).blob();
  if(!blob.type.startsWith('image/')||blob.size<256||blob.size>12000000)throw Error('حجم یا نوع تصویر معتبر نیست.');
  finish(job,null,blob);
 }catch{finish(job,'خواندن تصویر ممکن نشد.',null);}
});
async function addImage(blob,name,generated){
 const url=URL.createObjectURL(blob);urls.add(url);results++;
 $('empty-gallery').hidden=true;
 const card=document.createElement('div');card.className='result';
 const img=document.createElement('img');img.src=url;img.alt='خروجی تصویر '+results;img.loading='lazy';
 const actions=document.createElement('div');actions.className='actions';
 const download=document.createElement('button');download.className='primary';download.textContent='💾 دانلود';
 download.onclick=()=>{const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();};
 const send=document.createElement('button');send.className='secondary';send.textContent='ارسال به آرشیو';send.disabled=!settings?.archiveReady;send.hidden=!settings?.archiveReady;
 send.onclick=async()=>{if(!$('archive-consent').checked)return tab('save'),$('archive-status').textContent='برای ارسال ابتدا گزینهٔ رضایت را فعال کن.';send.disabled=true;try{await archive(blob);send.textContent='✓ ارسال شد';}catch(e){$('archive-status').textContent=e.message;send.disabled=false;}};
 actions.append(download,send);card.append(img,actions);
 $('gallery').prepend(card);
 if(generated&&received===1)tab('save');
 if(generated&&settings?.archiveReady&&$('archive-consent').checked){
  // Serialize deliveries: backend enforces a 15-second window per user.
  archiveQueue=archiveQueue.catch(()=>{}).then(async()=>{
   try{await archive(blob);$('archive-status').textContent='تصویر جدید به آرشیو ارسال شد.';}catch(e){$('archive-status').textContent='ارسال خودکار کامل نشد: '+e.message;}
   await new Promise(resolve=>setTimeout(resolve,16500));
  });
 }
}
function initData(){const direct=tg?.initData||'';if(direct)return direct;try{return sessionStorage.getItem('simab_signed_launch_init_data_v1')||'';}catch{return'';}}
async function jpeg(data){
 const img=document.createElement('img');const url=URL.createObjectURL(data);
 try{
  await new Promise((ok,bad)=>{img.onload=ok;img.onerror=()=>bad(Error('تصویر قابل‌خواندن نیست.'));img.src=url;});
  if(!img.naturalWidth||!img.naturalHeight)throw Error('اندازهٔ تصویر معتبر نیست.');
  const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(scale*img.naturalWidth));canvas.height=Math.max(1,Math.round(scale*img.naturalHeight));
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('پردازش تصویر پشتیبانی نمی‌شود.');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
  let out=canvas.toDataURL('image/jpeg',.85);if(out.length>2200000)out=canvas.toDataURL('image/jpeg',.65);
  if(out.length>2200000)throw Error('حجم عکس برای کانال زیاد است.');
  return out;
 }finally{URL.revokeObjectURL(url);}
}
async function archive(blob){
 if(!settings?.archiveReady||!settings?.termsText)throw Error('ارسال تصویر هنوز فعال نیست.');
 if(!$('archive-consent').checked)throw Error('رضایت ارسال ثبت نشده است.');
 const init=initData();if(!init)throw Error('از داخل ربات تلگرام وارد شو.');
 const requestId=SimabWallet.requestId(),imageData=await jpeg(blob);
 const resp=await fetch(base+'?ai_upload=1',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'ai_studio_archive',requestId,initData:init,consent:true,imageData})});
 const r=await resp.json().catch(()=>({}));
 if(!resp.ok||!r.archived)throw Error(r.error==='archive_delivery_unknown'?'وضعیت ارسال نامشخص است؛ قبل از تکرار کانال را بررسی کن.':r.error||'ارسال به کانال تأیید نشد.');
 return r;
}
$('resize-file').addEventListener('change',()=>{const file=$('resize-file').files?.[0];$('resize-filename').textContent=file?'انتخاب شد: '+file.name:'هنوز تصویری انتخاب نشده است.';$('resize-status').textContent=file?'عکس انتخاب شد؛ «بزرگ‌کردن» را بزن.':'';});
$('resize-go').onclick=async()=>{
 const file=$('resize-file').files?.[0];if(!file)return $('resize-status').textContent='ابتدا عکس را انتخاب کن.';
 if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>12000000)return $('resize-status').textContent='فقط JPG/PNG/WEBP تا ۱۲ مگابایت مجاز است.';
 const url=URL.createObjectURL(file),img=document.createElement('img');
 try{
  await new Promise((ok,bad)=>{img.onload=ok;img.onerror=()=>bad(Error('عکس باز نشد.'));img.src=url;});
  if(!img.naturalWidth||!img.naturalHeight||Math.max(img.naturalWidth,img.naturalHeight)>2048)throw Error('حداکثر ضلع تصویر ورودی ۲۰۴۸ پیکسل است.');
  const c=document.createElement('canvas');c.width=img.naturalWidth*2;c.height=img.naturalHeight*2;
  const cx=c.getContext('2d');if(!cx)throw Error('مرورگر پردازش تصویر را پشتیبانی نمی‌کند.');
  cx.imageSmoothingEnabled=true;cx.imageSmoothingQuality='high';cx.drawImage(img,0,0,c.width,c.height);
  const blob=await new Promise(ok=>c.toBlob(ok,'image/png'));if(!blob)throw Error('تبدیل انجام نشد.');
  await addImage(blob,'mango-resized-'+Date.now()+'.png',false);
  $('resize-status').textContent='عکس دوبرابر شد و در گالری قرار گرفت.';tab('save');
 }catch(e){$('resize-status').textContent=e.message;}finally{URL.revokeObjectURL(url);}
};
window.addEventListener('pagehide',()=>{clearJobs();for(const url of urls)URL.revokeObjectURL(url);});
refresh().catch(e=>{status(e.message);$('access-label').textContent='ورود لازم است';$('access-status').textContent='از دکمهٔ ربات تلگرام وارد شو.';});
})();