/* SIMAB central mission catalog: no client-side coins are awarded here.
 * Admin mutations require signed Telegram initData; only the Edge Function
 * and service-role SQL account can publish/archive.
 */
(() => {
  "use strict";
  const endpoint = "https://pwjlyryrrgbaprfnrieq.supabase.co/functions/v1/simab-central-quests";
  const isAdmin = Boolean(document.getElementById("tasks-list"));
  const isQuests = Boolean(document.getElementById("quests-container"));
  if (!isAdmin && !isQuests) return;

  const currentTasks = new Map();
  const popup = (title, message, icon = "ℹ️") => {
    if (isAdmin && typeof window.showPopup === "function") window.showPopup(title, message, icon);
    else if (typeof window.showToast === "function") window.showToast(message);
  };
  async function readPublished() {
    const r = await fetch(endpoint, { method: "GET", cache: "no-store", headers: { accept: "application/json" } });
    if (!r.ok) throw new Error("catalog_" + r.status);
    const json = await r.json();
    if (!Array.isArray(json.quests)) throw new Error("invalid_catalog");
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
    if (!r.ok) throw new Error(
      r.status === 401 ? (
        j.reason === "expired" ? "امضای ورود تلگرام بیش از یک ساعت قدیمی است. مینی‌اپ را مجدداً از ربات باز کن." :
        j.reason === "clock_mismatch" ? "زمان ورود تلگرام نامعتبر است؛ ساعت گوشی را بررسی کن." :
        j.reason === "signature_mismatch" ? "امضای ورود با روش‌های رسمی تأیید نشد؛ باید منبع باز شدن مینی‌اپ بررسی شود." :
        j.reason === "missing_fields" ? "اطلاعات امضاشده تلگرام ناقص است؛ از دکمه مینی‌اپ ربات باز کن." :
        describeTelegram401(used)
      ) :
      r.status === 403 ? "شناسه این حساب در فهرست مدیران سرور وجود ندارد." :
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
        const text = el("span", "", task.title + " (پاداش پیشنهادی: " + task.rewardCoins + " سکه — هنوز غیرفعال)");
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

  if (isAdmin) {
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
          if(label) label.textContent="✅ سرور، امضای ورود و مجوز مدیریت تأیید شدند."+(h.channelConfigured?"":" ارسال کانال تا تنظیم کانال ربات غیرفعال است.");
        } catch(e) {
          if(label) label.textContent="⚠️ اتصال برقرار است، اما اجازه مدیریت تأیید نشد: "+String(e.message||e);
        }
      } catch(e) {
        if(label) label.textContent="❌ "+String(e.message||e);
      }
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
          reward < 0 || reward > 10000 || !Number.isSafeInteger(timer) || timer < 10 || timer > 120) {
        popup("ورودی اشتباه", "عنوان ۳ تا ۱۰۰ حرف، نشانی امن و پاداش ۰ تا ۱۰هزار لازم است.", "⚠️");
        return;
      }
      const save = [...document.querySelectorAll("button")].find(x => x.getAttribute("onclick") === "saveCustomTask()");
      if (save) save.disabled = true;
      try {
        await doAdmin("create", {
          task: {
            title, url: url.href, rewardCoins: reward, timerSeconds: timer,
            verificationMode: /^https:\/\/t\.me\//i.test(url.href) && !url.pathname.toLowerCase().endsWith("bot") ? "telegram_membership" : "external_visit",
          },
        });
        document.getElementById("task-title").value = "";
        document.getElementById("task-url").value = "";
        document.getElementById("task-reward").value = "";
        popup("منتشر شد", "مأموریت برای همه کاربران نمایش داده می‌شود؛ پرداخت پاداش تا راه‌اندازی تأیید سروری غیرفعال است.", "✅");
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
        tg: "https://t.me/SimorApp_bot",
        insta: "https://instagram.com/Alihosseiniv",
      };
      const target = urls[key];
      if (!target) return;
      try {
        if (key === "tg" && window.Telegram?.WebApp?.openTelegramLink)
          window.Telegram.WebApp.openTelegramLink(target);
        else window.open(target, "_blank", "noopener,noreferrer");
      } catch { /* opening is best-effort */ }
      popup("", "لینک باز شد؛ تأیید عضویت و پرداخت پاداش هنوز در سرور فعال نیست.");
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
    if (progress) progress.textContent = "تأیید مأموریت‌ها پس از راه‌اندازی سرور";
    const bar = document.getElementById("progress-bar");
    if (bar) bar.style.width = "0%";
    const parent = document.getElementById("quests-container");
    const heading = el("h3", "", "📢 مأموریت‌های منتشرشده");
    heading.style.cssText = "font-size:15px;color:#f5cf62;padding:12px 4px 4px";
    const area = el("div", "");
    area.append(el("p", "", "در حال دریافت مأموریت‌ها..."));
    parent.after(heading, area);
    (async () => {
      try {
        const quests = await readPublished();
        area.replaceChildren();
        if (!quests.length) {
          area.append(el("p", "", "مأموریت مرکزی فعالی وجود ندارد."));
          return;
        }
        for (const q of quests) {
          const row = el("div", "quest-card");
          const info = el("div", "quest-info");
          const art = el("div", "quest-icon-box", "🎯");
          const body = el("div", "");
          body.append(el("div", "quest-title", q.title),
                      el("div", "quest-reward", "پاداش پیشنهادی: " + q.rewardCoins + " سکه (پس از تأیید سرور)"));
          info.append(art, body);
          const btn = el("button", "btn-quest-action", "مشاهده ←");
          btn.type = "button";
          btn.addEventListener("click", () => {
            try {
              const target = new URL(q.url);
              if (target.protocol !== "https:") return;
              if (target.hostname === "t.me" && window.Telegram?.WebApp?.openTelegramLink)
                window.Telegram.WebApp.openTelegramLink(target.href);
              else window.open(target.href, "_blank", "noopener,noreferrer");
            } catch { /* ignore invalid remote URL */ }
          });
          row.append(info, btn);
          area.append(row);
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