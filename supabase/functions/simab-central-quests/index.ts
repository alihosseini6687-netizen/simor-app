/* SIMAB central-quests API. One file for Supabase Dashboard deployment.
   NEVER include Telegram bot token or a service key in the browser/repository.
   The POST endpoint ALWAYS validates Telegram-signed initData and server-side admin ID.
   Reward claims update only a separate verified ledger after Telegram channel check. */
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * SIMAB - server-only Telegram Mini App initData validation.
 * Never trust initDataUnsafe; never log bot token or raw initData.
 */
class TelegramAuthError extends Error {
  code: string;
  constructor(code = "invalid_payload") {
    super("Telegram authentication rejected");
    this.code = code;
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
async function verifyTelegramInitData(
  raw: string,
  botToken: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<{ telegramUserId: string; displayName: string }> {
  if (typeof raw !== "string" || !raw || raw.length > 8192 || !botToken) throw new TelegramAuthError("missing_fields");
  const params = new URLSearchParams(raw);
  const seen = new Set<string>();
  for (const [key] of params) {
    if (seen.has(key)) throw new TelegramAuthError("invalid_payload");
    seen.add(key);
  }
  const claimedHash = params.get("hash") ?? "";
  const dateText = params.get("auth_date") ?? "";
  const userText = params.get("user") ?? "";
  if (!/^\d{10,12}$/.test(dateText) || !userText || !claimedHash) throw new TelegramAuthError("missing_fields");
  const issuedAt = Number(dateText);
  if (!Number.isSafeInteger(issuedAt)) throw new TelegramAuthError("invalid_payload");
  if (issuedAt > nowSeconds + 30) throw new TelegramAuthError("clock_mismatch");
  if (nowSeconds - issuedAt > allowedAgeSeconds) throw new TelegramAuthError("expired");
  // Exclude Telegram's alternate Ed25519 signature from the HMAC message.
  const pairs = [...params.entries()]
    .filter(([k]) => k !== "hash" && k !== "signature")
    .map(([k, v]) => k + "=" + v)
    .sort();
  const secret = await hmac(enc.encode("WebAppData"), botToken);
  const expected = await hmac(secret, pairs.join("\n"));
  if (!constantTimeMatch(expected, claimedHash)) throw new TelegramAuthError("signature_mismatch");
  let user: Record<string, unknown>;
  try { user = JSON.parse(userText); } catch { throw new TelegramAuthError("invalid_payload"); }
  if (!user || typeof user !== "object" || Array.isArray(user)) throw new TelegramAuthError("invalid_payload");
  const id = user.id;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) throw new TelegramAuthError("invalid_payload");
  const first = typeof user.first_name === "string" ? user.first_name : "";
  const last = typeof user.last_name === "string" ? user.last_name : "";
  const cleanName = (first + " " + last).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 80);
  return { telegramUserId: String(id), displayName: cleanName || "بازیکن" };
}



// Telegram production Ed25519 key published at core.telegram.org/bots/webapps.
// This is not a bypass: we verify the official Telegram signature bound to
// the bot id returned from getMe before trusting even the user id.
const telegramProductionEd25519PublicKey =
  "e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d";
async function verifyTelegramEd25519(
  raw: string, botId: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  publicKeyHex = telegramProductionEd25519PublicKey,
): Promise<{ telegramUserId: string; displayName: string }> {
  if (typeof raw !== "string" || !raw || raw.length > 8192 || !/^[1-9]\d{4,19}$/.test(botId))
    throw new TelegramAuthError("invalid_payload");
  const params = new URLSearchParams(raw);
  const seen = new Set<string>();
  for (const [k] of params) {
    if (seen.has(k)) throw new TelegramAuthError("invalid_payload");
    seen.add(k);
  }
  const sigText = params.get("signature") ?? "";
  const authDate = params.get("auth_date") ?? "";
  const userText = params.get("user") ?? "";
  if (!/^[A-Za-z0-9_-]{85,88}={0,2}$/.test(sigText) || !/^\d{10,12}$/.test(authDate) || !userText)
    throw new TelegramAuthError("missing_fields");
  const issuedAt = Number(authDate);
  if (!Number.isSafeInteger(issuedAt)) throw new TelegramAuthError("invalid_payload");
  if (issuedAt > nowSeconds + 30) throw new TelegramAuthError("clock_mismatch");
  if (nowSeconds - issuedAt > allowedAgeSeconds) throw new TelegramAuthError("expired");
  if (!/^[0-9a-f]{64}$/i.test(publicKeyHex)) throw new TelegramAuthError("invalid_payload");
  let signature: Uint8Array;
  try {
    const encoded = sigText.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = atob(encoded + "=".repeat((4 - encoded.length % 4) % 4));
    signature = Uint8Array.from(bytes, c => c.charCodeAt(0));
    if (signature.length !== 64) throw new Error("invalid_length");
  } catch { throw new TelegramAuthError("invalid_payload"); }
  const entries = [...params.entries()]
    .filter(([k]) => k !== "hash" && k !== "signature")
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([k, v]) => k + "=" + v);
  const checkString = botId + ":WebAppData\n" + entries.join("\n");
  const publicKeyBytes = Uint8Array.from(publicKeyHex.match(/../g)!, h => Number.parseInt(h, 16));
  try {
    const key = await crypto.subtle.importKey("raw", publicKeyBytes, { name: "Ed25519" }, false, ["verify"]);
    const valid = await crypto.subtle.verify({ name: "Ed25519" }, key, signature, enc.encode(checkString));
    if (!valid) throw new TelegramAuthError("signature_mismatch");
  } catch (error) {
    if (error instanceof TelegramAuthError) throw error;
    throw new TelegramAuthError("signature_mismatch");
  }
  let user: Record<string, unknown>;
  try { user = JSON.parse(userText); } catch { throw new TelegramAuthError("invalid_payload"); }
  if (!user || typeof user !== "object" || Array.isArray(user) ||
      typeof user.id !== "number" || !Number.isSafeInteger(user.id) || user.id <= 0)
    throw new TelegramAuthError("invalid_payload");
  const first = typeof user.first_name === "string" ? user.first_name : "";
  const last = typeof user.last_name === "string" ? user.last_name : "";
  const cleanName = (first + " " + last).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 80);
  return { telegramUserId: String(user.id), displayName: cleanName || "بازیکن" };
}


const allowedOrigin = "https://alihosseini6687-netizen.github.io";
const httpHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-origin": allowedOrigin,
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, apikey, authorization, x-client-info",
  "vary": "Origin",
};
const reply = (status: number, data: Record<string, unknown>) =>
  new Response(JSON.stringify(data), { status, headers: httpHeaders });

function serviceKey(): string | undefined {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const keys = JSON.parse(raw);
      if (typeof keys.default === "string") return keys.default;
    } catch { /* legacy secret below */ }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
}

// Official Telegram /getMe contains the BOT ID needed by third-party
// signature verification. Never return the bot token or log signed initData.
let botCache: { id: string; name: string; until: number } | null = null;
async function getBotIdentity(token: string): Promise<{ id: string; name: string } | null> {
  if (botCache && botCache.until > Date.now()) return { id: botCache.id, name: botCache.name };
  try {
    const response = await fetch("https://api.telegram.org/bot" + token + "/getMe", {
      method: "GET", signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return null;
    const j = await response.json();
    const name = j?.ok && typeof j?.result?.username === "string" ? j.result.username : "";
    const id = j?.ok && Number.isSafeInteger(j.result?.id) && j.result.id > 0 ? String(j.result.id) : "";
    if (!name || !id) return null;
    botCache = { id, name, until: Date.now() + 300000 };
    return { id, name };
  } catch { return null; }
}

// Public official channel provided by owner. This is NOT a secret.
const OFFICIAL_CHANNEL = "@SimorApp";
let channelAdminCache: { ready: boolean; expires: number } | null = null;
function isOfficialChannelUrl(raw: string): boolean {
  try {
    const link = new URL(raw);
    return link.protocol === "https:" && link.hostname.toLowerCase() === "t.me" &&
      !link.username && !link.password && !link.port &&
      link.pathname.replace(/\/$/, "").toLowerCase() === "/simorapp" &&
      !link.search && !link.hash;
  } catch { return false; }
}
async function isBotAdminInOfficialChannel(token: string, botId: string): Promise<boolean> {
  if (channelAdminCache && channelAdminCache.expires > Date.now()) return channelAdminCache.ready;
  let ready = false;
  try {
    const response = await fetch("https://api.telegram.org/bot" + token + "/getChatMember", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({chat_id: OFFICIAL_CHANNEL, user_id: Number(botId)}),
      signal: AbortSignal.timeout(7000),
    });
    const result = await response.json();
    ready = response.ok && result?.ok === true &&
      ["creator", "administrator"].includes(result?.result?.status);
  } catch { ready = false; }
  channelAdminCache = { ready, expires: Date.now() + (ready ? 15000 : 30000) };
  return ready;
}

const toPublic = (item: Record<string, unknown>) => ({
  id: item.id,
  title: item.title,
  url: item.url,
  rewardCoins: item.reward_coins,
  timerSeconds: item.timer_seconds,
  verificationMode: item.verification_mode,
  // A catalog entry is not a verified or payable reward.
  rewardAvailable: false,
});

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: httpHeaders });
  const url = new URL(request.url);
  if (url.pathname.split("/").pop() !== "simab-central-quests")
    return reply(404, { error: "not_found" });
  const dbUrl = Deno.env.get("SUPABASE_URL");
  const key = serviceKey();
  if (!dbUrl || !key) return reply(503, { error: "not_configured" });
  const db = createClient(dbUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });

  if (request.method === "GET" && url.searchParams.get("health") === "1") {
    const token = Deno.env.get("SIMAB_TELEGRAM_BOT_TOKEN");
    if (!token) return reply(503, { error: "bot_not_configured" });
    const bot = await getBotIdentity(token);
    if (!bot) return reply(503, { error: "bot_identity_unavailable" });
    const channelBotIsAdmin = await isBotAdminInOfficialChannel(token, bot.id);
    return reply(200, { ok: true, botUsername: "@" + bot.name,
      botMatchesExpected: bot.name.toLowerCase() === "simorapp_bot",
      officialChannel: OFFICIAL_CHANNEL, channelConfigured: true, channelBotIsAdmin,
      rewardsEnabled: channelBotIsAdmin && bot.name.toLowerCase() === "simorapp_bot" });
  }
  if (request.method === "GET") {
    const { data, error } = await db.from("simab_central_quests")
      .select("id,title,url,reward_coins,timer_seconds,verification_mode")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return reply(503, { error: "catalog_unavailable" });
    const botToken = Deno.env.get("SIMAB_TELEGRAM_BOT_TOKEN") || "";
    const bot = botToken ? await getBotIdentity(botToken) : null;
    const rewardsEnabled = !!bot && bot.name.toLowerCase() === "simorapp_bot" &&
      await isBotAdminInOfficialChannel(botToken, bot.id);
    const quests = (data ?? []).map(q => ({...toPublic(q),
      rewardAvailable: rewardsEnabled && q.verification_mode === "telegram_membership" &&
        q.reward_coins > 0 && isOfficialChannelUrl(q.url),
    }));
    return reply(200, { quests, rewardsEnabled });
  }

  if (request.method !== "POST") return reply(405, { error: "method_not_allowed" });
  if (Number(request.headers.get("content-length") || "0") > 10000)
    return reply(413, { error: "request_too_large" });
  let payload: Record<string, unknown>;
  try {
    const text = await request.text();
    if (text.length > 10000) return reply(413, { error: "request_too_large" });
    payload = JSON.parse(text);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw Error("bad json");
  } catch { return reply(400, { error: "invalid_request" }); }
  const botToken = Deno.env.get("SIMAB_TELEGRAM_BOT_TOKEN");
  if (!botToken) return reply(503, { error: "not_configured" });
  let subject = "";
  try {
    let verified;
    try {
      verified = await verifyTelegramInitData(payload.initData as string, botToken);
    } catch (error) {
      if (!(error instanceof TelegramAuthError) || error.code !== "signature_mismatch" ||
          typeof payload.initData !== "string" ||
          !new URLSearchParams(payload.initData).has("signature")) throw error;
      const bot = await getBotIdentity(botToken);
      // Fall back only for this known bot and a valid official Telegram
      // Ed25519 signature explicitly bound to its verified bot id.
      if (!bot || bot.name.toLowerCase() !== "simorapp_bot")
        throw new TelegramAuthError("signature_mismatch");
      verified = await verifyTelegramEd25519(payload.initData, bot.id);
    }
    subject = verified.telegramUserId;
  } catch (error) {
    const reason = error instanceof TelegramAuthError ? error.code : "invalid_payload";
    return reply(401, { error: "telegram_auth_failed", reason });
  }

  // Authoritative server wallet: only signed Telegram user identity is accepted.
  // Browser never sends old balance, game outcome, RNG, or a credited reward.
  if (payload.action === "wallet") {
    const walletAction=typeof payload.walletAction==="string"?payload.walletAction:"";
    const allowed=new Set(["state","daily","wheel","miner_start","miner_claim",
      "exchange_to_chips","exchange_to_coins","slot"]);
    if (!allowed.has(walletAction)) return reply(400,{error:"invalid_wallet_action"});
    const mutating=walletAction!=="state";
    const requestId=typeof payload.requestId==="string"?payload.requestId:"";
    if (mutating && !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestId))
      return reply(400,{error:"invalid_request_id"});
    const amount=payload.amount===undefined?0:payload.amount;
    if (!Number.isSafeInteger(amount) || amount<0 || amount>1000)
      return reply(400,{error:"invalid_wallet_amount"});
    if (walletAction==="slot" && (amount<1 || amount>50))
      return reply(400,{error:"invalid_slot_bet"});
    if ((walletAction==="exchange_to_chips" || walletAction==="exchange_to_coins") && amount<1)
      return reply(400,{error:"invalid_exchange_amount"});
    const {data,error}=await db.rpc("simab_secure_wallet_action",{
      p_subject:subject,p_action:walletAction,p_amount:amount,
      p_request_id:mutating?requestId:null,
    });
    if (error) {
      const known=new Set(["insufficient_coins","insufficient_chips","invalid_bet",
        "invalid_amount","wallet_limit","invalid_subject","missing_request_id"]);
      const code=known.has(error.message)?error.message:"wallet_unavailable";
      return reply(known.has(error.message)?409:503,{error:code});
    }
    if (!data || data.serverWallet!==true) return reply(503,{error:"wallet_unavailable"});
    return reply(200,{...data,legacyWalletImported:false});
  }

  if (payload.action === "wallet_history") {
    const {data,error}=await db.from("simab_secure_wallet_events")
      .select("action,coin_delta,chip_delta,created_at")
      .eq("telegram_subject",subject)
      .order("created_at",{ascending:false}).limit(30);
    if (error) return reply(503,{error:"wallet_history_unavailable"});
    return reply(200,{events:data||[]});
  }

  // User rewards use VERIFIED Telegram identity; never trust browser balance.
  // These actions happen BEFORE the admin authorization block.
  if (payload.action === "my_rewards") {
    const {data:claims,error:claimsError}=await db.from("simab_verified_quest_claims")
      .select("quest_id,created_at,reward_coins")
      .eq("telegram_subject", subject).order("created_at",{ascending:false}).limit(50);
    if (claimsError) return reply(503,{error:"verified_ledger_unavailable"});
    const {data:wallet,error:walletError}=await db.rpc("simab_secure_wallet_action",{
      p_subject:subject,p_action:"state",p_amount:0,p_request_id:null,
    });
    if (walletError || !wallet) return reply(503,{error:"wallet_unavailable"});
    return reply(200,{verifiedCoins:Number(wallet.coins||0),
      verifiedChips:Number(wallet.chips||0),
      claimedQuestIds:(claims||[]).map(x=>x.quest_id),spendableInGames:false,spendableInSecureGames:true,
      legacyWalletImported:false});
  }
  if (payload.action === "claim") {
    const id=typeof payload.questId==="string"?payload.questId:"";
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id))
      return reply(400,{error:"invalid_quest_id"});
    const channel = OFFICIAL_CHANNEL;
    const verifiedBot = await getBotIdentity(botToken);
    if (!verifiedBot || verifiedBot.name.toLowerCase() !== "simorapp_bot" ||
        !await isBotAdminInOfficialChannel(botToken, verifiedBot.id))
      return reply(503,{error:"channel_bot_not_admin"});
    const {data:q,error:lookupError}=await db.from("simab_central_quests")
      .select("id,url,reward_coins,verification_mode,is_published").eq("id",id).maybeSingle();
    if (lookupError) return reply(503,{error:"quest_lookup_unavailable"});
    if (!q || !q.is_published || q.verification_mode!=="telegram_membership" || q.reward_coins<1)
      return reply(409,{error:"quest_not_rewardable"});
    if (!isOfficialChannelUrl(q.url)) return reply(409,{error:"channel_mismatch"});
    const userId=Number(subject);
    if (!Number.isSafeInteger(userId)||userId<=0) return reply(401,{error:"invalid_telegram_subject"});
    let member:{status?:string;is_member?:boolean};
    try {
      const response=await fetch("https://api.telegram.org/bot"+botToken+"/getChatMember",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({chat_id:channel,user_id:userId}),signal:AbortSignal.timeout(8500),
      });
      const result=await response.json();
      if (!response.ok||!result.ok||!result.result) return reply(503,{error:"membership_check_unavailable"});
      member=result.result;
    } catch {return reply(503,{error:"membership_check_unavailable"});}
    const membership=["creator","administrator","member"].includes(member.status||"") ||
      (member.status==="restricted"&&member.is_member===true);
    if (!membership) return reply(403,{error:"channel_membership_required"});
    const {data,error}=await db.rpc("simab_credit_verified_quest",{
      p_telegram_subject:subject,p_quest_id:id,
    });
    if (error||!Array.isArray(data)||data.length!==1)
      return reply(503,{error:"reward_ledger_unavailable"});
    return reply(200,{granted:data[0].granted===true,alreadyClaimed:data[0].granted!==true,
      rewardCoins:data[0].reward_coins,verifiedCoins:Number(data[0].verified_coins),
      spendableInGames:false,spendableInSecureGames:true});
  }

  // Never rely on a user-id supplied in JSON, localStorage, query string, or initDataUnsafe.
  const { data: admin, error: adminError } = await db.from("simab_admins")
    .select("telegram_subject").eq("telegram_subject", subject).maybeSingle();
  if (adminError) return reply(503, { error: "admin_lookup_unavailable" });
  if (!admin) return reply(403, { error: "admin_only" });

  if (payload.action === "ping") return reply(200, { ok: true, adminVerified: true });

  if (payload.action === "broadcast") {
    const message = typeof payload.message === "string" ? payload.message.trim() : "";
    const channel = OFFICIAL_CHANNEL;
    if (message.length < 1 || message.length > 1500)
      return reply(400, { error: "invalid_message" });
    const verifiedBot = await getBotIdentity(botToken);
    if (!verifiedBot || verifiedBot.name.toLowerCase() !== "simorapp_bot" ||
        !await isBotAdminInOfficialChannel(botToken, verifiedBot.id))
      return reply(503, { error: "channel_bot_not_admin" });
    try {
      const tgResponse = await fetch("https://api.telegram.org/bot" + botToken + "/sendMessage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: channel, text: message, disable_web_page_preview: true }),
        signal: AbortSignal.timeout(9000),
      });
      const result = await tgResponse.json();
      if (!tgResponse.ok || !result?.ok)
        return reply(503, { error: "telegram_send_failed" });
      return reply(200, { ok: true, sent: true, messageId: result.result?.message_id ?? null });
    } catch { return reply(503, { error: "telegram_send_failed" }); }
  }

  if (payload.action === "create") {
    const task = payload.task;
    if (!task || typeof task !== "object" || Array.isArray(task))
      return reply(400, { error: "invalid_task" });
    const t = task as Record<string, unknown>;
    const title = typeof t.title === "string" ? t.title.trim() : "";
    const externalUrl = typeof t.url === "string" ? t.url.trim() : "";
    let parsed: URL;
    try { parsed = new URL(externalUrl); }
    catch { return reply(400, { error: "invalid_url" }); }
    const reward = Number(t.rewardCoins);
    const timer = Number(t.timerSeconds);
    if (title.length < 3 || title.length > 100 ||
      parsed.protocol !== "https:" || parsed.username || parsed.password ||
      externalUrl.length > 500 || !Number.isSafeInteger(reward) || reward < 0 ||
      reward > 10000 || !Number.isSafeInteger(timer) || timer < 10 || timer > 120)
      return reply(400, { error: "invalid_task" });
    const mode = t.verificationMode === "telegram_membership" &&
      isOfficialChannelUrl(parsed.href) ? "telegram_membership" : "external_visit";
    const { data, error } = await db.from("simab_central_quests")
      .insert({
        title, url: parsed.href, reward_coins: reward,
        timer_seconds: timer, verification_mode: mode,
        is_published: true,
      }).select("id,title,url,reward_coins,timer_seconds,verification_mode").single();
    if (error || !data) return reply(503, { error: "create_failed" });
    return reply(201, { ok: true, quest: toPublic(data), rewardsEnabled: false });
  }

  if (payload.action === "archive") {
    const id = typeof payload.id === "string" ? payload.id : "";
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id))
      return reply(400, { error: "invalid_id" });
    const { data, error } = await db.from("simab_central_quests")
      .update({ is_published: false, updated_at: new Date().toISOString() })
      .eq("id", id).select("id").maybeSingle();
    if (error) return reply(503, { error: "archive_failed" });
    if (!data) return reply(404, { error: "not_found" });
    return reply(200, { ok: true });
  }
  return reply(400, { error: "invalid_action" });
});
