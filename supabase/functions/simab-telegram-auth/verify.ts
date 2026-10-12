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
