/* SIMAB central mission catalog: no client-side coins are awarded here.
 * Admin mutations require signed Telegram initData; only the Edge Function
 * and service-role SQL account can publish/archive.
 */
(() => {
  "use strict";
  const endpoint = "https://pwjlyryrrgbaprfnrieq.supabase.co/functions/v1/simab-central-quests";
  const officialChannelUrl = "https://t.me/SimorApp";
  const isOfficialChannelUrl = raw => {
    try {
      const link = new URL(raw);
      return link.protocol === "https:" && link.hostname.toLowerCase() === "t.me" &&
        link.pathname.replace(/\/$/, "").toLowerCase() === "/simorapp" &&
        !link.search && !link.hash && !link.username && !link.password && !link.port;
    } catch { return false; }
  };
  const isAdmin = Boolean(document.getElementById("tasks-list"));
  const isQuests = Boolean(document.getElementById("quests-container"));
  if (!isAdmin && !isQuests) return;

  const currentTasks = new Map();
  const popup = (title, message, icon = "ℹ️") => {
    if (isAdmin && typeof window.showPopup === "function") window.showPopup(title, message, icon);
    else if (typeof window.showToast === "function") window.showToast(message);
  };
  let rewardsEnabled = false;
  async function readPublished() {
    const r = await fetch(endpoint, { method: "GET", cache: "no-store", headers: { accept: "application/json" } });
    if (!r.ok) throw new Error("catalog_" + r.status);
    const json = await r.json();
    if (!Array.isArray(json.quests)) throw new Error("invalid_catalog");
    rewardsEnabled = json.rewardsEnabled === true;
    return json.quests.filter(t => t && typeof t.id === "string" && typeof t.title === "string");
  }
  // Only used to explain 401s. This decoded timestamp is never treated as identity,
  // proof of authorization, or a reason to grant a reward.
  function describeTelegram401(initData) {
    try {
      const fields = new URLSearchParams(initData);
      const authDate = fields.get("auth_date");
      if (!authDate || !/^\d{10,12}$/.test(authDate) || !fields.get("user") || !fields.get("hash")) {
        return "اطلاعات ورود تلگرام ناقص است. مینی‌اپ را از دکمه ربات باز کن؛ در صورت تکرار، نحوه راه‌اندازی را بررسی می‌کنیم.";
      }
      const ageSeconds = Math.floor(Date.now() / 1000) - Number(authDate);
      if (Number.isFinite(ageSeconds) && ageSeconds > 3600) {
        return "اطلاعات ورود تلگرام قدیمی است (بیش از یک ساعت). نسخه مینی‌اپ را کامل ببند و از دکمه ربات دوباره اجرا کن.";
      }
      if (Number.isFinite(ageSeconds) && ageSeconds < -30) {
        return "زمان ورود تلگرام در آینده ثبت شده است؛ ساعت گوشی و تنظیمات زمان را بررسی کن.";
      }
      return "اطلاعات ورود تلگرام تازه است ولی امضای آن پذیرفته نشد. باید تطابق توکن ذخیره‌شده در Supabase با رباتی که مینی‌اپ را باز کرده بررسی شود؛ توکن را ارسال نکن.";
    } catch {
      return "اعتبارسنجی ورود تلگرام انجام نشد؛ شناسه ربات و تنظیمات سرور باید بررسی شوند.";
    }
  }

  // Across a traditional multi-page Mini App navigation, use the original
  // signed launch data if present. Server validates all candidates; cached data
  // never grants privileges by itself and cannot outlive the 1h auth TTL.
  function signedInitDataCandidates() {
    const direct = window.Telegram?.WebApp?.initData || "";
    let fromLaunch = "";
    try { fromLaunch = sessionStorage.getItem("simab_signed_launch_init_data_v1") || ""; }
    catch (_) { /* storage optional */ }
    const fresh = raw => {
      try {
        const q = new URLSearchParams(raw);
        const when = Number(q.get("auth_date"));
        const age = Math.floor(Date.now()/1000) - when;
        return Boolean(q.get("user") && q.get("hash") && Number.isSafeInteger(when) &&
          age >= -30 && age <= 3600);
      } catch (_) { return false; }
    };
    const unique = [...new Set([fromLaunch, direct])].filter(fresh);
    if (!unique.length && direct) unique.push(direct);
    return unique;
  }
  async function doAdmin(action, extra) {
    const candidates = signedInitDataCandidates();
    if (!candidates.length) throw new Error("اطلاعات امضاشده تلگرام در این صفحه موجود نیست. سیماب را با دکمه ربات اصلی باز کن.");
    let r, j, used;
    for (let i = 0; i < candidates.length; i++) {
      used = candidates[i];
      r = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ initData: used, action, ...extra }),
      });
      j = await r.json().catch(() => ({}));
      // At most once, retry another Telegram-signed navigation payload.
      // Never retry an authorization-denied 403 or an expired 401.
      if (r.ok || r.status !== 401 || j.reason !== "signature_mismatch") break;
    }
    if (action === "admin_credit" && !r.ok) {
      const messages = {
        invalid_target: "آیدی عددی تلگرام معتبر نیست.",
        invalid_credit_amount: "تعداد سکه باید عدد صحیح مثبت تا ۱٬۰۰۰٬۰۰۰٬۰۰۰٬۰۰۰ باشد.",
        wallet_limit: "این مبلغ از سقف موجودی کیف پول بیشتر می‌شود.",
        request_conflict: "این شناسه درخواست قبلاً با مشخصات دیگری ثبت شده است.",
        admin_only: "مجوز مدیریت این حساب تأیید نشد.",
        admin_credit_unavailable: "سرویس واریز آماده نیست یا پاسخ قطعی نداد.",
        telegram_auth_failed: "ورود تلگرام معتبر نیست؛ برنامه را از ربات دوباره باز کن.",
      };
      const error = new Error(messages[j.error] || "واریز تأیید نشد؛ پاسخ سرور: " + r.status);
      error.definitive = [400, 401, 403, 409, 413].includes(r.status);
      throw error;
    }
    if (!r.ok) throw new Error(
      r.status === 401 ? (
        j.reason === "expired" ? "امضای ورود تلگرام بیش از یک ساعت قدیمی است. مینی‌اپ را مجدداً از ربات باز کن." :
        j.reason === "clock_mismatch" ? "زمان ورود تلگرام نامعتبر است؛ ساعت گوشی را بررسی کن." :
        j.reason === "signature_mismatch" ? "امضای ورود با روش‌های رسمی تأیید نشد؛ باید منبع باز شدن مینی‌اپ بررسی شود." :
        j.reason === "missing_fields" ? "اطلاعات امضاشده تلگرام ناقص است؛ از دکمه مینی‌اپ ربات باز کن." :
        describeTelegram401(used)
      ) :
      r.status === 403 ? (j.error === "channel_membership_required"
        ? "عضویت در کانال تأیید نشد؛ ابتدا در کانال عضو شو."
        : "دسترسی برای انجام این عملیات تأیید نشد.") :
      r.status === 409 ? "این مأموریت شرایط پرداخت سروری را ندارد." :
      r.status === 503 ? (j.error === "channel_bot_not_admin"
        ? "ربات @SimorApp_bot هنوز مدیر کانال @SimorApp نیست یا مجوز بررسی اعضا را ندارد. هیچ جایزه‌ای ثبت نشد."
        : "سرور تأیید عضویت یا دفتر جایزه در دسترس نیست؛ هیچ سکه‌ای پرداخت نشده است.") :
      "درخواست سروری ناموفق بود (HTTP " + r.status + ")."
    );
    return j;
  }
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  async function renderAdmin() {
    const list = document.getElementById("tasks-list");
    if (!list) return;
    list.replaceChildren(el("p", "", "در حال دریافت مأموریت‌های منتشرشده از سرور..."));
    try {
      const quests = await readPublished();
      currentTasks.clear();
      list.replaceChildren();
      if (!quests.length) {
        list.append(el("p", "", "هنوز مأموریت مرکزی ثبت نشده است."));
        return;
      }
      for (const task of quests) {
        currentTasks.set(task.id, task);
        const row = el("div", "custom-task-item");
        const text = el("span", "", task.title + " (" + task.rewardCoins + " سکه؛ " + (task.rewardAvailable ? "قابل بررسی عضویت" : "پاداش غیرفعال") + ")");
        const del = el("button", "btn-del", "✕");
        del.type = "button";
        del.setAttribute("aria-label", "حذف مأموریت " + task.title);
        del.addEventListener("click", async () => {
          if (!window.confirm("این مأموریت برای همه کاربران غیرفعال شود؟")) return;
          del.disabled = true;
          try {
            await doAdmin("archive", { id: task.id });
            popup("ثبت شد", "مأموریت برای همه کاربران غیرفعال شد.", "✅");
            await renderAdmin();
          } catch (e) {
            popup("خطای سرور", String(e.message || e), "⚠️");
            del.disabled = false;
          }
        });
        row.append(text, del);
        list.append(row);
      }
    } catch {
      list.replaceChildren(el("p", "", "ارتباط با سرور مأموریت‌ها برقرار نیست؛ چیزی منتشر یا حذف نشده است."));
      const retry=el("button","btn-tool","🔄 تلاش دوباره");
      retry.type="button";retry.addEventListener("click",renderAdmin);
      list.append(retry);
    }
  }

  function wireAdminCredit() {
    const target = document.getElementById("target-user-id");
    const amount = document.getElementById("target-coin-amount");
    const button = document.getElementById("admin-credit-submit");
    const status = document.getElementById("admin-credit-status");
    if (!target || !amount || !button || !status) return;
    const digits = value => value.trim().replace(/[۰-۹]/g, c => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)))
      .replace(/[٠-٩]/g, c => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)));
    let actor;
    try { actor = String(JSON.parse(new URLSearchParams(signedInitDataCandidates()[0]).get("user")).id); }
    catch { status.textContent = "برای واریز، برنامه را از ربات اصلی باز کن."; return; }
    // This ID only scopes the saved retry; server independently authenticates the actor.
    const key = "simab_admin_credit_pending_v1:" + actor;
    let pending = null, busy = false, storageReady = true;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        pending = JSON.parse(raw);
        if (!pending || typeof pending.requestId !== "string" || typeof pending.targetUserId !== "string" ||
            !Number.isSafeInteger(pending.amount)) throw Error("invalid pending");
      }
    } catch { storageReady = false; status.textContent = "ذخیره درخواست قابل خواندن نیست؛ برای جلوگیری از واریز تکراری، عملیات متوقف شد."; }
    function paint() {
      target.disabled = amount.disabled = busy || !!pending || !storageReady;
      button.disabled = busy || !storageReady;
      button.textContent = busy ? "در حال ثبت واریز…" : pending ? "پیگیری همان واریز قبلی" : "افزودن سکه به کاربر";
      if (pending) { target.value = pending.targetUserId; amount.value = String(pending.amount); }
    }
    if (pending) status.textContent = "یک واریز پاسخ قطعی ندارد؛ با دکمه پیگیری، همان درخواست را بررسی کن.";
    window.transferCoinsDirect = async () => {
      if (busy || !storageReady) return;
      if (!pending) {
        const id = digits(target.value), rawAmount = digits(amount.value), value = Number(rawAmount);
        if (!/^[1-9][0-9]{0,15}$/.test(id) || !Number.isSafeInteger(Number(id)) ||
            !/^[0-9]+$/.test(rawAmount) || !Number.isSafeInteger(value) || value < 1 || value > 1000000000000) {
          status.textContent = "آیدی عددی معتبر و تعداد سکه صحیح از ۱ تا ۱٬۰۰۰٬۰۰۰٬۰۰۰٬۰۰۰ وارد کن."; return;
        }
        const createId=window.SimabWallet?.requestId || globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
        if (!createId) { status.textContent = "مرورگر امکان ساخت درخواست امن ندارد."; return; }
        if (!window.confirm("افزودن " + value.toLocaleString("fa-IR") + " سکه به آیدی " + id + " تأیید شود؟")) return;
        const next = {targetUserId: id, amount: value, requestId: createId()};
        try { localStorage.setItem(key, JSON.stringify(next)); }
        catch { status.textContent = "ذخیره درخواست ممکن نیست؛ واریزی ارسال نشد."; return; }
        pending = next;
      }
      busy = true; paint(); status.textContent = "در حال ثبت در کیف پول سروری…";
      try {
        const result = await doAdmin("admin_credit", pending);
        if (result.serverWallet !== true || result.targetUserId !== pending.targetUserId ||
            result.requestId !== pending.requestId || result.amount !== pending.amount || !Number.isSafeInteger(result.coins))
          throw Error("پاسخ سرور قابل تأیید نیست.");
        localStorage.removeItem(key);
        pending = null;
        status.textContent = (result.duplicate ? "این واریز قبلاً ثبت شده؛ دوباره اضافه نشد. " : "واریز ثبت شد. ") +
          "آیدی: " + result.targetUserId + "؛ مبلغ: " + result.amount.toLocaleString("fa-IR") +
          " سکه؛ موجودی پس از واریز: " + result.coins.toLocaleString("fa-IR") + " سکه. کد پیگیری: " + result.requestId;
        amount.value = "";
      } catch (error) {
        if (error.definitive) {
          try { localStorage.removeItem(key); pending = null; } catch { /* keep retry locked */ }
        }
        status.textContent = error.message + (pending ? " برای جلوگیری از واریز تکراری، فقط همان درخواست را پیگیری کن." : " واریزی ثبت نشد.");
      } finally { busy = false; paint(); }
    };
    paint();
  }

  if (isAdmin) {
    wireAdminCredit();
    const DRAFT_KEY = "simab_central_quest_drafts_v2";
    const getDrafts = () => {
      try {
        const drafts = JSON.parse(localStorage.getItem(DRAFT_KEY) || "[]");
        return Array.isArray(drafts) ? drafts.slice(0,20) : [];
      } catch { return []; }
    };
    const storeDrafts = arr => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(arr.slice(0,20))); return true; }
      catch { return false; }
    };
    function renderDrafts() {
      const list = document.getElementById("quest-drafts-list");
      if (!list) return;
      list.replaceChildren();
      const drafts = getDrafts();
      if (!drafts.length) return;
      list.append(el("p", "", "📝 پیش‌نویس‌های منتشرنشده:"));
      drafts.forEach((item,index) => {
        const row = el("div","custom-task-item");
        const title = el("span","",item.title);
        const restore = el("button","btn-tool","ویرایش");
        restore.type="button";
        restore.addEventListener("click",()=>{
          document.getElementById("task-title").value=item.title||"";
          document.getElementById("task-url").value=item.url||"";
          document.getElementById("task-reward").value=item.rewardCoins??0;
          document.getElementById("task-timer").value=String(item.timerSeconds||20);
          popup("پیش‌نویس بارگذاری شد","برای انتشار دکمه ثبت مرکزی را بزن.","📝");
        });
        const del=el("button","btn-del","حذف");
        del.type="button";
        del.addEventListener("click",()=>{const items=getDrafts();items.splice(index,1);storeDrafts(items);renderDrafts();});
        row.append(title,restore,del);
        list.append(row);
      });
    }
    window.simabSaveQuestDraft = () => {
      const task = {
        title:document.getElementById("task-title")?.value?.trim()||"",
        url:document.getElementById("task-url")?.value?.trim()||"",
        rewardCoins:Number(document.getElementById("task-reward")?.value),
        timerSeconds:Number(document.getElementById("task-timer")?.value),
      };
      if (!task.title || !task.url) { popup("ناقص","عنوان و لینک را وارد کن.","⚠️");return; }
      const items=getDrafts();items.unshift(task);
      if (storeDrafts(items)) {
        renderDrafts();
        popup("ذخیره شد","پیش‌نویس روی همین دستگاه ذخیره شد؛ هنوز عمومی نیست.","💾");
      } else popup("ذخیره نشد","فضای ذخیره کافی نیست.","⚠️");
    };
    window.simabCheckMissionsConnection = async () => {
      const label = document.getElementById("quest-server-status");
      if(label) label.textContent="در حال بررسی سرور و ربات...";
      try {
        const res=await fetch(endpoint+"?health=1",{method:"GET",cache:"no-store"});
        const h=await res.json().catch(()=>({}));
        if(!res.ok || !h.ok) throw Error("نسخه جدید تابع Supabase هنوز مستقر نشده یا در دسترس نیست.");
        if(!h.botMatchesExpected) {
          if(label) label.textContent="⚠️ توکن ذخیره‌شده در Supabase متعلق به "+String(h.botUsername||"ربات دیگری")+" است، نه @SimorApp_bot. توکن را اینجا ارسال نکن.";
          return;
        }
        if(label) label.textContent="✅ ربات "+h.botUsername+" تأیید شد؛ در حال بررسی امضای مدیر...";
        try {
          await doAdmin("ping",{});
          if(label) label.textContent="✅ سرور، امضای ورود و مجوز مدیریت تأیید شدند. "+(h.channelBotIsAdmin ?
            "✅ ربات مدیر کانال رسمی @SimorApp است؛ امکان بررسی عضویت فعال است." :
            "⚠️ ربات هنوز مدیر کانال رسمی @SimorApp نیست؛ دریافت جایزه و ارسال کانال غیرفعال است.");
        } catch(e) {
          if(label) label.textContent="⚠️ اتصال برقرار است، اما اجازه مدیریت تأیید نشد: "+String(e.message||e);
        }
      } catch(e) {
        if(label) label.textContent="❌ "+String(e.message||e);
      }
    };
    window.simabFillOfficialChannelQuest = () => {
      document.getElementById("task-title").value = "عضویت در کانال رسمی سیماب";
      document.getElementById("task-url").value = officialChannelUrl;
      document.getElementById("task-reward").value = "1";
      document.getElementById("task-timer").value = "20";
      popup("آماده انتشار", "مأموریت رسمی با پاداش آزمایشی ۱ سکه آماده شد. برای انتشار دکمه ثبت مرکزی را بزن.", "📢");
    };
    renderDrafts();
    window.simabCheckMissionsConnection();
    window.saveCustomTask = async () => {
      const title = document.getElementById("task-title")?.value?.trim() || "";
      const inputUrl = document.getElementById("task-url")?.value?.trim() || "";
      const reward = Number(document.getElementById("task-reward")?.value);
      const timer = Number(document.getElementById("task-timer")?.value);
      let url;
      try { url = new URL(inputUrl); }
      catch { popup("ورودی اشتباه", "نشانی معتبر https لازم است.", "⚠️"); return; }
      if (title.length < 3 || title.length > 100 || url.protocol !== "https:" ||
          url.username || url.password || !Number.isSafeInteger(reward) ||
          reward < 0 || reward > 10000 || !Number.isSafeInteger(timer) || timer < 5 || timer > 120) {
        popup("ورودی اشتباه", "عنوان ۳ تا ۱۰۰ حرف، نشانی امن و پاداش ۰ تا ۱۰هزار لازم است.", "⚠️");
        return;
      }
      const save = [...document.querySelectorAll("button")].find(x => x.getAttribute("onclick") === "saveCustomTask()");
      if (save) save.disabled = true;
      try {
        await doAdmin("create", {
          task: {
            title, url: url.href, rewardCoins: reward, timerSeconds: timer,
            verificationMode: url.hostname==='t.me' ? "telegram_membership" : "external_visit",
          },
        });
        document.getElementById("task-title").value = "";
        document.getElementById("task-url").value = "";
        document.getElementById("task-reward").value = "";
        popup("منتشر شد", "مأموریت برای همه نمایش داده شد. تلگرام پس از ۵ ثانیه با بررسی عضویت؛ لینک خارجی پس از ۱۰ ثانیه با پاداش بازدید.", "✅");
        await renderAdmin();
      } catch (e) {
        popup("منتشر نشد", String(e.message || e), "⚠️");
      } finally {
        if (save) save.disabled = false;
      }
    };
    // The original button opened Telegram's share sheet; this sends from the BOT
    // only when the verified owner explicitly presses the broadcast button.
    window.shareToTelegram = async () => {
      const message = document.getElementById("broadcast-text")?.value?.trim() || "";
      if (!message || message.length > 1500) {
        popup("متن نامعتبر", "پیام باید بین ۱ تا ۱۵۰۰ حرف باشد.", "⚠️");
        return;
      }
      if (!window.confirm("پیام همین حالا از طرف ربات در کانال منتشر شود؟")) return;
      try {
        await doAdmin("broadcast", { message });
        popup("ارسال شد", "ربات پیام را در کانال منتشر کرد.", "✅");
      } catch (e) {
        popup("ارسال ناموفق", String(e.message || e) +
          " — بررسی کن ربات مدیر کانال باشد و تنظیم SIMAB_TELEGRAM_CHANNEL ثبت شده باشد.", "⚠️");
      }
    };
    // Old local-only delete and render handlers are intentionally replaced.
    window.renderTasks = renderAdmin;
    window.deleteTask = () => popup("تغییر لازم", "مأموریت‌ها از سرور مدیریت می‌شوند.", "🔒");
    renderAdmin();
  }

  if (isQuests) {
    // The old wait-10-seconds flow does NOT prove channel membership.
    // Keep links working; stop falsely asserting verification or minting local coins.
    window.handleQuest = (key) => {
      const urls = {
        tg: officialChannelUrl,
        insta: "https://instagram.com/Alihosseiniv",
      };
      const target = urls[key];
      if (!target) return;
      try {
        if (key === "tg" && window.Telegram?.WebApp?.openTelegramLink)
          window.Telegram.WebApp.openTelegramLink(target);
        else window.open(target, "_blank", "noopener,noreferrer");
      } catch { /* opening is best-effort */ }
      popup("", "لینک باز شد؛ فقط مأموریت مرکزی کانال، پس از تأیید عضویت واقعی توسط سرور، می‌تواند جایزه بدهد.");
    };
    window.claimQuestReward = () => popup("", "بدون تأیید سرور نمی‌توان پاداش مأموریت را پرداخت کرد.");
    for (const key of ["tg", "insta"]) {
      const rewardLabel = document.querySelector("#card-quest-" + key + " .quest-reward");
      const button = document.getElementById("btn-quest-" + key);
      if (rewardLabel) rewardLabel.textContent = "پاداش پس از تأیید سرور";
      if (button) {
        button.disabled = false;
        button.className = "btn-quest-action";
        button.textContent = "باز کردن لینک ←";
      }
      const card = document.getElementById("card-quest-" + key);
      if (card) card.classList.remove("completed");
    }
    const progress = document.getElementById("progress-text");
    if (progress) progress.textContent = "تسک‌های فعال توسط مدیر منتشر می‌شوند";
    const bar = document.getElementById("progress-bar");
    if (bar) bar.style.width = "0%";
    const parent = document.getElementById("quests-container");parent.replaceChildren();
    // Verified reward balance is separate from legacy browser/CloudStorage coins.
    const verifiedCard = el("div","quest-card");
    verifiedCard.style.cssText = "display:block;margin:10px 0;padding:14px;border-color:#b58a37";
    const verifiedTitle=el("div","quest-title","🔐 سکه‌های تأییدشده در سرور");
    const verifiedValue=el("div","quest-reward","در حال بررسی...");
    const verifiedNote=el("small","","این همان موجودی مشترک خانه، صرافی، پوکر، رول و تخته‌نرد است.");
    verifiedNote.style.cssText="display:block;line-height:1.8;margin-top:8px;opacity:.85";
    verifiedCard.append(verifiedTitle,verifiedValue,verifiedNote);
    parent.after(verifiedCard);
    let claimedIds=new Set();
    async function loadVerifiedWallet(){
      try{
        const v=await doAdmin("my_rewards",{});
        verifiedValue.textContent=Number(v.verifiedCoins||0).toLocaleString("fa-IR")+" سکه تأییدشده";
        claimedIds=new Set(v.claimedQuestIds||[]);
      }catch{
        verifiedValue.textContent="کیف پول سروری در دسترس نیست؛ هیچ سکه‌ای تغییر نکرده است.";
        claimedIds=new Set();
      }
    }
    const heading = el("h3", "", "📢 مأموریت‌های منتشرشده");
    heading.style.cssText = "font-size:15px;color:#f5cf62;padding:12px 4px 4px";
    const area = el("div", "");
    area.append(el("p", "", "در حال دریافت مأموریت‌ها..."));
    parent.after(heading, area);
    (async () => {
      try {
        const quests = await readPublished();
        await loadVerifiedWallet();
        verifiedNote.textContent="پاداش‌ها مستقیم به کیف پول مشترک اضافه می‌شوند؛ تلگرام با بررسی عضویت و لینک‌های دیگر با مهلت بازدید.";
        if (quests.some(q => isOfficialChannelUrl(q.url))) {
          const staticChannelCard = document.getElementById("card-quest-tg");
          if (staticChannelCard) staticChannelCard.hidden = true;
        }
        area.replaceChildren();
        if (!quests.length) {
          area.append(el("p", "", "مأموریت مرکزی فعالی وجود ندارد."));
          return;
        }
        parent.replaceChildren();
        for(const q of quests){
          const row=el('div','quest-card'),info=el('div','quest-info'),body=el('div');
          const telegram=q.verificationMode==='telegram_membership',seconds=telegram?5:10;
          body.append(el('div','quest-title',q.title),el('div','quest-reward',q.rewardCoins+' سکه • '+(telegram?'تأیید عضویت تلگرام پس از ۵ ثانیه':'پاداش بازدید پس از ۱۰ ثانیه؛ عضویت یا دنبال‌کردن قابل تأیید خودکار نیست')));info.append(body);
          const visit=el('button','btn-quest-action','باز کردن لینک و شروع'),claim=el('button','btn-quest-action','ابتدا لینک را باز کن');let readyAt=0;claim.disabled=true;
          function tick(){if(claimedIds.has(q.id)){claim.disabled=true;claim.textContent='✓ قبلاً دریافت شد';return;}const left=Math.max(0,Math.ceil((readyAt-Date.now())/1000));claim.disabled=!readyAt||left>0;claim.textContent=!readyAt?'ابتدا لینک را باز کن':left?'دریافت تا '+left+' ثانیه دیگر':telegram?'بررسی عضویت و دریافت':'دریافت سکه';}
          visit.onclick=async()=>{visit.disabled=true;try{const r=await doAdmin('task_start',{questId:q.id});readyAt=Date.now()+Math.max(0,new Date(r.readyAt)-new Date(r.serverNow));const target=new URL(q.url);if(target.hostname==='t.me'&&window.Telegram?.WebApp?.openTelegramLink)Telegram.WebApp.openTelegramLink(target.href);else if(window.Telegram?.WebApp?.openLink)Telegram.WebApp.openLink(target.href);else window.open(target.href,'_blank','noopener');tick();}catch(e){popup('شروع تسک',e.message);}finally{visit.disabled=false;}};
          claim.onclick=async()=>{claim.disabled=true;try{const r=await doAdmin('claim',{questId:q.id});claimedIds.add(q.id);await loadVerifiedWallet();window.SimabWallet?.refresh();popup('ثبت پاداش',r.granted?q.rewardCoins+' سکه به کیف پول اضافه شد.':'قبلاً دریافت شده است.','✅');}catch(e){popup('پاداش ثبت نشد',e.message);}finally{tick();}};
          setInterval(tick,500);tick();row.append(info,visit,claim);area.append(row);
        }
      } catch {
        area.replaceChildren(el("p", "", "دریافت مأموریت‌های مرکزی فعلاً در دسترس نیست."));
        const retry=el("button","btn-quest-action","🔄 تلاش دوباره");
        retry.type="button";retry.addEventListener("click",()=>location.reload());
        area.append(retry);
      }
    })();
  }
})();