import {chromium} from 'playwright';
import {harness} from './support/server-harness.mjs';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';

const languages=['en','fa','ru','ar','hi','fr','de'];
const screens=[{width:390,height:844},{width:320,height:700}];
const h=await harness();
const server=spawn('python3',['-m','http.server','8778','--bind','127.0.0.1'],{cwd:new URL('../',import.meta.url),stdio:'ignore'});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:screens[0],deviceScaleFactor:1});
const page=await context.newPage();
const errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('dialog',d=>d.accept());
page.route('https://telegram.org/**',r=>r.fulfill({contentType:'text/javascript',body:`window.Telegram={WebApp:{initData:${JSON.stringify(h.signed(801000099))},initDataUnsafe:{user:{id:801000099,first_name:'Alex'}},safeAreaInset:{top:24,bottom:16},contentSafeAreaInset:{top:58},isFullscreen:true,ready(){},expand(){},onEvent(){},BackButton:{show(){},hide(){},onClick(){}}}};`}));
page.route('https://pwjlyryrrgbaprfnrieq.supabase.co/functions/v1/simab-central-quests',async route=>{
 const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*'};
 if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
 if(route.request().method()==='GET')return route.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify({quests:[],rewardsEnabled:true})});
 const r=await h.post(route.request().postDataJSON(),801000099);
 return route.fulfill({status:r.status,headers,contentType:'application/json',body:JSON.stringify(r.body)});
});
async function visit(path){
 await page.goto('http://127.0.0.1:8778/'+path,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.SimabI18n && !!document.querySelector('#simab-language select'),{timeout:25000});
 await page.evaluate(()=>window.SimabI18nReady);
 await page.waitForTimeout(180);
}
async function check(lang,scope){
 const data=await page.evaluate(()=>{
  const w=document.documentElement.clientWidth;
  const visible=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>1&&r.height>1&&r.bottom>0&&r.top<innerHeight;};
  const inspect=['#simab-language','.bottom-nav','.nav-btn-box','.game-card','#create','#join','#games-container','#v4-game-search','.v3-page-hero','.task-nav-grid-4'];
  const off=[];
  for(const selector of inspect)for(const el of document.querySelectorAll(selector))if(visible(el)){
    const r=el.getBoundingClientRect();
    if(r.right>w+3||r.left< -3)off.push({selector,text:el.textContent.trim().slice(0,42),left:+r.left.toFixed(1),right:+r.right.toFixed(1),width:w});
  }
  const accounts=[...document.querySelectorAll('[data-wallet-account]')].map(el=>el.textContent.trim()).filter(Boolean);
  return {documentWidth:document.documentElement.scrollWidth,clientWidth:w,dir:document.documentElement.dir,locale:document.documentElement.lang,selection:document.querySelector('#simab-language select')?.value,accounts,expectedPrefix:window.SimabI18n.key('wallet.telegramId')+': ',off,missing:window.SimabI18n.audit().slice(0,20),missingCount:window.SimabI18n.missing.length};
 });
 assert.equal(data.locale,lang,scope+' document language');
 assert.equal(data.selection,lang,scope+' language selector');
 assert.equal(data.dir,['fa','ar'].includes(lang)?'rtl':'ltr',scope+' writing direction');
 assert.ok(data.documentWidth<=data.clientWidth+3,scope+' horizontal overflow '+JSON.stringify(data));
 assert.deepEqual(data.off,[],scope+' clipped controls');
 assert.equal(data.missingCount,0,scope+' untranslated text: '+JSON.stringify(data.missing));
 assert.ok(data.accounts.every(label=>label.startsWith(data.expectedPrefix)),scope+' account label untranslated: '+JSON.stringify(data.accounts));
 results.push({lang,scope,...data});
}
try {
 for(let wait=0;wait<60;wait++){try{const r=await fetch('http://127.0.0.1:8778/');if(r.ok)break;}catch{} await delay(100);}
 for(const lang of languages){
   for(const size of screens){
     await page.setViewportSize(size);
     await visit('index.html');
     await page.locator('#simab-language select').selectOption(lang);
     await page.waitForFunction(code=>document.documentElement.lang===code,lang);
     await page.evaluate(()=>switchNavTab('home'));
     await check(lang,'home-'+size.width);
     await page.screenshot({path:`/tmp/simab-seven-${lang}-${size.width}-home.png`,fullPage:true});
     await page.evaluate(()=>switchNavTab('games'));
     await page.locator('#games-container .game-card').first().waitFor();
     await check(lang,'games-'+size.width);
     await page.screenshot({path:`/tmp/simab-seven-${lang}-${size.width}-games.png`,fullPage:true});
     await page.evaluate(()=>switchNavTab('tasks'));
     await check(lang,'tasks-'+size.width);
     // Only one screenshot per locale for tasks to keep artifacts small.
     if(size.width===390)await page.screenshot({path:`/tmp/simab-seven-${lang}-tasks.png`,fullPage:true});
   }
   await page.setViewportSize(screens[0]);
   await visit('games/room/index.html?game=truth');
   await check(lang,'room-390');
   await page.screenshot({path:`/tmp/simab-seven-${lang}-room.png`,fullPage:true});
   const local=await page.evaluate(()=>localStorage.getItem('simab_language_v16'));
   assert.equal(local,lang,'language preference persists on navigation');
 }
 assert.deepEqual(errors,[],'no uncaught JS errors');
 console.log('VISUAL 7-LANGUAGE MATRIX PASSED '+JSON.stringify(results.map(({lang,scope,missingCount,missing})=>({lang,scope,missingCount,missing:missing.slice(0,8)}))));
} finally {
 await context.close(); await browser.close();await h.db.close();server.kill();
}
