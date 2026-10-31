import assert from 'node:assert/strict';

// Real admin-shop handlers with a disposable in-page transport. No request from
// a successful mutation is allowed to reach an HTTP service or database.
export async function runShopAdminI18n(page,origin){
 const languages=['en','fa','ru','ar','hi','fr','de'],results={};let checks=0,accept=false;const dialogs=[];
 page.removeAllListeners('dialog');page.on('dialog',d=>{dialogs.push(d.message());return accept?d.accept():d.dismiss();});
 await page.goto(origin+'/admin/index.html');await page.evaluate(()=>window.SimabI18nReady);await page.waitForFunction(()=>window.__shopUI);
 await page.evaluate(async()=>{
  const base=await SimabWallet.read('admin_shop_status');window.__shopCalls=[];
  window.__shopFixture={...base,webhookConflict:false,webhookHost:'Wallet',webhookFingerprint:'fingerprint-Home',enabled:false,webhookBound:false,refunds:[],
   channels:['Home','Wallet','<b>Alice</b>','خانه','@ChannelName','Disabled'].map((title,i)=>({title,username:i===0?'Home':'',chat_id:'-1000'+i,enabled:i!==5})),
   offers:[{code:'offer-fixture',title:'Wallet',claims:1,max_claims:20}]};
  SimabWallet.read=async(action,data)=>{
   if(action==='admin_shop_status')return structuredClone(__shopFixture);
   __shopCalls.push({action,data});
   if(action==='admin_shop_settings'){__shopFixture.starsPerUnit=data.starsPerUnit;__shopFixture.enabled=data.enabled;return {};}
   if(action==='admin_bind_webhook'){__shopFixture.webhookBound=true;__shopFixture.webhookConflict=false;return {};}
   if(action==='admin_create_offer'){__shopFixture.offers=__shopFixture.offers.filter(o=>o.code!=='offer-created');__shopFixture.offers.push({code:'offer-created',title:data.title,claims:0,max_claims:data.maxClaims});return {code:'offer-created'};}
   if(action==='admin_publish_offer')return {results:['sent','already_attempted','failed','unknown','not_registered'].map((status,i)=>({channel:__shopFixture.channels[i].title,status}))};
   throw Error('Unexpected synthetic shop action: '+action);
  };
  await __shopUI.refresh();
 });
 const wallet=await page.evaluate(()=>JSON.stringify(SimabWallet.state));
 const key=(id,values={})=>page.evaluate(({id,values})=>SimabI18n.key(id,values),{id,values});
 const count=()=>page.evaluate(()=>__shopCalls.length),last=()=>page.evaluate(()=>__shopCalls.at(-1));
 const click=async id=>{await page.locator('#'+id).click();await page.waitForFunction(()=>[...document.querySelectorAll('[data-shop-admin]')].every(b=>!b.disabled));};
 const message=()=>page.locator('#shop-admin-message').innerText();
 const previewKeys=['admin.offerPreviewReward','admin.offerPreviewCapacity','admin.offerPreviewHours','admin.offerPreviewCap'];
 const checkPreview=async reward=>{
  assert.deepEqual(await page.locator('#offer-preview [data-user-content]').allTextContents(),['Home','Wallet\nخانه <b>Alice</b>']);
  for(const [i,number] of [reward,3,24,reward*3].entries())assert.equal(await page.locator('#offer-preview [data-i18n="'+previewKeys[i]+'"]').innerText(),await key(previewKeys[i],{number}));
  assert.equal(await page.locator('#offer-preview b').count(),0,'user text cannot become markup');
 };
 for(const lang of languages){
  results[lang]={checks:0};const mark=()=>{checks++;results[lang].checks++;};
  await page.evaluate(async lang=>{SimabI18n.setLanguage(lang);__shopFixture.webhookBound=false;__shopFixture.enabled=false;__shopFixture.webhookConflict=false;await __shopUI.refresh();},lang);
  assert.equal(await page.locator('html').getAttribute('dir'),['fa','ar'].includes(lang)?'rtl':'ltr');
  assert.equal(await page.locator('#shop-setup-status').innerText(),await key('admin.connectionNotReady')+' '+await key('admin.salesOff'));mark();
  await page.locator('#stars-unit').fill('37');await page.locator('#shop-enabled').check();await click('shop-settings-save');
  assert.equal(await message(),await key('admin.settingsSaved'));assert.deepEqual(await last(),{action:'admin_shop_settings',data:{starsPerUnit:37,enabled:true}});mark();
  const beforeBind=await count();await click('shop-webhook-bind');
  assert.equal(dialogs.at(-1),await key('confirm.bindPayments'));assert.equal(await count(),beforeBind);mark();
  accept=true;await click('shop-webhook-bind');accept=false;
  assert.equal(await message(),await key('admin.paymentsBound'));assert.deepEqual(await last(),{action:'admin_bind_webhook',data:{}});
  assert.equal(await page.locator('#shop-setup-status').innerText(),await key('admin.connectionReady')+' '+await key('admin.salesOn'));mark();
  await page.evaluate(async()=>{__shopFixture.webhookConflict=true;await __shopUI.refresh();});
  assert.equal(await page.locator('#shop-webhook-host').innerText(),await key('admin.webhookConflict',{host:'Wallet'}));mark();
  const beforeReplace=await count();await click('shop-webhook-replace');
  assert.equal(dialogs.at(-1),await key('confirm.replaceWebhook',{host:'Wallet'}));assert.equal(await count(),beforeReplace);mark();
  accept=true;await click('shop-webhook-replace');accept=false;
  assert.equal(await message(),await key('admin.webhookReplaced'));
  assert.deepEqual(await last(),{action:'admin_bind_webhook',data:{replaceExisting:true,expectedWebhookFingerprint:'fingerprint-Home'}});
  assert.equal(await page.locator('#shop-webhook-host').innerText(),await key('admin.noExternal'));mark();
  await page.locator('#offer-picker').selectOption('');await page.locator('#shop-channels input').evaluateAll(nodes=>nodes.forEach(n=>n.checked=false));
  const beforeInvalid=await count();await click('offer-publish');assert.equal(await message(),await key('error.offerSelection'));assert.equal(await count(),beforeInvalid);mark();
  await page.locator('#offer-picker').selectOption('offer-fixture');await click('offer-publish');
  assert.equal(await message(),await key('error.offerSelection'));assert.equal(await count(),beforeInvalid);mark();
  await page.locator('#channels-select-all').click();
  assert.deepEqual(await page.locator('#shop-channels input:checked').evaluateAll(nodes=>nodes.map(n=>n.value)),['-10000','-10001','-10002','-10003','-10004']);mark();
  const beforePublish=await count();await click('offer-publish');
  assert.equal(dialogs.at(-1),await key('confirm.publishOffer',{number:5}));assert.equal(await count(),beforePublish);mark();
  accept=true;await click('offer-publish');accept=false;
  assert.deepEqual(await last(),{action:'admin_publish_offer',data:{code:'offer-fixture',channels:['-10000','-10001','-10002','-10003','-10004']}});mark();
  const statusKeys=['admin.publishSent','admin.publishAlreadyAttempted','admin.publishFailed','admin.publishUnknown','admin.publishNotRegistered'];
  assert.deepEqual(await page.locator('#shop-admin-message [data-user-content]').allTextContents(),['Home','Wallet','<b>Alice</b>','خانه','@ChannelName']);
  for(const id of statusKeys)assert.equal(await page.locator('#shop-admin-message [data-i18n="'+id+'"]').innerText(),await key(id));
  assert.equal(await page.locator('#shop-admin-message b').count(),0);mark();
  // Status labels relabel in place; channel names and action count must not change.
  const beforeSwitch=await count();await page.evaluate(next=>SimabI18n.setLanguage(next),languages[(languages.indexOf(lang)+1)%languages.length]);
  for(const id of statusKeys)assert.equal(await page.locator('#shop-admin-message [data-i18n="'+id+'"]').innerText(),await key(id));
  assert.deepEqual(await page.locator('#shop-admin-message [data-user-content]').allTextContents(),['Home','Wallet','<b>Alice</b>','خانه','@ChannelName']);
  await page.evaluate(lang=>SimabI18n.setLanguage(lang),lang);assert.equal(await count(),beforeSwitch);mark();
  await page.locator('#offer-title').fill('Home');await page.locator('#offer-message').fill('Wallet\nخانه <b>Alice</b>');
  await page.locator('#offer-reward').fill('13');await page.locator('#offer-capacity').fill('3');await page.locator('#offer-hours').fill('24');await click('offer-create');
  assert.equal(await message(),await key('admin.offerCreated'));assert.deepEqual(await last(),{action:'admin_create_offer',data:{title:'Home',message:'Wallet\nخانه <b>Alice</b>',reward:13,maxClaims:3,hours:24}});
  assert.equal(await page.locator('#offer-picker').inputValue(),'offer-created');await checkPreview(13);mark();
  const beforePreviewSwitch=await count();await page.evaluate(next=>SimabI18n.setLanguage(next),languages[(languages.indexOf(lang)+1)%languages.length]);await checkPreview(13);
  assert.equal(await page.locator('#offer-title').inputValue(),'Home');assert.equal(await page.locator('#offer-message').inputValue(),'Wallet\nخانه <b>Alice</b>');
  assert.equal(await page.locator('#offer-picker').inputValue(),'offer-created');assert.equal(await message(),await key('admin.offerCreated'));
  await page.evaluate(lang=>SimabI18n.setLanguage(lang),lang);assert.equal(await count(),beforePreviewSwitch);mark();
  await page.locator('#offer-reward').fill('0');await click('offer-create');await checkPreview(0);
  assert.deepEqual(await last(),{action:'admin_create_offer',data:{title:'Home',message:'Wallet\nخانه <b>Alice</b>',reward:0,maxClaims:3,hours:24}});mark();
  // Check both sales states with both connection states, not just the initial pair.
  for(const [enabled,webhookBound] of [[true,false],[false,true]]){
   await page.evaluate(async flags=>{Object.assign(__shopFixture,flags);await __shopUI.refresh();},{enabled,webhookBound});
   assert.equal(await page.locator('#shop-setup-status').innerText(),await key(webhookBound?'admin.connectionReady':'admin.connectionNotReady')+' '+await key(enabled?'admin.salesOn':'admin.salesOff'));mark();
  }
  assert.equal(await page.evaluate(()=>JSON.stringify(SimabWallet.state)),wallet);assert.deepEqual(await page.evaluate(()=>__writes),[]);
  const unknown=await page.evaluate(()=>SimabI18n.audit());assert.deepEqual(unknown,[]);results[lang].unknown=unknown;mark();
 }
 return {checks,languages:results};
}
