import test from 'node:test';
import assert from 'node:assert/strict';
import {localeContext} from './support/i18n-inventory-v22.mjs';

const sources=[
 ['error.telegramIncomplete','اطلاعات ورود تلگرام ناقص است. مینی‌اپ را از دکمه ربات باز کن؛ در صورت تکرار، نحوه راه‌اندازی را بررسی می‌کنیم.'],
 ['error.creditWalletLimit','این مبلغ از سقف موجودی کیف پول بیشتر می‌شود.'],
 ['error.creditAdminOnly','مجوز مدیریت این حساب تأیید نشد.'],
 ['confirm.archiveQuest','این مأموریت برای همه کاربران غیرفعال شود؟'],
 ['confirm.reconcileRefund','ماندهٔ سکهٔ خرید برگشتی از موجودی همین کاربر کسر شود؟'],
 ['admin.channelRegistered','کانال بررسی و ثبت شد.'],
 ['confirm.closeWaitingRoom','از میز قبلی خارج شوی؟ ورودی‌ها طبق قوانین همان میز برمی‌گردند.'],
 ['confirm.closePlayingRoom','بازی قبلی شروع شده؛ خروج ممکن است سهم ورودی را واگذار کند. ادامه؟'],
 ['error.inviteUnavailable','دعوت پیدا نشد یا دیگر در دسترس نیست؛ کد دیگری وارد کن.']
];
for(const lang of ['en','fa','ru','ar','hi','fr','de'])test('targeted UI sources and contextual Backgammon keys: '+lang,()=>{
 const x=localeContext(lang);
 for(const [key,source] of sources){assert.equal(x.SimabI18n.sourceKey(source),key);assert.equal(x.SimabI18n.t(source),x.SimabI18n.key(key));if(lang!=='fa')assert.notEqual(x.SimabI18n.key(key),source);}
 // Keep the old navigation alias; bearing off must use its explicit context.
 assert.equal(x.SimabI18n.sourceKey('خروج'),'nav.exit');
 assert.notEqual(x.SimabI18n.key('board.off'),x.SimabI18n.key('nav.exit'));
 const label=x.SimabI18n.key('backgammon.moveAction',{source:'24',destination:x.SimabI18n.key('board.off'),number:'6'});
 assert.ok(label.includes(x.SimabI18n.key('board.off')));if(lang!=='fa')assert.ok(!label.includes(x.SimabI18n.key('nav.exit')));
 assert.deepEqual([...x.SimabI18n.missing],[]);
});
