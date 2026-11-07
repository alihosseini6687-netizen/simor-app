// Perchance is an external public generator, not a Mango-operated image API.
// Archive only images that a signed user deliberately uploads after consent.
const fail=(code:string):never=>{throw Error(code);};
const uuid=(s:any)=>typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(s);
const owner='702007470';
const known=['ai_disabled','invalid_ai_plan','invalid_request','insufficient_coins','request_conflict','archive_not_ready','archive_rate_limited','archive_daily_limit','ai_pass_required','invalid_ai_image','invalid_ai_consent','invalid_channel','admin_only'];
async function rpc(db:any,name:string,args:any){const r=await db.rpc(name,args);if(r.error)throw Error(r.error.message);return r.data;}
async function settings(db:any){const r=await db.from('simab_ai_settings').select('*').eq('singleton',true).maybeSingle();if(r.error||!r.data)fail('ai_unavailable');return r.data;}
async function isAdmin(db:any,subject:string){if(subject!==owner)fail('admin_only');const r=await db.from('simab_admins').select('telegram_subject').eq('telegram_subject',subject).maybeSingle();if(r.error||!r.data)fail('admin_only');}
async function tg(token:string,method:string,body:any){const r=await fetch('https://api.telegram.org/bot'+token+'/'+method,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(8500)});const j=await r.json();if(!r.ok||j?.ok!==true)fail('telegram_unavailable');return j.result;}
function cleanPlans(value:any){if(!Array.isArray(value)||value.length<1||value.length>5)fail('invalid_ai_plan');const ids=new Set();return value.map((p:any)=>{if(!p||typeof p!=='object'||Array.isArray(p)||typeof p.id!=='string'||!/^[a-z0-9_-]{1,24}$/.test(p.id)||ids.has(p.id)||!Number.isInteger(p.coins)||p.coins<1||p.coins>10000||!Number.isInteger(p.minutes)||p.minutes<1||p.minutes>180)fail('invalid_ai_plan');ids.add(p.id);return{id:p.id,coins:p.coins,minutes:p.minutes};});}
export async function aiStudioAPI(db:any,subject:string,p:any,botToken:string){
 try{
  const action=p.action;
  if(action==='ai_studio_state'){
   const cfg=await settings(db);
   const wallet=await rpc(db,'simab_secure_wallet_action',{p_subject:subject,p_action:'state',p_amount:0,p_request_id:null});
   let expiresAt=null;
   if(!cfg.free_mode){const r=await db.from('simab_ai_access_passes').select('expires_at').eq('telegram_subject',subject).gt('expires_at',new Date().toISOString()).order('expires_at',{ascending:false}).limit(1);if(r.error)fail('ai_unavailable');expiresAt=r.data?.[0]?.expires_at||null;}
   return{status:200,data:{enabled:cfg.enabled,freeMode:cfg.free_mode,plans:cfg.plans,termsText:cfg.terms_text||'',archiveReady:cfg.archive_enabled&&!!cfg.archive_channel_id&&(cfg.terms_text||'').trim().length>=80,active:cfg.enabled&&(cfg.free_mode||!!expiresAt),expiresAt,wallet}};
  }
  if(action==='ai_studio_activate'){
   if(!uuid(p.requestId)||typeof p.planId!=='string')fail('invalid_request');
   const r=await rpc(db,'simab_ai_activate',{p_subject:subject,p_plan_id:p.planId,p_request_id:p.requestId});
   return{status:200,data:r};
  }
  if(action==='admin_ai_studio_status'){
   await isAdmin(db,subject);const cfg=await settings(db);
   return{status:200,data:{enabled:cfg.enabled,freeMode:cfg.free_mode,plans:cfg.plans,archiveChannelId:cfg.archive_channel_id||'',archiveEnabled:cfg.archive_enabled,termsText:cfg.terms_text||''}};
  }
  if(action==='admin_ai_studio_save'){
   await isAdmin(db,subject);
   if(typeof p.enabled!=='boolean'||typeof p.freeMode!=='boolean'||typeof p.archiveEnabled!=='boolean')fail('invalid_request');
   const plans=cleanPlans(p.plans);
   const termsText=typeof p.termsText==='string'?p.termsText.trim():'';
   if(termsText.length>5000)fail('invalid_request');
   if(p.archiveEnabled&&termsText.length<80)fail('invalid_ai_consent');
   const channel=typeof p.channelId==='string'?p.channelId.trim():'';
   if(channel&&!/^-100[0-9]{5,16}$/.test(channel))fail('invalid_channel');
   if(p.archiveEnabled&&!channel)fail('invalid_channel');
   if(channel){
    const bot=await tg(botToken,'getMe',{});
    const member=await tg(botToken,'getChatMember',{chat_id:channel,user_id:bot.id});
    if(!['administrator','creator'].includes(member.status)||member.status==='administrator'&&member.can_post_messages!==true)fail('invalid_channel');
    const chat=await tg(botToken,'getChat',{chat_id:channel});
    if(chat.type!=='channel')fail('invalid_channel');
   }
   const r=await db.from('simab_ai_settings').update({enabled:p.enabled,free_mode:p.freeMode,plans,archive_channel_id:channel||null,archive_enabled:p.archiveEnabled,terms_text:termsText,updated_at:new Date().toISOString()}).eq('singleton',true).select('singleton').single();
   if(r.error||!r.data)fail('ai_unavailable');
   return{status:200,data:{ok:true}};
  }
  if(action==='ai_studio_archive'){
   if(!uuid(p.requestId)||p.consent!==true)fail('invalid_ai_consent');
   if(typeof p.imageData!=='string'||p.imageData.length>2350000)fail('invalid_ai_image');
   const match=/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(p.imageData);
   if(!match)fail('invalid_ai_image');
   let bytes:Uint8Array;
   try{const raw=atob(match[1]);bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));}catch{fail('invalid_ai_image');}
   if(bytes.length<256||bytes.length>1700000||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255||bytes[bytes.length-2]!==255||bytes[bytes.length-1]!==217)fail('invalid_ai_image');
   const cfg=await settings(db);
   if(!cfg.enabled||!cfg.archive_enabled||!cfg.archive_channel_id||(cfg.terms_text||'').trim().length<80)fail('archive_not_ready');
   const claimed=await rpc(db,'simab_ai_archive_claim',{p_subject:subject,p_request_id:p.requestId});
   if(!claimed.reserved)return{status:200,data:{archived:claimed.status==='sent',duplicate:true,status:claimed.status,messageId:claimed.messageId||null}};
   try{
    const form=new FormData();form.append('chat_id',cfg.archive_channel_id);
    form.append('photo',new Blob([bytes],{type:'image/jpeg'}),'mango-ai.jpg');
    form.append('disable_notification','true');
    const r=await fetch('https://api.telegram.org/bot'+botToken+'/sendPhoto',{method:'POST',body:form,signal:AbortSignal.timeout(15000)});
    const j=await r.json();
    if(!r.ok||j?.ok!==true||!Number.isInteger(j.result?.message_id))throw Error('telegram_send_failed');
    const updated=await db.from('simab_ai_archive_requests').update({status:'sent',message_id:j.result.message_id}).eq('telegram_subject',subject).eq('request_id',p.requestId);
    if(updated.error)fail('archive_delivery_unknown');
    return{status:200,data:{archived:true,messageId:j.result.message_id}};
   }catch{
    // The result of a timeout is ambiguous; never automatically resend.
    await db.from('simab_ai_archive_requests').update({status:'unknown'}).eq('telegram_subject',subject).eq('request_id',p.requestId);
    return{status:503,data:{error:'archive_delivery_unknown'}};
   }
  }
  return{status:400,data:{error:'invalid_request'}};
 }catch(e){
  const message=(e as Error).message;
  return{status:message==='admin_only'?403:known.includes(message)?409:503,data:{error:known.includes(message)?message:message==='admin_only'?'admin_only':'ai_unavailable'}};
 }
}
