const fail=(s:string):never=>{throw Error(s);};
const ok=(data:any,status=200)=>({status,data});
const packs=[10000,20000,50000,100000,500000];
const uuid=(s:any)=>typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(s);
const offerCode=(s:any)=>typeof s==='string'&&/^[a-f0-9]{32}$/.test(s);
export async function telegram(token:string,method:string,data:any={}){const r=await fetch('https://api.telegram.org/bot'+token+'/'+method,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(8500)});const body=await r.json();if(!r.ok||!body.ok)throw Error('telegram_'+(body.error_code||r.status));return body.result;}
async function rpc(db:any,name:string,p:any){const r=await db.rpc(name,p);if(r.error)throw Error(r.error.message);return r.data;}
async function settings(db:any){const r=await db.from('simab_shop_settings').select('*').eq('singleton',true).maybeSingle();if(r.error||!r.data)fail('shop_not_ready');return r.data;}
async function wallet(db:any,subject:string){return await rpc(db,'simab_secure_wallet_action',{p_subject:subject,p_action:'state',p_amount:0,p_request_id:null});}
const known=['shop_not_ready','invalid_pack','request_conflict','refund_review_required','invalid_payment','admin_only','invalid_price','invalid_expiry','offer_not_found','offer_no_reward','offer_expired','offer_exhausted','wallet_limit','invalid_channel','webhook_conflict','invalid_request','invalid_order','invalid_message'];
export async function shopAPI(db:any,subject:string,p:any,token:string,tg=telegram){
 try{
 if(p.action==='shop_catalog'){let s=await settings(db);if(s.enabled&&!s.webhook_bound){const bound=await shopAPI(db,'702007470',{action:'admin_bind_webhook'},token,tg);if(bound.status!==200)return ok({enabled:false,setupError:bound.data.error,currency:'XTR',packs:packs.map(coins=>({coins,stars:s.stars_per_unit?coins/10000*s.stars_per_unit:null})),wallet:await wallet(db,subject)});s=await settings(db);}return ok({enabled:s.enabled&&s.webhook_bound&&!!s.stars_per_unit,treasury:s.treasury,currency:'XTR',packs:packs.map(coins=>({coins,stars:s.stars_per_unit?coins/10000*s.stars_per_unit:null})),wallet:await wallet(db,subject)});}
 if(p.action==='purchase'){
  if(!uuid(p.requestId)||!packs.includes(p.coins))fail('invalid_pack');
  const order=await rpc(db,'simab_star_order_create',{p_subject:subject,p_coins:p.coins,p_id:p.requestId});
  if(order.status!=='pending'||new Date(order.expires_at)<=new Date())fail('invalid_order');
  let invoice=order.invoice_url;if(!invoice){invoice=await tg(token,'createInvoiceLink',{title:Number(order.coins).toLocaleString('fa-IR')+' سکه سیماب',description:'سکهٔ مجازی داخل سیماب؛ قابل برداشت نقدی نیست.',payload:'simab:'+order.id,currency:'XTR',provider_token:'',prices:[{label:'سکهٔ سیماب',amount:order.stars}]});if(typeof invoice!=='string'||!invoice.startsWith('https://t.me/'))fail('shop_not_ready');await rpc(db,'simab_star_invoice_set',{p_id:order.id,p_url:invoice});}
  return ok({orderId:order.id,invoiceUrl:invoice,coins:order.coins,stars:order.stars,wallet:await wallet(db,subject)});
 }
 if(p.action==='purchase_history'){const r=await db.from('simab_star_orders').select('id,coins,stars,status,created_at,unrecovered_coins,invoice_url,expires_at').eq('telegram_subject',subject).order('created_at',{ascending:false}).limit(30);if(r.error)fail('shop_not_ready');return ok({orders:r.data||[],wallet:await wallet(db,subject)});}
 if(p.action==='offer_info'||p.action==='offer_claim'){
  if(!offerCode(p.code))fail('offer_not_found');
  if(p.action==='offer_claim')return ok(await rpc(db,'simab_offer_claim',{p_subject:subject,p_code:p.code}));
  const r=await db.from('simab_offers').select('code,title,message,reward,max_claims,claims,expires_at').eq('code',p.code).maybeSingle();if(!r.data||r.error)fail('offer_not_found');return ok({offer:r.data});
 }
 const admin=await db.from('simab_admins').select('telegram_subject').eq('telegram_subject',subject).maybeSingle();if(subject!=='702007470'||admin.error||!admin.data)fail('admin_only');
 const save=(op:string,data:any)=>rpc(db,'simab_shop_admin',{p_admin:subject,p_op:op,p_data:data});
 if(p.action==='admin_shop_status'){
  const s=await settings(db),channels=await db.from('simab_bot_channels').select('chat_id,title,username,enabled').order('updated_at',{ascending:false}).limit(30),offers=await db.from('simab_offers').select('code,title,reward,claims,max_claims,expires_at').order('created_at',{ascending:false}).limit(20);
  const refunds=await db.from('simab_star_orders').select('id,telegram_subject,unrecovered_coins').gt('unrecovered_coins',0).order('created_at',{ascending:false}).limit(30);return ok({refunds:refunds.data||[],starsPerUnit:s.stars_per_unit,enabled:s.enabled,webhookBound:s.webhook_bound,treasury:s.treasury,channels:channels.data||[],offers:offers.data||[]});
 }
 if(p.action==='admin_reconcile_refund'){if(!uuid(p.orderId))fail('invalid_order');return ok(await save('reconcile_refund',{orderId:p.orderId}));}
 if(p.action==='admin_shop_settings'){if(!Number.isInteger(p.starsPerUnit)||p.starsPerUnit<1||p.starsPerUnit>10000||typeof p.enabled!=='boolean')fail('invalid_price');return ok(await save('settings',p));}
 if(p.action==='admin_bind_webhook'){
  const s=await settings(db),url='https://pwjlyryrrgbaprfnrieq.supabase.co/functions/v1/simab-central-quests?telegram_update=1',current=await tg(token,'getWebhookInfo');
  if(current.url&&current.url!==url)fail('webhook_conflict');
  await tg(token,'setWebhook',{url,secret_token:s.webhook_secret,allowed_updates:['message','pre_checkout_query','my_chat_member'],drop_pending_updates:false});
  const after=await tg(token,'getWebhookInfo');if(after.url!==url)fail('shop_not_ready');await save('webhook_bound',{bound:true});return ok({ok:true});
 }
 if(p.action==='admin_register_channel'){
  if(typeof p.channel!=='string'||!/^(@[A-Za-z0-9_]{5,32}|-100[0-9]{5,16})$/.test(p.channel))fail('invalid_channel');
  const chat=await tg(token,'getChat',{chat_id:p.channel}),bot=await tg(token,'getMe'),member=await tg(token,'getChatMember',{chat_id:chat.id,user_id:bot.id});
  if(chat.type!=='channel'||!['administrator','creator'].includes(member.status)||member.status==='administrator'&&!member.can_post_messages)fail('invalid_channel');
  return ok(await save('channel',{id:String(chat.id),title:chat.title||p.channel,username:chat.username||null,enabled:true}));
 }
 if(p.action==='admin_create_offer'){
  if(typeof p.title!=='string'||!p.title.trim()||p.title.length>100||typeof p.message!=='string'||!p.message.trim()||p.message.length>1500||!Number.isInteger(p.reward)||p.reward<0||p.reward>1000000||!Number.isInteger(p.maxClaims)||p.maxClaims<1||p.maxClaims>100000||!Number.isInteger(p.hours)||p.hours<1||p.hours>720)fail('invalid_message');
  return ok(await save('offer',p));
 }
 if(p.action==='admin_publish_offer'){
  if(!offerCode(p.code)||!Array.isArray(p.channels)||p.channels.length<1||p.channels.length>20)fail('invalid_request');
  const r=await db.from('simab_offers').select('code,title,message,reward,expires_at').eq('code',p.code).maybeSingle();if(r.error||!r.data)fail('offer_not_found');if(new Date(r.data.expires_at)<=new Date())fail('offer_expired');const offer=r.data,bot=await tg(token,'getMe'),results=[];
  for(const channel of [...new Set(p.channels)] as string[]){
   const c=await db.from('simab_bot_channels').select('chat_id,enabled').eq('chat_id',channel).eq('enabled',true).maybeSingle();if(!c.data){results.push({channel,status:'not_registered'});continue;}
   const reserved=await save('reserve_delivery',{code:p.code,channel});if(!reserved.reserved){results.push({channel,status:'already_attempted'});continue;}
   let status='unknown',messageId=null;try{const member=await tg(token,'getChatMember',{chat_id:channel,user_id:bot.id});if(!['administrator','creator'].includes(member.status)||member.status==='administrator'&&!member.can_post_messages){status='failed';}else{const sent=await tg(token,'sendMessage',{chat_id:channel,text:offer.message,link_preview_options:{is_disabled:true},reply_markup:{inline_keyboard:[[{text:offer.reward>0?'🎁 دریافت '+Number(offer.reward).toLocaleString('fa-IR')+' سکه':'🎮 ورود به سیماب',url:'https://t.me/'+bot.username+'?startapp='+(offer.reward>0?'o_'+p.code:'home')}]]}});status='sent';messageId=sent.message_id;}}catch(e){if((e as Error).message.startsWith('telegram_'))status='failed';}
   await save('delivery_result',{code:p.code,channel,status,messageId});results.push({channel,status,messageId});
  }return ok({results});
 }
 fail('invalid_request');
 }catch(e){const message=(e as Error).message;return ok({error:known.includes(message)?message:'shop_unavailable'},known.includes(message)?409:503);}
}
export async function shopWebhook(db:any,token:string,secret:string|null,p:any,tg=telegram){
 try{const s=await settings(db);let difference=0;const expected=s.webhook_secret||'';if(!secret||secret.length!==expected.length||expected.length<32)return ok({error:'webhook_auth_failed'},401);for(let i=0;i<expected.length;i++)difference|=expected.charCodeAt(i)^secret.charCodeAt(i);if(difference)return ok({error:'webhook_auth_failed'},401);
 if(p.pre_checkout_query){const q=p.pre_checkout_query,id=typeof q.invoice_payload==='string'?q.invoice_payload.replace(/^simab:/,''):'';let valid=false;if(uuid(id)){const r=await db.from('simab_star_orders').select('telegram_subject,stars,status,expires_at').eq('id',id).maybeSingle();const o=r.data;valid=!!o&&s.enabled&&s.webhook_bound&&q.currency==='XTR'&&o.telegram_subject===String(q.from.id)&&o.stars===q.total_amount&&o.status==='pending'&&new Date(o.expires_at)>new Date();}await tg(token,'answerPreCheckoutQuery',{pre_checkout_query_id:q.id,ok:valid,...(!valid?{error_message:'سفارش معتبر یا فعال نیست؛ دوباره از کیف پول سیماب شروع کن.'}:{})});return ok({ok:true});}
 const payment=p.message?.successful_payment||p.message?.refunded_payment;
 if(payment){const id=typeof payment.invoice_payload==='string'?payment.invoice_payload.replace(/^simab:/,''):'';if(!uuid(id)||payment.currency!=='XTR'||!Number.isInteger(payment.total_amount)||typeof payment.telegram_payment_charge_id!=='string')fail('invalid_payment');const payer=await db.from('simab_star_orders').select('telegram_subject').eq('id',id).maybeSingle();if(!payer.data||!p.message.refunded_payment&&payer.data.telegram_subject!==String(p.message?.from?.id))fail('invalid_payment');const subject=payer.data.telegram_subject,charge=payment.telegram_payment_charge_id;let result;try{result=await rpc(db,'simab_star_payment',{p_subject:subject,p_id:id,p_charge:charge,p_stars:payment.total_amount,p_refund:!!p.message.refunded_payment});}catch(e){if((e as Error).message!=='wallet_limit')throw e;result={needsRefund:true};}if(result.needsRefund){await tg(token,'refundStarPayment',{user_id:Number(subject),telegram_payment_charge_id:charge});await rpc(db,'simab_star_payment',{p_subject:subject,p_id:id,p_charge:charge,p_stars:payment.total_amount,p_refund:true});}return ok({ok:true});}
 if(p.my_chat_member?.chat?.type==='channel'){const chat=p.my_chat_member.chat,role=p.my_chat_member.new_chat_member;await rpc(db,'simab_channel_update',{p_chat:String(chat.id),p_title:chat.title||'کانال',p_username:chat.username||null,p_enabled:['administrator','creator'].includes(role?.status)&&(role.status==='creator'||!!role.can_post_messages)});}
 if(p.message?.text?.split(' ')[0]==='/paysupport')await tg(token,'sendMessage',{chat_id:p.message.chat.id,text:'برای پشتیبانی خرید سکهٔ سیماب، شناسه سفارش را از کیف پول بردار و برای @Alihosseiniv بفرست. اطلاعات محرمانهٔ کیف پول و عبارت بازیابی را ارسال نکن.'});
 return ok({ok:true});
 }catch{return ok({error:'webhook_processing_failed'},503);}
}
const balanceCache=new Map<string,{nano:string;at:number}>();
export function tonRaw(address:any){if(typeof address!=='string')fail('invalid_address');if(/^(0|-1):[a-f0-9]{64}$/i.test(address))return address.toLowerCase();if(!/^[A-Za-z0-9_-]{48}$/.test(address))fail('invalid_address');const b=Uint8Array.from(atob(address.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));let crc=0;for(const n of b.slice(0,34)){crc^=n<<8;for(let i=0;i<8;i++)crc=crc&0x8000?(crc<<1)^0x1021:crc<<1;crc&=65535;}if(crc!==b[34]*256+b[35]||b[0]&128||![17,81].includes(b[0])||![0,255].includes(b[1]))fail('invalid_address');return(b[1]===255?'-1':'0')+':'+[...b.slice(2,34)].map(n=>n.toString(16).padStart(2,'0')).join('');}
export async function tonBalance(address:any,key='',fetcher=fetch){try{const raw=tonRaw(address),saved=balanceCache.get(raw);if(saved&&Date.now()-saved.at<30000)return ok({balanceNano:saved.nano,asOf:saved.at,network:'mainnet'});const r=await fetcher('https://toncenter.com/api/v2/getAddressBalance?address='+encodeURIComponent(raw),{headers:key?{'X-API-Key':key}:{},signal:AbortSignal.timeout(6000)});const data=await r.json();if(!r.ok||!data.ok||!/^\d+$/.test(data.result))fail('balance_unavailable');const at=Date.now();if(balanceCache.size>1000)balanceCache.clear();balanceCache.set(raw,{nano:data.result,at});return ok({balanceNano:data.result,asOf:at,network:'mainnet'});}catch{return ok({error:'balance_unavailable'},503);}}
