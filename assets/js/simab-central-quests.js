/* SIMAB central mission catalog: no client-side coins are awarded here.
 * Admin mutations require signed Telegram initData; only the Edge Function
 * and service-role SQL account can publish/archive.
 */
(() => {
  "use strict";
  const endpoint = "https://pwjlyryrgbaprfnrieq.supabase.co/functions/v1/simab-central-quests";
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
  async function doAdmin(action, extra) {
    const initData = window.Telegram?.WebApp?.initData || "";
    if (!initData) throw new Error("برای انتشار باید نسخه را با حساب مدیر در تلگرام باز کنی.");
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ initData, action, ...extra }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(
      r.status === 401 ? "ورود تلگرام منقضی یا نامعتبر است؛ مینی‌اپ را ببند و دوباره باز کن." :
      r.status === 403 ? "این حساب از سمت سرور مجوز مدیریت ندارد." :
      "ثبت سروری انجام نشد (HTTP " + r.status + ")."
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
    }
  }

  if (isAdmin) {
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
            verificationMode: /^https:\/\/t\.me\//i.test(url.href) ? "telegram_membership" : "external_visit",
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
      if (button && !button.disabled) button.textContent = "باز کردن لینک ←";
    }
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
      }
    })();
  }
})();