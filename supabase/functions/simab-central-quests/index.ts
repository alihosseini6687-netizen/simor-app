/* SIMAB central-quests API. One file for Supabase Dashboard deployment.
   NEVER include Telegram bot token or a service key in the browser/repository.
   The POST endpoint ALWAYS validates Telegram-signed initData and server-side admin ID.
   This endpoint NEVER grants a reward or edits a wallet. */
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * SIMAB - server-only Telegram Mini App initData validation.
 * Never trust initDataUnsafe; never log bot token or raw initData.
 */
class TelegramAuthError extends Error {
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
async function verifyTelegramInitData(
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

  if (request.method === "GET") {
    const { data, error } = await db.from("simab_central_quests")
      .select("id,title,url,reward_coins,timer_seconds,verification_mode")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return reply(503, { error: "catalog_unavailable" });
    return reply(200, { quests: (data ?? []).map(toPublic), rewardsEnabled: false });
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
    const verified = await verifyTelegramInitData(payload.initData as string, botToken);
    subject = verified.telegramUserId;
  } catch { return reply(401, { error: "telegram_auth_failed" }); }

  // Never rely on a user-id supplied in JSON, localStorage, query string, or initDataUnsafe.
  const { data: admin, error: adminError } = await db.from("simab_admins")
    .select("telegram_subject").eq("telegram_subject", subject).maybeSingle();
  if (adminError) return reply(503, { error: "admin_lookup_unavailable" });
  if (!admin) return reply(403, { error: "admin_only" });

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
    const mode = t.verificationMode === "telegram_membership" ?
      "telegram_membership" : "external_visit";
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
