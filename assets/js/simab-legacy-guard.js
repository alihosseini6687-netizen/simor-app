/* SIMAB V6 - Legacy local wallet hygiene (NOT server-side security).
 * One lightweight shared helper. Never award, spend or sync coins here.
 * A future server wallet must not trust values returned from this helper.
 */
(function () {
  "use strict";
  const MAX_LEGACY_AMOUNT = 1_000_000_000_000;
  const DENOMS = ["c1", "c5", "c25", "c100", "c500"];
  function safeAmount(value, fallback = 0) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > MAX_LEGACY_AMOUNT) return fallback;
    return n;
  }
  function readAmount(key, fallback = 0) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null || raw === "") return fallback;
      return safeAmount(raw, fallback);
    } catch (_) { return fallback; }
  }
  function readInventory(key) {
    let obj;
    try { obj = JSON.parse(localStorage.getItem(key) || "null"); }
    catch (_) { obj = null; }
    const result = {};
    for (const name of DENOMS) {
      const n = obj && typeof obj === "object" ? Number(obj[name]) : 0;
      result[name] = Number.isSafeInteger(n) && n >= 0 && n <= 1_000_000_000 ? n : 0;
    }
    return result;
  }
  // Data read from localStorage and CloudStorage is *untrusted*. This helper
  // prevents NaN/negative display bugs but DOES NOT prove an owned balance.
  window.SimabLegacy = Object.freeze({
    safeAmount, readAmount, readInventory,
    isDemo: true
  });
})();
