import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { createHmac, generateKeyPairSync, sign, webcrypto } from "node:crypto";

const input = readFileSync(new URL("../supabase/functions/simab-central-quests/index.ts", import.meta.url), "utf8");
const from = input.indexOf("class TelegramAuthError extends Error");
const to = input.indexOf("const allowedOrigin =", from);
assert.ok(from >= 0 && to > from, "verification source should be extractable");
const compiled = stripTypeScriptTypes(input.slice(from, to));
const factory = new Function("crypto", "TextEncoder", "URLSearchParams", "atob", compiled +
 "\nreturn {verifyTelegramInitData,verifyTelegramEd25519,TelegramAuthError};");
const { verifyTelegramInitData, verifyTelegramEd25519 } =
  factory(webcrypto, TextEncoder, URLSearchParams, atob);

const NOW = 1790000000;
const BOT = "123456789:unit-test-only-not-a-real-token";
const BOT_ID = "123456789";
const user = JSON.stringify({ id: 702007470, first_name: "Test", last_name: "User" });
const base = { auth_date: String(NOW), user, query_id: "AA_unit_test" };
const unsigned = fields => Object.entries(fields).sort(([a],[b]) => a.localeCompare(b))
  .map(([k, v]) => k + "=" + v).join("\n");
function makeHmac(fields=base, token=BOT) {
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secret).update(unsigned(fields)).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}
function makeEd(fields=base, botId=BOT_ID) {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicKeyHex = publicKey.export({ type: "spki", format: "der" }).subarray(-32).toString("hex");
  const message = botId + ":WebAppData\n" + unsigned(fields);
  const signature = sign(null, Buffer.from(message), privateKey).toString("base64url");
  return { raw: new URLSearchParams({ ...fields, signature, hash: "0".repeat(64) }).toString(), publicKeyHex };
}
const assertRejected = async (promise, expectedCode) =>
  assert.rejects(promise, error => error?.code === expectedCode);

test("HMAC validation accepts known valid bot-token signature", async () => {
  const result = await verifyTelegramInitData(makeHmac(), BOT, NOW);
  assert.equal(result.telegramUserId, "702007470");
});
test("HMAC rejects tampered user, wrong bot token, expired auth", async () => {
  const params = new URLSearchParams(makeHmac());
  params.set("user", JSON.stringify({ id: 1 }));
  await assertRejected(verifyTelegramInitData(params.toString(), BOT, NOW), "signature_mismatch");
  await assertRejected(verifyTelegramInitData(makeHmac(), "987:wrong-token", NOW), "signature_mismatch");
  await assertRejected(verifyTelegramInitData(makeHmac({ ...base, auth_date: String(NOW-3601) }), BOT, NOW), "expired");
});
test("Ed25519 accepts valid signed Telegram test sample with matching bot ID", async () => {
  const {raw, publicKeyHex} = makeEd();
  const result = await verifyTelegramEd25519(raw, BOT_ID, NOW, publicKeyHex);
  assert.equal(result.telegramUserId, "702007470");
});
test("Ed25519 rejects another bot ID, altered message and expiry", async () => {
  const {raw, publicKeyHex} = makeEd();
  await assertRejected(verifyTelegramEd25519(raw, "987654321", NOW, publicKeyHex), "signature_mismatch");
  const altered = new URLSearchParams(raw);
  altered.set("user", JSON.stringify({ id: 1 }));
  await assertRejected(verifyTelegramEd25519(altered.toString(), BOT_ID, NOW, publicKeyHex), "signature_mismatch");
  const expired = makeEd({ ...base, auth_date: String(NOW - 3601) });
  await assertRejected(verifyTelegramEd25519(expired.raw, BOT_ID, NOW, expired.publicKeyHex), "expired");
});
test("Ed25519 rejects malformed signature or duplicate params", async () => {
  const {raw, publicKeyHex} = makeEd();
  const broken = new URLSearchParams(raw);
  broken.set("signature", "abc");
  await assertRejected(verifyTelegramEd25519(broken.toString(), BOT_ID, NOW, publicKeyHex), "missing_fields");
  await assertRejected(verifyTelegramEd25519(raw+"&user=other", BOT_ID, NOW, publicKeyHex), "invalid_payload");
});
test("Production code never skips verification and never trusts initDataUnsafe", () => {
  assert.match(input, /await verifyTelegramInitData\(/);
  assert.match(input, /await verifyTelegramEd25519\(/);
  assert.match(input, /bot\.name\.toLowerCase\(\) !== "simorapp_bot"/);
  assert.match(input, /telegramProductionEd25519PublicKey/);
  assert.match(input, /telegram_auth_failed/);
  assert.doesNotMatch(input, /Deno\.env\.get\("ALLOW_INSECURE_AUTH"\)/);
});

test("the root page keeps launch initData only in this tab and only for one hour", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /simab_signed_launch_init_data_v1/);
  assert.match(html, /sessionStorage\.setItem/);
  assert.match(html, /age <= 3600/);
  assert.doesNotMatch(html, /localStorage\.setItem\("simab_signed_launch_init_data_v1"/);
});
test("admin retries at most two signed inputs, never bypasses server authentication", () => {
  const client = readFileSync(new URL("../assets/js/simab-central-quests.js", import.meta.url), "utf8");
  assert.match(client, /signedInitDataCandidates/);
  assert.match(client, /new Set\(\[fromLaunch, direct\]\)/);
  assert.match(client, /j\.reason !== "signature_mismatch"/);
  assert.match(client, /if \(!r\.ok\) throw new Error/);
  assert.match(client, /JSON\.stringify\(\{ initData: used, action/);
  for(const file of ["admin/index.html","quests/index.html"]) {
    const html = readFileSync(new URL("../"+file, import.meta.url), "utf8");
    assert.match(html, /simab-central-quests\.js\?v=6/);
  }
});
