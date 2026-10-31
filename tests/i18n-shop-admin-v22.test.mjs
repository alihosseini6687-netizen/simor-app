import test from 'node:test';
import assert from 'node:assert/strict';
import {localeContext} from './support/i18n-inventory-v22.mjs';

for(const lang of ['en','fa','ru','ar','hi','fr','de'])test('admin shop owned messages and opaque templates: '+lang,()=>{
 const x=localeContext(lang);
 for(const [key,source] of [
  ['admin.settingsSaved','تنظیم قیمت و وضعیت فروش ثبت شد.'],
  ['admin.paymentsBound','اتصال دریافت پرداخت و کانال‌ها ثبت شد.'],
  ['admin.offerCreated','آفر ساخته شد؛ هنوز پیامی به کانال‌ها ارسال نشده است.'],
  ['error.offerSelection','یک آفر و حداقل یک کانال را انتخاب کن.']
 ]){assert.equal(x.SimabI18n.sourceKey(source),key);assert.equal(x.SimabI18n.t(source),x.SimabI18n.key(key));if(lang!=='fa')assert.notEqual(x.SimabI18n.key(key),source);}
 const host='Wallet <b>Home</b>',text=x.SimabI18n.key('confirm.replaceWebhook',{host});assert.ok(text.includes(host));assert.ok(!text.includes('{host}'));
 for(const key of ['admin.publishSent','admin.publishAlreadyAttempted','admin.publishFailed','admin.publishUnknown','admin.publishNotRegistered'])assert.ok(x.SimabI18n.key(key).trim()&&!x.SimabI18n.key(key).startsWith('['));
 assert.deepEqual([...x.SimabI18n.missing],[]);
});
