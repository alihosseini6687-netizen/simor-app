/* SIMAB verified server wallet (isolated from localStorage and Telegram CloudStorage).
 * All mutations require signed Telegram initData. No client RNG or balance accepted.
 */
(() => {
"use strict";
const endpoint="https://pwjlyryrrgbaprfnrieq.supabase.co/functions/v1/simab-central-quests";
const $=id=>document.getElementById(id);
const fmt=n=>Number(n||0).toLocaleString("fa-IR");
const names={daily:"پاداش روزانه",wheel:"گردونه روزانه",miner_start:"شروع ماینر",
  miner_claim:"برداشت ماینر",exchange_to_chips:"تبدیل سکه به ژتون",
  exchange_to_coins:"تبدیل ژتون به سکه",slot:"رولر امن",verified_quest:"مأموریت کانال"};
const symbols=["🍒","💎","🔔","7️⃣","⭐","👑"];
const actions=new Set(["daily","wheel","miner_start","miner_claim","exchange_to_chips","exchange_to_coins","slot"]);
let lastState=null, busy=false;
function show(message,isError=false) {
  const node=$("wallet-message");if(!node)return;
  node.textContent=message;
  node.style.color=isError?"#ffc1c1":"#f9d682";
}
function signedCandidates(){
  const direct=window.Telegram?.WebApp?.initData||"";
  let saved="";try {saved=sessionStorage.getItem("simab_signed_launch_init_data_v1")||""}catch{}
  const valid=raw=>{
    try {
      const q=new URLSearchParams(raw),ts=Number(q.get("auth_date"));
      const age=Math.floor(Date.now()/1000)-ts;
      return !!q.get("user") && !!q.get("hash") && Number.isSafeInteger(ts) &&
        age>=-30 && age<=3600;
    }catch {return false}
  };
  return [...new Set([direct,saved])].filter(valid);
}
const pendingKey="simab_secure_wallet_pending_v1";
function getPending(){
  try {const x=JSON.parse(sessionStorage.getItem(pendingKey)||"null");
    if(x&&actions.has(x.walletAction)&&typeof x.requestId==="string")return x;
  }catch{}return null;
}
function storePending(x){try{sessionStorage.setItem(pendingKey,JSON.stringify(x));}catch{}}
function clearPending(){try{sessionStorage.removeItem(pendingKey);}catch{}}
async function api(action,extra={}){
  const c=signedCandidates();
  if(!c.length)throw Error("ورود معتبر تلگرام پیدا نشد. برنامه را از دکمه ربات اصلی باز کن.");
  let res=null,body=null;
  for(let i=0;i<c.length;i++){
    res=await fetch(endpoint,{method:"POST",cache:"no-store",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({initData:c[i],action,...extra})});
    body=await res.json().catch(()=>({}));
    if(res.ok||res.status!==401||body.reason!=="signature_mismatch")break;
  }
  if(!res.ok){
    if(res.status===401)throw Error("امضای تلگرام معتبر نیست یا منقضی شده؛ سیماب را از ربات دوباره باز کن.");
    if(body.error==="insufficient_coins")throw Error("سکه تأییدشده کافی نیست.");
    if(body.error==="insufficient_chips")throw Error("ژتون تأییدشده کافی نیست.");
    if(body.error==="wallet_unavailable")throw Error("کیف پول سروری هنوز آماده نیست؛ SQL و انتشار تابع را بررسی کن.");
    throw Error("سرور درخواست را نپذیرفت ("+(body.error||res.status)+"). هیچ اعتبار محلی جایگزین نشد.");
  }
  return body;
}
async function wallet(a,amount=0,requestId=null){
  return api("wallet",{walletAction:a,amount,...(requestId?{requestId}:{})});
}
function paint(s){
  lastState=s;
  $("secure-coins").textContent=fmt(s.coins);
  $("secure-chips").textContent=fmt(s.chips);
  $("secure-streak").textContent=fmt(s.streakDay);
  $("daily-btn").disabled=!s.dailyAvailable;
  $("daily-btn").textContent=s.dailyAvailable?"🎁 دریافت پاداش روزانه":"✓ جایزه امروز گرفته شد";
  $("wheel-btn").disabled=!s.wheelAvailable;
  $("wheel-btn").textContent=s.wheelAvailable?"🎡 گردونه رایگان امروز":"✓ گردونه امروز انجام شد";
  const ready=s.minerReadyAt?new Date(s.minerReadyAt):null;
  const now=Date.now();
  const minerReady=ready&&now>=ready.getTime();
  $("miner-btn").textContent=!ready?"⚡ روشن کردن ماینر":minerReady?"⛏ دریافت ۴ سکه":"⏳ زمان برداشت هنوز نرسیده";
  $("miner-btn").dataset.secureAction = ready ? "miner_claim" : "miner_start";
  $("miner-btn").disabled=!!ready&&!minerReady;
  $("miner-info").textContent=!ready?"ماینر باید یک بار روشن شود؛ پس از ۸ ساعت برداشت فعال می‌شود.":
    minerReady?"برداشت آماده است. پس از برداشت، دوره ۸ ساعته بعدی خودکار شروع می‌شود.":
    "آماده برداشت از: "+ready.toLocaleString("fa-IR");
  $("secure-server-date").textContent=s.serverUtcDate||"—";
}
function setBusy(flag){
  busy=flag;
  for(const el of document.querySelectorAll("button[data-secure-action]"))el.disabled=flag;
  if(!flag&&lastState)paint(lastState);
}
async function history(){
  const target=$("wallet-events");
  try{
    const r=await api("wallet_history");
    target.replaceChildren();
    if(!r.events?.length){target.textContent="تراکنش ثبت‌شده‌ای وجود ندارد.";return;}
    for(const e of r.events){
      const row=document.createElement("div");row.className="wallet-event";
      const description=document.createElement("strong");description.textContent=names[e.action]||e.action;
      const amount=document.createElement("span");
      const parts=[];
      if(Number(e.coin_delta))parts.push((e.coin_delta>0?"+":"")+fmt(e.coin_delta)+" 🪙");
      if(Number(e.chip_delta))parts.push((e.chip_delta>0?"+":"")+fmt(e.chip_delta)+" 🎟");
      amount.textContent=parts.join(" / ")||"ثبت فعالیت";
      const time=document.createElement("small");time.textContent=new Date(e.created_at).toLocaleString("fa-IR");
      row.append(description,amount,time);target.append(row);
    }
  }catch(error){target.textContent="تاریخچه در دسترس نیست: "+error.message;}
}
async function refresh(){
  if(busy)return;
  try{setBusy(true);show("در حال دریافت موجودی تأییدشده از سرور...");
    const s=await wallet("state");paint(s);
    show("اتصال امن برقرار است. این موجودی از مرورگر دریافت نمی‌شود.");
    await history();
    const p=getPending();
    if(p)show("⚠️ یک درخواست قبلی پاسخ قطعی نداشت؛ برای جلوگیری از دریافت یا کسر تکراری همان درخواست را بازیابی کن.",true);
  }catch(err){show(err.message,true);}
  finally{setBusy(false);}
}
async function mutate(walletAction){
  if(busy)return;
  let amount=0;
  if(["exchange_to_coins","exchange_to_chips","slot"].includes(walletAction)){
    amount=Number($(walletAction==="slot"?"slot-stake":"exchange-amount").value);
    if(!Number.isSafeInteger(amount)||amount<1||amount>(walletAction==="slot"?50:1000)){
      show("مبلغ باید عدد صحیح مثبت و در محدوده مجاز باشد.",true);return;
    }
  }
  const waiting=getPending();
  if(waiting&&(waiting.walletAction!==walletAction||waiting.amount!==amount)){
    show("درخواست قبلی در انتظار تعیین تکلیف است. ابتدا دکمه «بازیابی درخواست» را بزن.",true);return;
  }
  if(!globalThis.crypto?.randomUUID){show("این مرورگر امکان ساخت شناسه امن درخواست ندارد.",true);return;}
  const request=waiting||{walletAction,amount,requestId:crypto.randomUUID()};
  storePending(request);
  await execute(request);
}
async function execute(request){
  if(busy)return;
  setBusy(true);
  try{
    show("در حال ثبت امن درخواست در سرور...");
    const s=await wallet(request.walletAction,request.amount,request.requestId);
    clearPending();paint(s);
    if(s.duplicate)show("این درخواست قبلاً ثبت شده بود؛ دوباره سکه‌ای اضافه یا کم نشد.");
    else if(s.result?.alreadyClaimed)show("پاداش امروز قبلاً دریافت شده است.");
    else if(s.result?.alreadySpun)show("گردونه امروز قبلاً انجام شده است.");
    else if(s.result?.minerNotReady)show("هنوز دوره ۸ ساعته ماینر تمام نشده است.");
    else if(s.result?.minerAlreadyStarted)show("ماینر قبلاً روشن شده است.");
    else if(request.walletAction==="slot"&&Array.isArray(s.result?.reels)){
      $("slot-reels").textContent=s.result.reels.map(i=>symbols[i]||"❔").join("  ");
      show("شرط "+fmt(s.result.bet)+" ژتون؛ جایزه "+fmt(s.result.payout)+" ژتون. نتیجه فقط در سرور محاسبه شد.");
    }
    else show("عملیات سروری ثبت شد؛ تغییر سکه: "+fmt(s.rewardCoins)+"، تغییر ژتون: "+fmt(s.chipDelta));
    await history();
  }catch(error){
    // Keep EXACT request id for safe retry if response was lost.
    show(error.message+" برای اطمینان از عدم دوباره‌کاری، از «بازیابی درخواست» استفاده کن.",true);
  }finally{setBusy(false);}
}
function wire(){
  try{window.Telegram?.WebApp?.ready();window.Telegram?.WebApp?.expand()}catch{}
  for(const button of document.querySelectorAll("[data-secure-action]")){
    button.addEventListener("click",()=>mutate(button.dataset.secureAction));
  }
  $("wallet-refresh").addEventListener("click",refresh);
  $("wallet-retry").addEventListener("click",async()=>{
    const old=getPending();if(!old){show("درخواست ناتمامی وجود ندارد.");return;}
    await execute(old);
  });
  refresh();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",wire);
else wire();
})();
