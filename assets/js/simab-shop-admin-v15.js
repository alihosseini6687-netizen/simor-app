(()=>{'use strict';const $=id=>document.getElementById(id);let busy=false,webhookInfo=null;const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const uiText=(key,fallback,values={})=>window.SimabI18n?.key?window.SimabI18n.key(key,values):fallback;
const setUI=(element,key,fallback,values={})=>window.SimabI18n?.bind?window.SimabI18n.bind(element,key,values):(element.textContent=fallback,element);
const uiNode=(key,fallback,values={})=>setUI(node('span'),key,fallback,values);
const userNode=text=>{const n=node('span',text);n.setAttribute('data-user-content','');return n;};
const replaceUI=(element,...children)=>{if(window.SimabI18n?.bindSource)window.SimabI18n.bindSource(element,'');else delete element.dataset.i18n;element.replaceChildren(...children);};
async function call(action,data={}){return SimabWallet.read(action,data);}
async function run(fn){if(busy)return;busy=true;document.querySelectorAll('[data-shop-admin]').forEach(b=>b.disabled=true);try{await fn();}catch(e){$('shop-admin-message').textContent=e.message;}finally{busy=false;document.querySelectorAll('[data-shop-admin]').forEach(b=>b.disabled=false);}}
async function refresh(selected){
 const r=await call('admin_shop_status');webhookInfo=r;
 $('shop-webhook-replace').hidden=!r.webhookConflict;
 if(r.webhookConflict)setUI($('shop-webhook-host'),'admin.webhookConflict','اتصال فعلی ربات: '+r.webhookHost+'؛ با جایگزینی، سرویس قبلی دیگر پیام‌های ربات را دریافت نمی‌کند.',{host:r.webhookHost});
 else setUI($('shop-webhook-host'),'admin.noExternal','اتصال خارجی دیگری شناسایی نشد.');
 $('stars-unit').value=r.starsPerUnit||'';$('shop-enabled').checked=r.enabled;
 replaceUI($('shop-setup-status'),uiNode(r.webhookBound?'admin.connectionReady':'admin.connectionNotReady',r.webhookBound?'✓ اتصال دریافت پرداخت آماده است.':'اتصال دریافت پرداخت هنوز آماده نیست.'),' ',uiNode(r.enabled?'admin.salesOn':'admin.salesOff',r.enabled?'فروش روشن است.':'فروش خاموش است.'));
 $('merchant-address').textContent=r.treasury;$('refund-review').replaceChildren();
 for(const order of r.refunds||[]){
  const row=node('div');row.className='purchase-order';
  const values={subject:order.telegram_subject,number:Number(order.unrecovered_coins).toLocaleString(window.SimabI18n?.locale||'fa-IR')};
  const label=node('span',uiText('admin.refundReviewRow','بازپرداخت نیازمند بررسی • آیدی '+values.subject+' • '+values.number+' سکه',values));
  window.SimabI18n?.bind?.(label,'admin.refundReviewRow',values);row.append(label);
  const reconcile=node('button',uiText('admin.reconcileRefund','تسویهٔ مانده از سکهٔ موجود'));reconcile.onclick=()=>run(async()=>{
   if(!confirm(uiText('confirm.reconcileRefund','ماندهٔ سکهٔ خرید برگشتی از موجودی همین کاربر کسر شود؟')))return;
   const x=await call('admin_reconcile_refund',{orderId:order.id});
   $('shop-admin-message').textContent=uiText('admin.refundRemaining','ماندهٔ نیازمند بررسی: '+x.remaining+' سکه',{number:x.remaining});await refresh();
  });row.append(reconcile);$('refund-review').append(row);
 }
 replaceUI($('shop-channels'));
 for(const channel of r.channels){
  const row=node('label');row.className='channel-choice';const check=node('input');check.type='checkbox';check.value=channel.chat_id;check.disabled=!channel.enabled;
  const title=userNode(channel.title+(channel.username?' • @'+channel.username:''));
  row.append(check,title);$('shop-channels').append(row);
 }
 if(!r.channels.length)setUI($('shop-channels'),'admin.registerFirst','ابتدا کانال‌هایی را که ربات در آن‌ها مدیر است ثبت کن.');
 const picker=$('offer-picker');picker.replaceChildren(setUI(node('option'),'admin.chooseOffer','یک آفر را انتخاب کن'));picker.firstChild.value='';
 for(const offer of r.offers){
  const opt=node('option',offer.title+' • '+offer.claims+'/'+offer.max_claims+' دریافت');
  window.SimabI18n?.bind?.(opt,'admin.offerOption',{title:offer.title,count:offer.claims,total:offer.max_claims});
  opt.value=offer.code;picker.append(opt);
 }
 if(selected)picker.value=selected;
}
$('shop-settings-save').onclick=()=>run(async()=>{await call('admin_shop_settings',{starsPerUnit:SimabWallet.integer($('stars-unit').value),enabled:$('shop-enabled').checked});setUI($('shop-admin-message'),'admin.settingsSaved','تنظیم قیمت و وضعیت فروش ثبت شد.');await refresh();});
$('shop-webhook-bind').onclick=()=>run(async()=>{if(!confirm(uiText('confirm.bindPayments','دریافت پرداخت‌ها و تغییرات مدیریت کانال به سیماب متصل شود؟ اتصال خارجی موجود خودکار جایگزین نمی‌شود.')))return;await call('admin_bind_webhook');setUI($('shop-admin-message'),'admin.paymentsBound','اتصال دریافت پرداخت و کانال‌ها ثبت شد.');await refresh();});
$('shop-webhook-replace').onclick=()=>run(async()=>{
 if(!webhookInfo?.webhookConflict)return;
 if(!confirm(uiText('confirm.replaceWebhook','اتصال دریافت پیام ربات از '+webhookInfo.webhookHost+' به سیماب منتقل شود؟ سرویس قبلی دیگر پیام‌های ربات را دریافت نمی‌کند. شروع، پشتیبانی، پرداخت و ثبت کانال از این پس در سیماب انجام می‌شود.',{host:webhookInfo.webhookHost})))return;
 await call('admin_bind_webhook',{replaceExisting:true,expectedWebhookFingerprint:webhookInfo.webhookFingerprint});
 setUI($('shop-admin-message'),'admin.webhookReplaced','دریافت پیام و پرداخت Stars به سیماب متصل شد؛ حالا خرید را از کیف پول تست کن.');await refresh();
});
$('channel-register').onclick=()=>run(async()=>{await call('admin_register_channel',{channel:$('channel-id').value.trim()});$('shop-admin-message').textContent=uiText('admin.channelRegistered','کانال بررسی و ثبت شد.');await refresh();});
$('offer-create').onclick=()=>run(async()=>{
 const title=$('offer-title').value.trim(),message=$('offer-message').value.trim(),reward=$('offer-reward').value.trim()==='0'?0:SimabWallet.integer($('offer-reward').value),maxClaims=SimabWallet.integer($('offer-capacity').value),hours=SimabWallet.integer($('offer-hours').value);
 const r=await call('admin_create_offer',{title,message,reward,maxClaims,hours});
 replaceUI($('offer-preview'),userNode(title),'\n',userNode(message),'\n',
  uiNode('admin.offerPreviewReward','پاداش هر نفر: '+reward.toLocaleString('fa-IR')+' سکه',{number:reward}),' • ',
  uiNode('admin.offerPreviewCapacity','ظرفیت '+maxClaims.toLocaleString('fa-IR')+' نفر',{number:maxClaims}),' • ',
  uiNode('admin.offerPreviewHours',hours+' ساعت',{number:hours}),'\n',
  uiNode('admin.offerPreviewCap','سقف کل پاداش: '+(reward*maxClaims).toLocaleString('fa-IR')+' سکه',{number:reward*maxClaims}));
 setUI($('shop-admin-message'),'admin.offerCreated','آفر ساخته شد؛ هنوز پیامی به کانال‌ها ارسال نشده است.');await refresh(r.code);
});
$('channels-select-all').onclick=()=>document.querySelectorAll('#shop-channels input:not(:disabled)').forEach(c=>c.checked=true);
$('offer-publish').onclick=()=>run(async()=>{
 const code=$('offer-picker').value,channels=[...document.querySelectorAll('#shop-channels input:checked')].map(c=>c.value);
 if(!code||!channels.length)throw Error(uiText('error.offerSelection','یک آفر و حداقل یک کانال را انتخاب کن.'));
 if(!confirm(uiText('confirm.publishOffer','همین آفر در '+channels.length+' کانال انتخاب‌شده منتشر شود؟',{number:channels.length})))return;
 const r=await call('admin_publish_offer',{code,channels}),keys={sent:'admin.publishSent',already_attempted:'admin.publishAlreadyAttempted',failed:'admin.publishFailed',unknown:'admin.publishUnknown',not_registered:'admin.publishNotRegistered'},labels={sent:'ارسال شد',already_attempted:'قبلاً تلاش شده؛ تکرار خودکار ندارد',failed:'ارسال نشد؛ اجازهٔ ربات را بررسی کن',unknown:'نتیجه نامشخص؛ قبل از تلاش تازه کانال را بررسی کن',not_registered:'کانال ثبت نشده'};
 const lines=[];for(const x of r.results){if(lines.length)lines.push('\n');const row=node('span');row.append(userNode(x.channel),': ',keys[x.status]?uiNode(keys[x.status],labels[x.status]):node('span',String(x.status)));lines.push(row);}
 replaceUI($('shop-admin-message'),...lines);
});
$('shop-admin-refresh').onclick=()=>run(()=>refresh());SimabWallet.ready.then(()=>refresh()).catch(e=>$('shop-admin-message').textContent=e.message);
})();
