import assert from 'node:assert/strict';

// Exercise production functions via server-injected, test-only closure hooks.
// Every HTTP response is synthetic. Confirmed actions below use a fake wallet
// transport, never a database or production service.
export async function runTargetedI18n(page,origin){
 const languages=['en','fa','ru','ar','hi','fr','de'],results={};let checks=0;
 const open=async path=>{await page.goto(origin+'/'+path);await page.evaluate(()=>window.SimabI18nReady);};
 const expected=(key,values={})=>page.evaluate(({key,values})=>SimabI18n.key(key,values),{key,values});
 const dialogs=[];let acceptDialog=false;
 page.removeAllListeners('dialog');page.on('dialog',dialog=>{dialogs.push(dialog.message());return acceptDialog?dialog.accept():dialog.dismiss();});
 let response={status:500,body:{}};const posts=[];
 await page.route('**/functions/v1/simab-central-quests',route=>{
  const request=route.request(),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*'};
  if(request.method()==='GET')return route.fallback();
  if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
  posts.push(request.postDataJSON());return route.fulfill({status:response.status,headers,json:response.body});
 });
 await open('admin/index.html');await page.waitForFunction(()=>window.__questUI&&window.__shopUI);
 await page.locator('#tasks-list .quest-title').waitFor();await page.locator('#task-title').fill('Home');
 await page.evaluate(()=>{
  window.__targetedCalls=[];window.__originalRead=SimabWallet.read;
  SimabWallet.read=async(action,data)=>{
   if(action==='admin_shop_status'){const r=await __originalRead(action,data);return {...r,refunds:[{id:'refund-fixture',telegram_subject:'Home',unrecovered_coins:5}]};}
   if(action==='admin_register_channel'||action==='admin_reconcile_refund'){__targetedCalls.push({action,data});return {remaining:2};}
   return __originalRead(action,data);
  };
 });
 await page.evaluate(()=>__shopUI.refresh());
 const wallet=await page.evaluate(()=>JSON.stringify(SimabWallet.state));
 const creditCases=[
  ['invalid_target',400,'error.creditTarget'],['invalid_credit_amount',400,'error.creditAmount'],
  ['wallet_limit',400,'error.creditWalletLimit'],['request_conflict',409,'error.creditConflict'],
  ['admin_only',403,'error.creditAdminOnly'],['admin_credit_unavailable',503,'error.creditUnavailable'],
  ['telegram_auth_failed',401,'error.creditAuth'],['unexpected_error',500,'error.creditStatus']
 ];
 const generalCases=[
  [401,{reason:'expired'},'error.telegramExpired'],[401,{reason:'clock_mismatch'},'error.telegramClock'],
  [401,{reason:'signature_mismatch'},'error.telegramSignature'],[401,{reason:'missing_fields'},'error.telegramFields'],
  [401,{},'error.telegramIncomplete'],[403,{error:'channel_membership_required'},'error.questMembership'],
  [403,{},'error.questAccess'],[409,{},'error.questPayment'],
  [503,{error:'channel_bot_not_admin'},'error.questBotAdmin'],[503,{},'error.questServerUnavailable'],
  [500,{},'error.questHttp']
 ];
 for(const lang of languages){
  results[lang]={checks:0};const mark=()=>{checks++;results[lang].checks++;};
  await page.evaluate(lang=>SimabI18n.setLanguage(lang),lang);
  assert.equal(await page.locator('html').getAttribute('dir'),['fa','ar'].includes(lang)?'rtl':'ltr');
  for(const [kind,key] of [['missing','error.telegramIncomplete'],['old','error.telegramOld'],['future','error.telegramFuture'],['fresh','error.telegramSignatureReview'],['invalid','error.telegramValidation']]){
   const actual=await page.evaluate(kind=>{const now=Math.floor(Date.now()/1000),when=now+(kind==='old'?-3601:kind==='future'?60:0);return __questUI.describeTelegram401(kind==='missing'?'':kind==='invalid'?Symbol('invalid'):new URLSearchParams({auth_date:String(when),user:'fixture',hash:'fixture'}).toString());},kind);
   assert.equal(actual,await expected(key));mark();
  }
  await page.evaluate(()=>{Telegram.WebApp.initData='';sessionStorage.removeItem('simab_signed_launch_init_data_v1');});
  const beforeMissing=posts.length;
  const missing=await page.evaluate(async()=>{try{await __questUI.doAdmin('ping',{});return null;}catch(e){return e.message;}});
  assert.equal(missing,await expected('error.telegramSignedMissing'));assert.equal(posts.length,beforeMissing);mark();
  await page.evaluate(()=>{Telegram.WebApp.initData='invalid-test-only';});
  for(const [error,status,key] of creditCases){
   response={status,body:{error}};
   const actual=await page.evaluate(async()=>{try{await __questUI.doAdmin('admin_credit',{target:'801000011',amount:7,requestId:'fixture-request'});return null;}catch(e){return {message:e.message,definitive:e.definitive};}});
   assert.equal(actual.message,await expected(key,{status}));assert.equal(actual.definitive,[400,401,403,409,413].includes(status));
   assert.deepEqual(posts.at(-1),{initData:'invalid-test-only',action:'admin_credit',target:'801000011',amount:7,requestId:'fixture-request'});mark();
  }
  for(const [status,body,key] of generalCases){
   response={status,body};
   const actual=await page.evaluate(async()=>{try{await __questUI.doAdmin('ping',{});return null;}catch(e){return e.message;}});
   assert.equal(actual,await expected(key,{status}));mark();
  }
  // Actual archive and refund controls: cancellation must send no mutation.
  const beforeArchive=posts.length;await page.locator('#tasks-list .btn-del').click();
  assert.equal(dialogs.at(-1),await expected('confirm.archiveQuest'));assert.equal(posts.length,beforeArchive);mark();
  assert.equal(await page.locator('#refund-review span').innerText(),await expected('admin.refundReviewRow',{subject:'Home',number:5}));
  assert.equal(await page.locator('#refund-review button').innerText(),await expected('admin.reconcileRefund'));mark();
  const beforeRefund=await page.evaluate(()=>__targetedCalls.length);await page.locator('#refund-review button').click();
  assert.equal(dialogs.at(-1),await expected('confirm.reconcileRefund'));assert.equal(await page.evaluate(()=>__targetedCalls.length),beforeRefund);mark();
  acceptDialog=true;await page.locator('#refund-review button').click();acceptDialog=false;
  await page.waitForFunction(()=>document.getElementById('shop-admin-message').textContent===SimabI18n.key('admin.refundRemaining',{number:2}));
  assert.deepEqual(await page.evaluate(()=>__targetedCalls.at(-1)),{action:'admin_reconcile_refund',data:{orderId:'refund-fixture'}});mark();
  await page.locator('#channel-id').fill('@Home');await page.locator('#channel-register').click();
  await page.waitForFunction(()=>document.getElementById('shop-admin-message').textContent===SimabI18n.key('admin.channelRegistered'));
  assert.deepEqual(await page.evaluate(()=>__targetedCalls.at(-1)),{action:'admin_register_channel',data:{channel:'@Home'}});mark();
  assert.equal(await page.locator('#task-title').inputValue(),'Home');assert.equal(await page.locator('#tasks-list .quest-title').innerText(),'Home');
  assert.equal(await page.evaluate(()=>JSON.stringify(SimabWallet.state)),wallet);assert.deepEqual(await page.evaluate(()=>__writes),[]);mark();
 }
 await page.unroute('**/functions/v1/simab-central-quests');
 await open('games/room/index.html?game=backgammon');
 await page.evaluate(()=>{
  window.__roomReads=SimabWallet.read;window.__priorStatus='waiting';
  SimabWallet.read=async(action,data)=>{
   if(action==='game_room'&&data?.op==='state'&&data.code==='MISSINGCODE')throw Object.assign(Error('fixture'),{code:'room_not_found'});
   if(action==='game_room'&&data?.op==='state'&&data.code==='ROOMCODE')return {room:{status:__priorStatus},version:37};
   return __roomReads(action,data);
  };
 });
 for(const lang of languages){
  const mark=()=>{checks++;results[lang].checks++;};await page.evaluate(lang=>{__i18nGame.resetRoom();SimabI18n.setLanguage(lang);},lang);
  for(const [status,key] of [['waiting','confirm.closeWaitingRoom'],['playing','confirm.closePlayingRoom']]){
   await page.evaluate(async status=>{window.__priorStatus=status;await __i18nGame.closeExisting({game:'backgammon',code:'ROOMCODE'});},status);
   assert.equal(dialogs.at(-1),await expected(key));assert.deepEqual(await page.evaluate(()=>__writes),[]);mark();
  }
  await page.locator('#join-code').fill('KEEPDRAFT');
  await page.evaluate(async()=>{window.__missingInvite=true;__i18nGame.setCode('MISSINGCODE');await __i18nGame.load();window.__missingInvite=false;});
  assert.equal(await page.locator('#status').innerText(),await expected('error.inviteUnavailable'));
  assert.equal(await page.locator('#join-code').inputValue(),'KEEPDRAFT');assert.ok(!page.url().includes('code='));mark();
  // Legal bear-off fixture, selection through the actual board, no move sent.
  await page.evaluate(()=>{const s=SimabPracticeRules.startParty('backgammon',2,0),t=s.table;t.points=Array(24).fill(0);t.points[0]=1;t.points[23]=-15;t.bar=[0,0];t.off=[14,0];t.moves=[{from:0,to:-1,die:1}];t.dice=[1];t.turn=0;t.opening=null;s.current=0;__i18nGame.setPractice(s);});
  const state=await page.evaluate(()=>JSON.stringify(__i18nGame.latest.state));
  await page.locator('.bg-point').filter({has:page.locator('.bg-checker.ivory')}).click();
  const label=await page.locator('#arena .controls button').innerText();
  assert.equal(label,await expected('backgammon.moveAction',{source:await page.evaluate(()=>SimabI18n.number(1)),destination:await expected('board.off'),number:1}));
  assert.equal(await page.evaluate(()=>JSON.stringify(__i18nGame.latest.state)),state);assert.deepEqual(await page.evaluate(()=>__writes),[]);mark();
  for(const next of [languages[(languages.indexOf(lang)+1)%languages.length],lang]){
   await page.evaluate(next=>SimabI18n.setLanguage(next),next);
   assert.equal(await page.locator('#arena .controls button').innerText(),await expected('backgammon.moveAction',{source:await page.evaluate(()=>SimabI18n.number(1)),destination:await expected('board.off'),number:1}));
   assert.equal(await page.evaluate(()=>JSON.stringify(__i18nGame.latest.state)),state);
  }mark();
  // Explicit markup must win on its first scan, not only after a binding exists.
  await page.evaluate(()=>{const probe=document.createElement('button');probe.id='context-probe';probe.dataset.i18n='board.off';probe.textContent='خروج';document.body.append(probe);SimabI18n.setLanguage(SimabI18n.lang);});
  assert.equal(await page.locator('#context-probe').innerText(),await expected('board.off'));
  assert.equal(await page.locator('#context-probe').getAttribute('data-i18n'),'board.off');
  assert.equal(await page.evaluate(()=>SimabI18n.sourceKey('خروج')),'nav.exit');await page.locator('#context-probe').evaluate(el=>el.remove());mark();
 }
 await open('games/backgammon/index.html');
 for(const lang of languages){
  await page.evaluate(lang=>SimabI18n.setLanguage(lang),lang);
  assert.equal(await page.locator('#bg-off').textContent(),await expected('backgammon.bearOff'));
  assert.equal(await page.locator('#bg-off').getAttribute('data-i18n'),'backgammon.bearOff');
  assert.deepEqual(await page.evaluate(()=>__writes),[]);checks++;results[lang].checks++;
 }
 return {checks,languages:results};
}
