import { createClient } from "npm:@supabase/supabase-js@2";
import { TelegramAuthError, verifyTelegramInitData } from "./verify.ts";
const headers = {
  "content-type":"application/json; charset=utf-8",
  "cache-control":"no-store",
  "access-control-allow-origin":"*",
  "access-control-allow-methods":"POST, OPTIONS",
  "access-control-allow-headers":"content-type, apikey, authorization, x-client-info",
  "vary":"Origin",
};
const send=(status:number,data:Record<string,unknown>)=>new Response(JSON.stringify(data),{status,headers});
function getSecretKey():string|undefined {
  const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(legacy) return legacy;
  const raw=Deno.env.get("SUPABASE_SECRET_KEYS");
  if(!raw) return undefined;
  try {const keys=JSON.parse(raw);return typeof keys.default==="string"?keys.default:undefined;}catch{return undefined;}
}
Deno.serve(async(request)=>{
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(request.method!=="POST")return send(405,{error:"method_not_allowed"});
  const token=Deno.env.get("SIMAB_TELEGRAM_BOT_TOKEN"), url=Deno.env.get("SUPABASE_URL"), secret=getSecretKey();
  if(!token||!url||!secret)return send(503,{error:"not_configured"});
  let raw:string;
  try {
    const body=await request.text();
    if(body.length>8500)return send(413,{error:"request_too_large"});
    raw=JSON.parse(body)?.initData;
  }catch{return send(400,{error:"invalid_request"});}
  let telegramUserId:string,displayName:string;
  try {
    ({telegramUserId,displayName}=await verifyTelegramInitData(raw,token));
  }catch(e){
    return send(e instanceof TelegramAuthError?401:500,{error:e instanceof TelegramAuthError?"telegram_auth_failed":"internal_error"});
  }
  try{
    const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data,error}=await db.rpc("simab_claim_verified_telegram",{p_telegram_subject:telegramUserId,p_name:displayName}).single();
    if(error||!data){console.error("SIMAB: account unavailable");return send(503,{error:"account_unavailable"});}
    return send(200,{ok:true,playerId:data.player_id,displayName,walletReady:false,previousCoinsImported:false});
  }catch{console.error("SIMAB backend unavailable");return send(503,{error:"account_unavailable"});}
});
