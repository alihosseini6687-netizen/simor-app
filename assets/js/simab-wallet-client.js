/* The only active coin/chip client. Balances are always read from the server. */
(()=>{'use strict';
 const endpoint='https://pwjlyryrrgbaprfnrieq.supabase.co/functions/v1/simab-central-quests';
 let state=null,inFlight=false,epoch=0,pending=null,pendingKey='',readyResolve;
 const listeners=new Set();
 function accountLabel(){for(const n of document.querySelectorAll('[data-wallet-account]'))n.textContent=actor()?'آیدی تلگرام: '+actor():'ورود از تلگرام لازم است';}
 const ready=new Promise(r=>{readyResolve=r;});
 const errors={miner_not_ready:'هنوز یک سکه برای برداشت آماده نشده است.',miner_tank_full:'مخزن همین حالا پر است.',miner_not_owned:'ابتدا یک ماینر تهیه کن.',invalid_miner_tier:'این سطح قابل خرید یا ارتقا نیست.',telegram_auth_failed:'ورود معتبر نیست؛ سیماب را کامل ببند و از ربات دوباره باز کن.',insufficient_coins:'سکه کافی نیست.',insufficient_chips:'ژتون کافی نیست؛ ابتدا در صرافی ژتون بخر.',wallet_limit:'این مبلغ از سقف موجودی بیشتر می‌شود.',slot_cooldown:'بین دو چرخش حداقل ۲ ثانیه صبر کن.',stale_game:'وضعیت میز در دستگاه دیگری تغییر کرده؛ میز به‌روزرسانی شد.',active_game_exists:'یک دست باز داری؛ ابتدا آن را ادامه بده.',request_conflict:'مشخصات درخواست با درخواست قبلی یکسان نیست.',game_finished:'این دست قبلاً تمام شده است.',raise_too_small:'مبلغ افزایش کمتر از حداقل مجاز است.',invalid_raise:'مبلغ افزایش معتبر نیست.',raise_not_reopened:'در این نوبت امکان افزایش دوباره وجود ندارد.',cannot_check:'برای ادامه باید کال یا فولد کنی.',invalid_move:'این حرکت مجاز نیست.',invalid_amount:'مبلغ باید عدد صحیح مثبت در محدوده مجاز باشد.',invalid_buyin:'ورودی میز معتبر نیست.',game_unavailable:'پاسخ قطعی بازی از سرور نرسید.',wallet_unavailable:'کیف پول در دسترس نیست.'};
 function candidates(){let saved='';try{saved=sessionStorage.getItem('simab_signed_launch_init_data_v1')||'';}catch{}
  const direct=window.Telegram?.WebApp?.initData||'';
  return [...new Set([direct,saved])].filter(raw=>{try{const q=new URLSearchParams(raw),ts=Number(q.get('auth_date')),age=Date.now()/1000-ts;return q.get('user')&&q.get('hash')&&Number.isSafeInteger(ts)&&age>=-30&&age<=3600;}catch{return false;}});
 }
 function actor(){try{return String(JSON.parse(new URLSearchParams(candidates()[0]).get('user')).id);}catch{return '';}}
 function message(text){for(const n of document.querySelectorAll('[data-wallet-status]'))n.textContent=text;}
 function paint(s){if(!s||s.serverWallet!==true||!Number.isSafeInteger(s.coins)||!Number.isSafeInteger(s.chips))throw Error('پاسخ موجودی معتبر نیست.');state=s;accountLabel();
  for(const n of document.querySelectorAll('[data-coins]'))n.textContent=s.coins.toLocaleString('fa-IR');
  for(const n of document.querySelectorAll('[data-chips]'))n.textContent=s.chips.toLocaleString('fa-IR');
  for(const fn of listeners){try{fn(s);}catch(e){console.error('wallet view failed',e);}}
  window.dispatchEvent(new CustomEvent('simab-wallet',{detail:s}));
 }
 // AbortSignal.timeout and crypto.randomUUID are absent in older iOS WebViews.
 function requestId(){
  const secure=globalThis.crypto;
  if(typeof secure?.randomUUID==='function')return secure.randomUUID();
  if(typeof secure?.getRandomValues!=='function')throw Error('ساخت شناسهٔ امن ممکن نیست؛ تلگرام را به‌روز کن.');
  const bytes=new Uint8Array(16);secure.getRandomValues(bytes);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
 }
 async function send(payload){
  const controller=typeof AbortController==='function'?new AbortController():null;
  let timer;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller?.abort();reject(Error('زمان اتصال تمام شد؛ دوباره تلاش کن. درخواست قبلی با همان کد پیگیری بررسی می‌شود.'));},20000);});
  try{return await Promise.race([
   (async()=>{const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},cache:'no-store',body:JSON.stringify(payload),...(controller?{signal:controller.signal}:{})});
    const body=await response.json().catch(()=>({}));return {response,body};})(),timeout
  ]);}finally{clearTimeout(timer);}
 }
 async function api(payload){const inputs=candidates();if(!inputs.length)throw Error('سیماب را از دکمهٔ ربات در تلگرام باز کن.');
  let response,body;for(const initData of inputs){({response,body}=await send({...payload,initData}));if(response.ok||response.status!==401||body.reason!=='signature_mismatch')break;}
  if(!response.ok){const e=Error(errors[body.error]||'درخواست تأیید نشد ('+(body.error||response.status)+').');e.code=body.error;e.definitive=[400,401,403,404,409,413].includes(response.status);throw e;}return body;
 }
 function pendingUI(){const b=document.getElementById('wallet-recover');if(b)b.hidden=!pending;}
 function clear(){localStorage.removeItem(pendingKey);pending=null;pendingUI();}
 async function read(action,extra={}){const seq=epoch,r=await api({action,...extra});if(r.wallet&&seq===epoch&&!inFlight)paint(r.wallet);return r;}
 async function refresh(){const seq=++epoch;try{const s=await api({action:'wallet',walletAction:'state'});if(seq===epoch){paint(s);if(!pending)message('موجودی مشترک سیماب');}return s;}catch(e){if(seq===epoch){message(e.message);if(!state)for(const n of document.querySelectorAll('[data-coins],[data-chips]'))n.textContent='—';}throw e;}}
 async function recover(){if(inFlight)throw Error('یک درخواست در حال پردازش است.');if(!pending)return null;
  if(pending.actorId&&actor()!==pending.actorId)throw Error('برای پیگیری این تراکنش با همان حساب تلگرام وارد شو.');
  inFlight=true;++epoch;message('در حال بررسی تراکنش…');try{const response=await api(pending);const s=response.wallet||response;if(pending.action==='game'&&(!response.sessionId||!Number.isSafeInteger(response.version)||response.state?.kind!==pending.game))throw Error('پاسخ بازی قابل تأیید نیست؛ همان درخواست را پیگیری کن.');paint(s);clear();message('تراکنش ثبت شد.');window.dispatchEvent(new CustomEvent('simab-receipt',{detail:response}));return response;}
  catch(e){if(e.definitive){try{clear();}catch{}}message(e.message+(pending?' درخواست محفوظ است؛ «پیگیری» را بزن.':''));throw e;}
  finally{inFlight=false;pendingUI();}
 }
 async function mutate(action,extra={}){await ready;if(inFlight)throw Error('یک درخواست در حال پردازش است.');if(pending)throw Error('یک درخواست پاسخ قطعی ندارد؛ اول دکمهٔ پیگیری را بزن.');
  const id=actor();if(!id)throw Error('ورود تلگرام پیدا نشد.');pendingKey='simab_financial_pending_v2:'+id;
  const stored=localStorage.getItem(pendingKey);if(stored){pending=JSON.parse(stored);pendingUI();throw Error('درخواست قبلی در همین حساب باز است؛ ابتدا آن را پیگیری کن.');}
  const request={action,...extra,actorId:id,requestId:requestId()};
  try{localStorage.setItem(pendingKey,JSON.stringify(request));}catch{throw Error('ذخیرهٔ کد پیگیری ممکن نیست؛ تراکنشی ارسال نشد.');}
  pending=request;pendingUI();return recover();
 }
 function subscribe(fn){listeners.add(fn);if(state)fn(state);return()=>listeners.delete(fn);}
 function integer(value){const v=String(value).trim().replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)));if(!/^\d+$/.test(v)||!Number.isSafeInteger(Number(v))||Number(v)<1)throw Error('یک عدد صحیح مثبت وارد کن.');return Number(v);}
 window.SimabWallet=Object.freeze({ready,read,refresh,mutate,recover,subscribe,integer,requestId,get state(){return state;},get busy(){return inFlight;},get pending(){return pending;}});
 async function init(){
  const box=document.createElement('div');box.id='simab-connection';box.innerHTML='<small data-wallet-account></small><span style="margin:0 8px">• v11</span><span data-wallet-status>در حال دریافت موجودی…</span><button type="button" id="wallet-recover" hidden>پیگیری تراکنش قبلی</button>';
  box.style.cssText='position:relative;z-index:20;padding:8px 12px;font:11px system-ui;text-align:center;color:#cfb989;line-height:1.7;background:#0d0b12;';
  document.body.append(box);document.getElementById('wallet-recover').onclick=()=>recover().catch(()=>{});
  accountLabel();
  try{const id=actor();if(id){pendingKey='simab_financial_pending_v2:'+id;const raw=localStorage.getItem(pendingKey);if(raw){const x=JSON.parse(raw);if(x&&typeof x.requestId==='string'&&['wallet','game'].includes(x.action))pending=x;else throw Error('درخواست ذخیره‌شده نامعتبر است.');}}pendingUI();await refresh();if(pending)await recover();}
  catch(e){message(e.message+(pending?'؛ درخواست قبلی محفوظ است.':''));}finally{readyResolve(state);}
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!inFlight)refresh().catch(()=>{});});
  window.addEventListener('pageshow',()=>{if(!inFlight)refresh().catch(()=>{});});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
