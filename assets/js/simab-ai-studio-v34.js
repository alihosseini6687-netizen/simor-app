/* Mango AI studio launcher, no hidden Perchance calls or scraping. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const base='https://pwjlyryrrgbaprfnrieq.supabase.co/functions/v1/simab-central-quests';
const tg=window.Telegram?.WebApp;
let settings=null,chosenBlob=null,previewURL=null,popup=null,upscaleURL=null,upscaleContext=null,uploadBusy=false;
const planIds=new Set();
const setStatus=(t)=>{$('studio-error').textContent=t||'';};
try{tg?.ready();tg?.expand();tg?.BackButton?.show();tg?.BackButton?.onClick(()=>location.assign('../../index.html'));}catch{}
function pickTab(tab){for(const name of ['generate','upscale','save']){$('panel-'+name).hidden=tab!==name;$('tab-'+name).setAttribute('aria-selected',String(tab===name));}window.scrollTo({top:0,behavior:'smooth'});}
for(const name of ['generate','upscale','save'])$('tab-'+name).onclick=()=>pickTab(name);
function validPlan(p){return p&&typeof p.id==='string'&&/^[a-z0-9_-]{1,24}$/.test(p.id)&&Number.isSafeInteger(p.coins)&&p.coins>=1&&Number.isSafeInteger(p.minutes)&&p.minutes>=1;}
function renderAccess(r){
 settings=r;planIds.clear();
 $('plans').hidden=true;$('studio').hidden=!r.active||!r.enabled;
 $('access-label').textContent=!r.enabled?'غیرفعال':r.freeMode?'رایگان':r.active?'دسترسی فعال':'نیازمند فعال‌سازی';
 $('access-status').textContent=!r.enabled?'این بخش فعلاً توسط مدیریت بسته شده است.':r.freeMode?'استفاده از ابزارهای این بخش فعلاً رایگان است.':r.active?'دسترسی فعال تا '+new Date(r.expiresAt).toLocaleString('fa-IR'):'برای ورود، یکی از پلن‌ها را انتخاب کن. سکه فقط در سرور کسر می‌شود.';
 if(r.enabled&&!r.freeMode&&!r.active){
  $('plans').hidden=false;const wrap=$('plan-options');wrap.replaceChildren();
  const plans=(Array.isArray(r.plans)?r.plans:[]).filter(validPlan);
  for(const [i,p] of plans.entries()){planIds.add(p.id);const label=document.createElement('label');label.className='preset';
   const input=document.createElement('input');input.type='radio';input.name='ai-plan';input.value=p.id;input.checked=i===0;label.append(input,document.createTextNode(p.coins.toLocaleString('fa-IR')+' سکه / '+p.minutes.toLocaleString('fa-IR')+' دقیقه'));wrap.append(label);
  }
  $('activate').disabled=!plans.length;
 }
 $('archive-send').disabled=!r.archiveReady||!chosenBlob||uploadBusy;
 if(!r.archiveReady)$('archive-status').textContent='آرشیو خودکار کانال هنوز توسط مدیریت فعال نشده است؛ ذخیره و دانلود تصویر روی دستگاه فعال است.';
}
async function refresh(){await SimabWallet.ready;const r=await SimabWallet.read('ai_studio_state');renderAccess(r);}
$('activate').onclick=async()=>{if(!settings||settings.freeMode)return;
 const plan=document.querySelector('input[name="ai-plan"]:checked')?.value;if(!planIds.has(plan))return setStatus('پلن انتخاب‌شده معتبر نیست.');
 $('activate').disabled=true;setStatus('در حال فعال‌سازی سروری…');
 try{await SimabWallet.mutate('ai_studio_activate',{planId:plan});await refresh();setStatus('دسترسی ثبت شد.');}
 catch(e){setStatus(e.message);}finally{$('activate').disabled=false;}
};
const sourceFields=['idea','style','color','ratio','count','negative'];
function compose(){
 const idea=$('idea').value.trim(),style=$('style').value,color=$('color').value,ratio=$('ratio').value;
 const prompt=[idea,style&&('Style: '+style),color&&('Colors: '+color),ratio&&('Composition: '+ratio)].filter(Boolean).join('. ');
 $('composed').value=prompt+($('negative').value.trim()?'\nNegative prompt: '+$('negative').value.trim():'');
 return $('composed').value;
}
for(const id of sourceFields)$(id).addEventListener('input',compose);
$('compose').onclick=compose;
$('copy-prompt').onclick=async()=>{const text=compose();if(!text)return setStatus('ابتدا توضیح تصویر را بنویس.');
 try{await navigator.clipboard.writeText(text);setStatus('پرامپت کپی شد؛ آن را داخل Perchance بچسبان.');}
 catch{$('composed').focus();$('composed').select();setStatus('متن انتخاب شد؛ از گزینهٔ کپی گوشی استفاده کن.');}
};
$('open-generator').onclick=()=>{const url='https://perchance.org/ai-text-to-image-generator';try{if(tg?.openLink)tg.openLink(url);else window.open(url,'_blank','noopener');}catch{location.assign(url);}};
function revoke(){if(previewURL)URL.revokeObjectURL(previewURL);previewURL=null;}
function selectImage(blob,name='mango-image.jpg'){
 if(!(blob instanceof Blob)||!blob.type.startsWith('image/')||blob.size>22000000)return setStatus('لطفاً عکس JPG، PNG یا WEBP معتبر و کوچک‌تر از ۲۲ مگابایت انتخاب کن.');
 chosenBlob=blob;revoke();previewURL=URL.createObjectURL(blob);
 $('preview').src=previewURL;$('preview').hidden=false;$('result-meta').textContent=name+' • '+(blob.size/1024/1024).toFixed(2)+' MB';
 $('download').disabled=false;$('archive-send').disabled=!settings?.archiveReady||uploadBusy;
 setStatus('');
}
$('archive-file').onchange=e=>{const f=e.target.files?.[0];if(f)selectImage(f,f.name);};
$('upscale-file').onchange=e=>{const f=e.target.files?.[0];if(f)selectImage(f,f.name);};
$('download').onclick=()=>{if(!chosenBlob)return;const a=document.createElement('a');a.href=previewURL||URL.createObjectURL(chosenBlob);a.download='mango-ai-'+Date.now()+'.'+(chosenBlob.type.includes('png')?'png':chosenBlob.type.includes('webp')?'webp':'jpg');document.body.append(a);a.click();a.remove();};
async function dataURL(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(blob);});}
$('upscale-open').onclick=async()=>{
 const file=$('upscale-file').files?.[0];if(!file)return setStatus('ابتدا عکس را انتخاب کن.');
 // Must be a direct click: the external service is ad-funded and must stay visible.
 const opened=window.open('https://bigger.pics/','_blank');
 if(!opened)return setStatus('مرورگر تلگرام پنجره را مسدود کرد؛ از لینک بازکردن مستقل استفاده کن.');
 popup=opened;upscaleContext=crypto.randomUUID?.()||('mango-'+Date.now());
 try{upscaleURL=await dataURL(file);setStatus('پنجرهٔ bigger.pics باز شد؛ مراحل آپ‌اسکیل را آنجا انجام بده.');}
 catch{setStatus('عکس قابل‌خواندن نیست.');}
};
window.addEventListener('message',async e=>{
 if(e.origin!=='https://app.bigger.pics'||!e.data||typeof e.data!=='object')return;
 if(e.data.type==='bigger-pics-ready'&&popup&&upscaleURL&&upscaleContext){
  e.source?.postMessage({type:'bigger-pics-image',url:upscaleURL,name:'mango-image.png',site:location.origin+location.pathname,format:'png',context:upscaleContext},e.origin);
 }
 if(e.data.type==='bigger-pics-result'&&upscaleContext&&e.data.context===upscaleContext&&e.data.blob instanceof Blob){
  selectImage(e.data.blob,'تصویر آپ‌اسکیل‌شده');pickTab('save');setStatus('نسخهٔ آپ‌اسکیل دریافت شد؛ حالا می‌توانی آن را دانلود کنی.');
  upscaleContext=null;upscaleURL=null;
  // Once the user explicitly opts in, returned results may archive automatically.
  if($('archive-consent').checked&&settings?.archiveReady)await archive();
 }
});
async function toJpeg(data){
 const img=document.createElement('img');const url=URL.createObjectURL(data);
 try{
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('تصویر باز نشد.'));img.src=url;});
  const maxDimension=1600,ratio=Math.min(1,maxDimension/Math.max(img.naturalWidth,img.naturalHeight));
  if(!img.naturalWidth||!img.naturalHeight)throw Error('ابعاد نامعتبر تصویر.');
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('مرورگر از تبدیل عکس پشتیبانی نمی‌کند.');
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
  let out=canvas.toDataURL('image/jpeg',.85);
  if(out.length>2200000)out=canvas.toDataURL('image/jpeg',.65);
  if(out.length>2200000)throw Error('حجم عکس برای ارسال به کانال زیاد است؛ عکس کوچک‌تری انتخاب کن.');
  return out;
 }finally{URL.revokeObjectURL(url);}
}
function signedData(){
 const direct=tg?.initData||'';if(direct)return direct;
 try{return sessionStorage.getItem('simab_signed_launch_init_data_v1')||'';}catch{return'';}
}
async function archive(){
 if(uploadBusy||!chosenBlob||!settings?.archiveReady)return;
 if(!$('archive-consent').checked)return $('archive-status').textContent='برای ارسال تصویر به کانال، ابتدا رضایت را ثبت کن.';
 const initData=signedData();if(!initData)return $('archive-status').textContent='این بخش باید از داخل ربات تلگرام باز شود.';
 uploadBusy=true;$('archive-send').disabled=true;$('archive-status').textContent='در حال ذخیرهٔ نسخه در کانال…';
 const requestId=SimabWallet.requestId();
 try{
  const imageData=await toJpeg(chosenBlob);
  const response=await fetch(base+'?ai_upload=1',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'ai_studio_archive',requestId,initData,consent:true,imageData})});
  const r=await response.json();
  if(!response.ok||!r.archived)throw Error(r.error==='archive_delivery_unknown'?'وضعیت ارسال مشخص نشد؛ برای جلوگیری از نسخهٔ تکراری، کانال را بررسی کن.':r.error==='archive_not_ready'?'کانال هنوز توسط مدیر تنظیم نشده است.':'ارسال تأیید نشد. '+(r.error||response.status));
  $('archive-status').textContent='✅ تصویر در کانال ذخیره شد. شمارهٔ پیام: '+r.messageId;
 }catch(e){$('archive-status').textContent=e.message;}
 finally{uploadBusy=false;$('archive-send').disabled=!settings?.archiveReady||!chosenBlob;}
}
$('archive-send').onclick=archive;
window.addEventListener('pagehide',revoke);
refresh().catch(e=>{setStatus(e.message);$('access-label').textContent='ورود تلگرام لازم است';$('access-status').textContent='برای استفاده، از داخل مینی‌اپ اصلی مانگو وارد شو.';});
compose();
})();