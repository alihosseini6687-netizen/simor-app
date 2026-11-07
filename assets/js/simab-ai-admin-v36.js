(()=>{'use strict';
const $=id=>document.getElementById(id);
const root=$('ai-admin-panel');if(!root)return;
let busy=false;
const state=t=>$('ai-admin-message').textContent=t;
const parseNum=x=>{const t=String(x).replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).trim();return /^\d+$/.test(t)?Number(t):NaN;};
function planRow(p){
 const row=document.createElement('div');row.className='custom-task-item';row.style.cssText='display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:5px;align-items:center';
 for(const [field,value,hint] of [['id',p.id,'شناسه'],['coins',p.coins,'سکه'],['minutes',p.minutes,'دقیقه']]){
  const input=document.createElement('input');input.className='input-field';input.style.marginBottom='0';input.dataset.field=field;input.value=value;input.placeholder=hint;
  if(field!=='id')input.inputMode='numeric';
  row.append(input);
 }
 const del=document.createElement('button');del.type='button';del.className='btn-del';del.textContent='×';del.title='حذف پلن';del.onclick=()=>row.remove();row.append(del);$('ai-admin-plans').append(row);
}
function parsePlans(){
 const rows=[...$('ai-admin-plans').children];
 if(rows.length<1||rows.length>5)throw Error('بین ۱ تا ۵ پلن وارد کن.');
 return rows.map(row=>{const val=k=>row.querySelector('[data-field="'+k+'"]')?.value.trim();const id=val('id'),coins=parseNum(val('coins')),minutes=parseNum(val('minutes'));if(!/^[a-z0-9_-]{1,24}$/.test(id)||!Number.isInteger(coins)||coins<1||coins>10000||!Number.isInteger(minutes)||minutes<1||minutes>180)throw Error('شناسهٔ پلن باید انگلیسی باشد، سکه بین ۱ تا ۱۰هزار و مدت بین ۱ تا ۱۸۰ دقیقه.');return{id,coins,minutes};});
}
async function load(){
 state('در حال خواندن…');
 const r=await SimabWallet.read('admin_ai_studio_status');
 $('ai-admin-enabled').checked=r.enabled;$('ai-admin-free').checked=r.freeMode;
 $('ai-admin-channel').value=r.archiveChannelId||'';$('ai-admin-archive').checked=r.archiveEnabled;
 $('ai-admin-terms').value=r.termsText||'';
 $('ai-admin-plans').replaceChildren();
 (r.plans||[]).forEach(planRow);
 state('تنظیمات امن سرور دریافت شد.');
}
$('ai-admin-add-plan').onclick=()=>{if($('ai-admin-plans').children.length>=5)return state('حداکثر ۵ پلن مجاز است.');planRow({id:'plan'+($('ai-admin-plans').children.length+1),coins:10,minutes:10});};
$('ai-admin-refresh').onclick=()=>load().catch(e=>state(e.message));
$('ai-admin-save').onclick=async()=>{if(busy)return;
 try{const plans=parsePlans(),channelId=$('ai-admin-channel').value.trim();
  if(new Set(plans.map(p=>p.id)).size!==plans.length)throw Error('شناسهٔ پلن‌ها باید متفاوت باشد.');
  const termsText=$('ai-admin-terms').value.trim();
  if($('ai-admin-archive').checked&&!channelId)throw Error('برای روشن‌کردن آرشیو شناسهٔ عددی کانال را وارد کن.');
  if($('ai-admin-archive').checked&&termsText.length<80)throw Error('برای انتشار تصاویر، متن شرایط باید دست‌کم ۸۰ نویسه و توضیح روشن دربارهٔ نگهداری و احتمال انتشار تصویر داشته باشد.');
  if(!$('ai-admin-free').checked&&!confirm('حالت رایگان خاموش شود؟ از این پس برای ورود سکه کسر خواهد شد.'))return;
  busy=true;$('ai-admin-save').disabled=true;state('در حال بررسی مجوز کانال و ثبت قیمت‌ها…');
  await SimabWallet.read('admin_ai_studio_save',{enabled:$('ai-admin-enabled').checked,freeMode:$('ai-admin-free').checked,plans,channelId,termsText,archiveEnabled:$('ai-admin-archive').checked});
  state('✅ تنظیمات ذخیره شد.');await load();
 }catch(e){state(e.message);}finally{busy=false;$('ai-admin-save').disabled=false;}
};
SimabWallet.ready.then(()=>load()).catch(e=>state(e.message));
})();