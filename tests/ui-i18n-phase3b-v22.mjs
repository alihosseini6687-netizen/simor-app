import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';
import {projectRoot} from './support/source.mjs';
import {startPoker,publicPoker,startBG,publicBG} from '../supabase/functions/simab-central-quests/games.ts';
import {startBJ,publicBJ} from '../supabase/functions/simab-central-quests/table-games.ts';
import {runTargetedI18n} from './support/ui-i18n-targeted-v22.mjs';
import {runShopAdminI18n} from './support/ui-i18n-shop-admin-v22.mjs';
import {runSevensI18n} from './support/ui-i18n-sevens-v22.mjs';

// Real pages and game rendering; synthetic read-only transports. No request can
// leave this harness. Admin identity below is a DOM fixture, not authorization.
const collect=process.argv.includes('--collect'),root=resolve(projectRoot),out=resolve(root,'docs/screenshots/phase3b-verified');
const wallet=`window.Telegram={WebApp:{ready(){},expand(){},onEvent(){},initDataUnsafe:{user:{id:location.pathname.includes('/admin/')?702007470:12345,first_name:'خانه',username:'Home'}},initData:''}};
window.__writes=[];window.SimabWallet={state:{coins:1000,chips:500,streakDay:1,serverUtcDate:'2026-10-29',dailyAvailable:true,wheelAvailable:true,serverWallet:true},pending:null,busy:false,ready:Promise.resolve(),subscribe(f){f(this.state)},read:async action=>{if(['admin_shop_settings','admin_bind_webhook','admin_register_channel','admin_create_offer','admin_publish_offer','admin_reconcile_refund'].includes(action))throw Error('Mutations forbidden');return {room:null,events:[],packs:[{coins:10000,stars:25}],orders:[{id:'order-fixture',coins:10000,stars:25,status:'paid',created_at:'2026-10-29T00:00:00Z',unrecovered_coins:0}],tasks:[],rigs:[],channels:[{chat_id:'-1001',title:'Home',username:'Home',enabled:true}],offers:[{code:'offer-fixture',title:'Wallet',claims:1,max_claims:20}],refunds:[],offer:{title:'خانه',message:'Wallet',reward:1,expires_at:'2030-01-01T00:00:00Z',max_claims:20,claims:0},treasury:'EQ_TEST_ADDRESS',starsPerUnit:1,enabled:false,webhookBound:false};},refresh:async()=>{},requestId:()=>crypto.randomUUID(),integer:Number,mutate:async(...args)=>{__writes.push(args);throw Error('Mutations forbidden')}};`;
const hooks='window.__i18nGame={accept,render,error,load,closeExisting,resetRoom,setCode(value){code=value;},get latest(){return latest;},get practiceState(){return practiceState;},setPractice(s){practice=true;practiceWaiting=false;practiceState=s;paintPractice();}};';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{try{
 const file=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!file.startsWith(root+sep))throw Error();
 let data=await readFile(file);if(file.endsWith('simab-wallet-client.js'))data=wallet;
 const hook=file.endsWith('simab-party-v16.js')?hooks:
  file.endsWith('simab-poker-v10.js')||file.endsWith('simab-table-games-v13.js')?'window.__i18nLegacy={accept,render,get session(){return session;}};':
  file.endsWith('simab-backgammon-v10.js')?'window.__i18nLegacy={accept,render:paint,get session(){return session;}};':
  file.endsWith('simab-central-quests.js')?'window.__questUI={describeTelegram401,doAdmin};':
  file.endsWith('simab-shop-admin-v15.js')?'window.__shopUI={refresh};':'';
 if(hook){const s=data.toString(),i=s.lastIndexOf('})();');if(i<0)throw Error('Missing test hook insertion point');data=s.slice(0,i)+hook+s.slice(i);}
 res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream'});res.end(data);
}catch{res.writeHead(404);res.end();}});
let browser,checks=0;const observations={},errors=[],dialogs=[];
try{
 await mkdir(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,...(process.env.SIMAB_TEST_BROWSER?{executablePath:process.env.SIMAB_TEST_BROWSER}:{})});
 const context=await browser.newContext({viewport:{width:430,height:1000},reducedMotion:'reduce'}),page=await context.newPage();
  await context.addInitScript(()=>{window.__writes=[];localStorage.setItem('simab_central_quest_drafts_v2',JSON.stringify([{title:'Home',url:'https://t.me/SimorApp',rewardCoins:1,timerSeconds:20}]));});
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===origin)return route.continue();if(url.pathname.endsWith('/simab-central-quests')&&route.request().method()==='GET')return route.fulfill({json:{quests:[{id:'quest-fixture',title:'Home',url:'https://t.me/SimorApp',verificationMode:'telegram_membership',rewardCoins:1,rewardAvailable:true}],rewardsEnabled:true}});return route.abort();});
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{dialogs.push(d.message());return d.dismiss();});
 const games=['hokm','ludo','backgammon','mill','truth','snakes','sevens','blackjack','bingo','slot'];
 const pages=['index.html?home=1','wallet/index.html','wallet/privacy.html','wallet/terms.html','quests/index.html','streak/index.html','games/wheel/index.html','games/tap/index.html','admin/index.html','games/poker/index.html','games/poker/friends.html','games/backgammon/index.html','games/blackjack/index.html','games/slot/index.html','games/cards/index.html','games/horoscope/index.html','ai/index.html','offers/index.html','friends/index.html','swap/index.html'];
 const only=process.argv.find(arg=>arg.startsWith('--only='))?.slice(7),routes=[...games.map(g=>'games/room/index.html?game='+g),...pages].filter(path=>!only||path===only);if(!routes.length)throw Error('Unknown test route');
  const targetedOnly=process.argv.includes('--targeted'),shopOnly=process.argv.includes('--shop-only'),sevensOnly=process.argv.includes('--sevens-only');
  if(!targetedOnly&&!shopOnly&&!sevensOnly){
  for(const path of routes){
  await page.goto(origin+'/'+path);await page.evaluate(()=>window.SimabI18nReady);await page.waitForFunction(()=>!!window.SimabI18n?.audit);
  if(path.includes('/room/'))await page.evaluate(()=>{const g=new URLSearchParams(location.search).get('game'),s=SimabPracticeRules.startParty(g,['mill','backgammon'].includes(g)?2:4,0,{twoGift:true,mode:'bottle'});__i18nGame.setPractice(s);});
  if(path==='games/poker/index.html')await page.evaluate(state=>__i18nLegacy.accept({sessionId:'local-poker',version:1,state}),publicPoker(startPoker(100,4)));
  if(path==='games/backgammon/index.html')await page.evaluate(state=>__i18nLegacy.accept({sessionId:'local-bg',version:1,state}),publicBG(startBG(20)));
  if(path==='games/blackjack/index.html')await page.evaluate(state=>__i18nLegacy.accept({sessionId:'local-bj',version:1,state}),publicBJ(startBJ(20)));
   if(path==='admin/index.html'){await page.locator('#task-title').fill('Home');await page.locator('#offer-message').fill('خانه');await page.locator('#stars-unit').fill('37');await page.locator('#offer-picker').selectOption('offer-fixture').catch(async error=>{console.error({errors,message:await page.locator('#shop-admin-message').innerText(),options:await page.locator('#offer-picker').innerHTML()});throw error;});}
   if(path==='wallet/index.html')await page.locator('#exchange-amount').fill('13');
  if(path==='games/cards/index.html'){await page.locator('#input-to').fill('Home');await page.locator('#input-msg').fill('خانه | Wallet');await page.locator('#input-from').fill('<b>Alice</b>');}
  if(path==='ai/index.html')await page.evaluate(()=>{addBubble('Home','user');addBubble('Wallet','ai');});
  if(path.includes('/room/'))await page.evaluate(()=>__i18nGame.error(Error('این حرکت مجاز نیست.')));
  const gameBefore=await page.evaluate(()=>JSON.stringify(window.__i18nLegacy?.session?.state||window.__i18nGame?.latest?.state||null));
  const walletBefore=await page.evaluate(()=>JSON.stringify(window.SimabWallet?.state||null));
  await page.evaluate(()=>{window.__languageNavigationSentinel='same-document';});
  observations[path]={};
  for(const lang of collect?['en']:['en','fa','ru','ar','hi','fr','de']){
   await page.evaluate(l=>{SimabI18n.setLanguage(l);if(document.querySelector('#status')&&window.__i18nGame){if(document.getElementById('status').textContent!==SimabI18n.key('error.illegalMove'))throw Error('Error text did not update synchronously');}},lang);await page.waitForTimeout(60);
   assert.equal(await page.evaluate(()=>__languageNavigationSentinel),'same-document');assert.equal(await page.locator('html').getAttribute('dir'),['fa','ar'].includes(lang)?'rtl':'ltr');
   observations[path][lang]=await page.evaluate(()=>SimabI18n.audit());checks++;
   assert.equal(await page.evaluate(()=>JSON.stringify(window.__i18nLegacy?.session?.state||window.__i18nGame?.latest?.state||null)),gameBefore);
   assert.equal(await page.evaluate(()=>JSON.stringify(window.SimabWallet?.state||null)),walletBefore);
    if(path==='admin/index.html'){assert.equal(await page.locator('#task-title').inputValue(),'Home');assert.equal(await page.locator('#offer-message').inputValue(),'خانه');assert.equal(await page.locator('#stars-unit').inputValue(),'37');assert.equal(await page.locator('#offer-picker').inputValue(),'offer-fixture');assert.equal(await page.locator('#shop-channels span').innerText(),'Home • @Home');assert.equal(await page.locator('#tasks-list .quest-title').innerText(),'Home');assert.equal(await page.locator('#quest-drafts-list [data-user-content]').innerText(),'Home');assert.equal((await page.locator('#tasks-list button').getAttribute('aria-label')).replace(/[\u2068\u2069]/g,''),await page.evaluate(()=>SimabI18n.key('admin.removeQuest',{name:'Home'}).replace(/[\u2068\u2069]/g,'')));}
    if(path==='quests/index.html')assert.equal(await page.locator('.quest-title[data-user-content]').innerText(),'Home');
    if(path==='wallet/index.html')assert.equal(await page.locator('#exchange-amount').inputValue(),'13');
   if(path==='offers/index.html'){assert.equal(await page.locator('#offer-name').innerText(),'خانه');assert.equal(await page.locator('#offer-text').innerText(),'Wallet');}
   if(path==='games/cards/index.html'){assert.equal(await page.locator('#preview-to').innerText(),'Home');assert.equal(await page.locator('#preview-msg').innerText(),'خانه | Wallet');assert.equal(await page.locator('#preview-from').innerText(),'<b>Alice</b>');}
   if(path==='ai/index.html')assert.deepEqual(await page.locator('#chatBox > div').evaluateAll(nodes=>nodes.slice(-2).map(node=>node.innerText)),['Home','Wallet']);
   if(path==='games/room/index.html?game=truth'){await page.evaluate(()=>confirm('خروج و برگشت ورودی؟'));assert.equal(dialogs.at(-1),await page.evaluate(()=>SimabI18n.key('confirm.leaveRefund')));checks++;}
   if(['index.html?home=1','wallet/index.html','admin/index.html','games/room/index.html?game=hokm','games/room/index.html?game=ludo'].includes(path))for(const width of [320,375,430,768]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+path+' '+lang+' '+width);checks++;}
   await page.setViewportSize({width:430,height:1000});
    if(!collect&&path.includes('/room/')&&['hokm','ludo'].includes(new URL(origin+'/'+path).searchParams.get('game')))await page.locator('#arena').screenshot({path:resolve(out,new URL(origin+'/'+path).searchParams.get('game')+'-'+lang+'.png')});
    if(!collect&&['admin/index.html','wallet/index.html'].includes(path)&&['fa','ar','de'].includes(lang))await page.screenshot({path:resolve(out,path.split('/')[0]+'-'+lang+'.png'),fullPage:true});
  }
  assert.deepEqual(await page.evaluate(()=>__writes),[]);
  if(path.includes('/room/')){
   const snapshots=await page.evaluate(()=>{const g=new URLSearchParams(location.search).get('game'),s=SimabPracticeRules.startParty(g,['mill','backgammon'].includes(g)?2:4,0,{twoGift:true,mode:'bottle'}),out=[];for(let step=0;step<12;step++){if(!s.finished)SimabPracticeRules.stepParty(s,s.current,SimabPracticeAI.choose(s,SimabPracticeRules));if([0,5,11].includes(step))out.push(structuredClone(s));}return out;});
   for(const [index,state] of snapshots.entries()){
    await page.evaluate(s=>__i18nGame.setPractice(s),state);observations[path+'#move-'+index]={};
    const original=await page.evaluate(()=>JSON.stringify(__i18nGame.latest.state));
    for(const lang of collect?['en']:['en','fa','ru','ar','hi','fr','de']){await page.evaluate(l=>SimabI18n.setLanguage(l),lang);await page.waitForTimeout(30);assert.equal(await page.evaluate(()=>JSON.stringify(__i18nGame.latest.state)),original);observations[path+'#move-'+index][lang]=await page.evaluate(()=>SimabI18n.audit());checks++;}
   }
  }
 }
  // Rerendered unknown/empty values must never be overwritten by stale keys.
  await page.goto(origin+'/games/room/index.html?game=truth');await page.evaluate(()=>window.SimabI18nReady);
  await page.evaluate(()=>{const s=SimabPracticeRules.startParty('truth',4,0,{mode:'bottle'});Object.assign(s,{phase:'question',current:0,asker:0,target:1});__i18nGame.setPractice(s);});
  await page.locator('#controls textarea').fill('Home | خانه | Wallet');await page.locator('#controls select').selectOption('dare');
  const truthState=await page.evaluate(()=>JSON.stringify(__i18nGame.latest.state));
  for(const lang of ['en','fa','ru','ar','hi','fr','de']){
   await page.locator('#controls textarea').focus();await page.locator('#controls textarea').evaluate(el=>el.setSelectionRange(2,5));
   await page.evaluate(lang=>SimabI18n.setLanguage(lang),lang);
   assert.equal(await page.locator('#controls textarea').inputValue(),'Home | خانه | Wallet');assert.equal(await page.locator('#controls select').inputValue(),'dare');
   assert.deepEqual(await page.locator('#controls textarea').evaluate(el=>[el===document.activeElement,el.selectionStart,el.selectionEnd]),[true,2,5]);
   assert.equal(await page.evaluate(()=>JSON.stringify(__i18nGame.latest.state)),truthState);checks++;
  }
  await page.reload();await page.evaluate(()=>window.SimabI18nReady);assert.equal(await page.locator('html').getAttribute('lang'),'de');checks++;
  await page.goto(origin+'/wallet/index.html');await page.evaluate(()=>window.SimabI18nReady);assert.equal(await page.locator('html').getAttribute('lang'),'de');checks++;
  await page.evaluate(()=>{
   const probe=document.createElement('div');document.body.append(probe);
   SimabI18n.bind(probe,'nav.home');probe.textContent='Unexpected replacement text';SimabI18n.setLanguage('fr');
   if(probe.textContent!=='Unexpected replacement text'||!SimabI18n.audit().includes('Unexpected replacement text'))throw Error('Stale binding hid unknown text');
   SimabI18n.bind(probe,'nav.home');probe.textContent='';SimabI18n.setLanguage('de');if(probe.textContent!=='')throw Error('Stale binding revived cleared text');
   SimabI18n.bind(probe,'nav.home');SimabI18n.bindSource(probe,'Another unexpected replacement');SimabI18n.setLanguage('ar');if(probe.textContent!=='Another unexpected replacement')throw Error('bindSource retained stale key');
   probe.remove();
  });checks+=3;
  for(const n of [2,3]){
  await page.goto(origin+'/games/room/index.html?game=hokm');await page.evaluate(()=>window.SimabI18nReady);
  await page.evaluate(n=>{const select=document.getElementById('seats');select.value=n;select.dispatchEvent(new Event('change'));__i18nGame.setPractice(SimabPracticeRules.startParty('hokm',n,0));},n);
  observations['hokm-seats-'+n]={};for(const lang of collect?['en']:['en','fa','ru','ar','hi','fr','de']){await page.evaluate(l=>SimabI18n.setLanguage(l),lang);await page.waitForTimeout(40);observations['hokm-seats-'+n][lang]=await page.evaluate(()=>SimabI18n.audit());checks++;}
 }
  }
   const targeted=shopOnly||sevensOnly?null:await runTargetedI18n(page,origin);checks+=targeted?.checks||0;
   const shop=sevensOnly?null:await runShopAdminI18n(page,origin);checks+=shop?.checks||0;
   const sevens=shopOnly||targetedOnly?null:await runSevensI18n(page,origin);checks+=sevens?.checks||0;
   const coverage=await page.evaluate(()=>SimabI18n.coverage());
   if(targeted)await writeFile(resolve(root,'docs/SIMAB_V22_PHASE3B_I18N_TARGETED.json'),JSON.stringify({scope:'Targeted real client paths with test-only hooks and synthetic rejected/success responses. No production authorization or mutation.',coverage,...targeted,errors},null,2)+'\n');
   if(shop)await writeFile(resolve(root,'docs/SIMAB_V22_PHASE3B_I18N_SHOP.json'),JSON.stringify({scope:'Admin-shop real handlers; in-page synthetic successful actions only. No production service, settings change or database access.',coverage,...shop,errors},null,2)+'\n');
   if(sevens)await writeFile(resolve(root,'docs/SIMAB_V22_PHASE3B_I18N_SEVENS.json'),JSON.stringify({scope:'Deterministic real Sevens rendering, immediate live-switch checks, repeated renders and new accepted events. Fixed in-memory fixtures; no RNG changes or game/wallet requests.',coverage,...sevens,errors},null,2)+'\n');
   if(!targetedOnly&&!shopOnly&&!sevensOnly)await writeFile(resolve(root,'docs/SIMAB_V22_PHASE3B_I18N_RUNTIME.json'),JSON.stringify({scope:'Actual pages, synthetic read-only state. Exact current DOM audit after language changes; not real-account/device testing.',coverage,observations,targeted,shop,sevens,errors,checks},null,2)+'\n');
 const unknown=[...new Set(Object.values(observations).flatMap(byLang=>Object.values(byLang).flat()))];
 console.log(JSON.stringify({checks,unknown:unknown.length,errors},null,2));if(collect)console.log(unknown.join('\n'));else{assert.deepEqual(errors,[]);assert.deepEqual(unknown,[],'Unmapped application text; see runtime report');}
}finally{await browser?.close();await new Promise(r=>server.close(r));}
