// SIMAB: Single-file Supabase Dashboard version of simab-telegram-auth.
// Store SIMAB_TELEGRAM_BOT_TOKEN in Edge Function Secrets; NEVER paste token here.
// Use Verify JWT = OFF for this endpoint, since Telegram initData is authenticated inside.
// This creates a zero-balance server account only; it does not import browser coins.

import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * SIMAB - server-only Telegram Mini App initData validation.
 * Never trust initDataUnsafe; never log bot token or raw initData.
 */
export class TelegramAuthError extends Error {
  constructor(message = "Telegram authentication rejected") {
    super(message);
    this.name = "TelegramAuthError";
  }
}
const enc = new TextEncoder();
const allowedAgeSeconds = 60 * 60;
async function hmac(keyBytes: Uint8Array, text: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(text)));
}
function constantTimeMatch(computed: Uint8Array, claimedHash: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(claimedHash)) return false;
  let different = 0;
  for (let i = 0; i < computed.length; i++) {
    const other = Number.parseInt(claimedHash.slice(i * 2, i * 2 + 2), 16);
    different |= computed[i] ^ other;
  }
  return different === 0;
}
export async function verifyTelegramInitData(
  raw: string,
  botToken: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<{ telegramUserId: string; displayName: string }> {
  if (typeof raw !== "string" || !raw || raw.length > 8192 || !botToken) throw new TelegramAuthError();
  const params = new URLSearchParams(raw);
  const seen = new Set<string>();
  for (const [key] of params) {
    if (seen.has(key)) throw new TelegramAuthError();
    seen.add(key);
  }
  const claimedHash = params.get("hash") ?? "";
  const dateText = params.get("auth_date") ?? "";
  const userText = params.get("user") ?? "";
  if (!/^\d{10,12}$/.test(dateText) || !userText) throw new TelegramAuthError();
  const issuedAt = Number(dateText);
  if (!Number.isSafeInteger(issuedAt) || issuedAt > nowSeconds + 30 || nowSeconds - issuedAt > allowedAgeSeconds) {
    throw new TelegramAuthError();
  }
  // Exclude Telegram's alternate Ed25519 signature from the HMAC message.
  const pairs = [...params.entries()]
    .filter(([k]) => k !== "hash" && k !== "signature")
    .map(([k, v]) => k + "=" + v)
    .sort();
  const secret = await hmac(enc.encode("WebAppData"), botToken);
  const expected = await hmac(secret, pairs.join("\n"));
  if (!constantTimeMatch(expected, claimedHash)) throw new TelegramAuthError();
  let user: Record<string, unknown>;
  try { user = JSON.parse(userText); } catch { throw new TelegramAuthError(); }
  if (!user || typeof user !== "object" || Array.isArray(user)) throw new TelegramAuthError();
  const id = user.id;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) throw new TelegramAuthError();
  const first = typeof user.first_name === "string" ? user.first_name : "";
  const last = typeof user.last_name === "string" ? user.last_name : "";
  const cleanName = (first + " " + last).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 80);
  return { telegramUserId: String(id), displayName: cleanName || "بازیکن" };
}

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
