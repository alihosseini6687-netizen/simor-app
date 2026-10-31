import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';
import {execFileSync} from 'node:child_process';
import {projectRoot} from './support/source.mjs';

// Actual application pages; only wallet transport and test closure access are replaced.
// No Telegram, Supabase, CDN or other external traffic is allowed.
const before=process.argv.includes('--capture-before');
const prefix=before?'head-before':'resume-after',baseline=new Map(),artifacts=!process.argv.includes('--no-artifacts');
const shotDir=resolve(projectRoot,'docs/screenshots/phase3'),root=resolve(projectRoot);
const wallet=`window.Telegram={WebApp:{ready(){},expand(){},initDataUnsafe:{},onEvent(){}}};window.SimabWallet={state:{coins:1000,chips:500,streakDay:1,serverUtcDate:'2026-10-29',dailyAvailable:true,wheelAvailable:true,serverWallet:true},pending:null,busy:false,ready:Promise.resolve(),subscribe(f){f(this.state)},read:async()=>({room:null,events:[],packs:[],orders:[],tasks:[],rigs:[]}),refresh:async()=>{},requestId:()=>crypto.randomUUID(),integer:Number,mutate:async()=>{throw Error('Financial transport disabled in visual test')}};`;
const hooks='window.__phase3={accept,render,bottle,decorateDice,resetRoom,roll,act,get latest(){return latest;},setPractice(s){practice=true;practiceWaiting=false;practiceState=s;paintPractice();}};';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'};
const server=createServer(async(req,res)=>{try{const file=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!file.startsWith(root+sep))throw Error();let data;if(before){const relative=file.slice(root.length+1).replaceAll('\\','/');if(!baseline.has(relative))baseline.set(relative,execFileSync('git',['show','HEAD:'+relative],{cwd:root,stdio:['ignore','pipe','ignore']}));data=baseline.get(relative);}else data=await readFile(file);if(file.endsWith('simab-wallet-client.js'))data=wallet;if(file.endsWith('simab-party-v16.js')){const s=data.toString(),i=s.lastIndexOf('})();');data=s.slice(0,i)+hooks+s.slice(i);}res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end();}});
let browser,checks=0;
try{
 await mkdir(shotDir,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,...(process.env.SIMAB_TEST_BROWSER?{executablePath:process.env.SIMAB_TEST_BROWSER}:{})});
 const context=await browser.newContext({viewport:{width:375,height:900},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
 await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());page.on('pageerror',e=>errors.push(e.message));
 async function open(game,lang='en',width=375){await page.setViewportSize({width,height:1000});await page.goto(origin+'/games/room/index.html?game='+game);await page.evaluate(l=>localStorage.setItem('simab_language_v16',l),lang);await page.reload();await page.waitForFunction(()=>!!window.__phase3&&!!window.SimabPracticeRules);await page.evaluate(()=>window.SimabI18nReady);}
 async function state(game){await page.evaluate(g=>{const R=SimabPracticeRules,s=R.startParty(g,['mill','backgammon'].includes(g)?2:4,0,{twoGift:true,mode:'bottle'});if(g==='ludo'){s.table.lastRoll={player:1,value:3};s.table.current=s.current=0;}if(g==='truth'){s.round=1;s.angle=90;s.target=1;s.phase='question';s.current=s.asker=0;}__phase3.setPractice(s);},game);}
 for(const game of ['hokm','ludo','mill','truth','backgammon']){await open(game);await state(game);if(artifacts)await page.locator('#arena').screenshot({path:resolve(shotDir,prefix+'-'+game+'.png')});checks++;}
 if(!before){
  for(const lang of ['en','fa','ru','ar','hi','fr','de'])for(const width of [320,375,430,768]){
   await open('hokm',lang,width);await state('hokm');await page.waitForFunction(l=>SimabI18n.lang===l,lang);
   assert.equal(await page.locator('html').getAttribute('dir'),['fa','ar'].includes(lang)?'rtl':'ltr');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+lang+' '+width);
   const avatars=await page.locator('#arena .seat-media-avatar').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().width));assert.ok(avatars.every(w=>w>=64&&w<=76),JSON.stringify(avatars));checks++;
  }
  await open('ludo');await state('ludo');
  for(const face of [1,2,3,3,3,4,5,6]){await page.evaluate(v=>__phase3.decorateDice(v),face);assert.equal(await page.locator('.die-result i').count(),face);assert.equal(await page.locator('.dice3d').getAttribute('data-value'),String(face));checks++;}
  await open('backgammon');
  for(const face of [1,2,3,3,3,4,5,6]){await page.evaluate(value=>{const s=SimabPracticeRules.startParty('backgammon',2,0);s.table.opening=null;s.table.dice=[value,value];s.lastEvent='dice';s.event=performance.now();__phase3.setPractice(s);},face);assert.equal(await page.locator('.bg-die').count(),2);assert.deepEqual(await page.locator('.bg-die').evaluateAll(ns=>ns.map(n=>({value:n.dataset.value,pips:n.querySelectorAll('i').length}))),Array(2).fill({value:String(face),pips:face}));checks++;}
  await page.evaluate(()=>{const s=SimabPracticeRules.startParty('backgammon',2,0);s.table.opening=null;s.table.dice=[];s.lastEvent='checker';s.event=performance.now();__phase3.setPractice(s);});assert.match(await page.locator('.dice-history').innerText(),/6/);checks++;
  for(let n=2;n<=20;n++){await page.evaluate(n=>{const d=__phase3.bottle(n,(n-1)*360/n,Array.from({length:n},(_,i)=>'Player '+i),n);document.getElementById('arena').replaceChildren(d);},n);assert.equal(await page.locator('.bottle-name').count(),n);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));checks++;}
  await open('mill','de');await state('mill');
  await page.evaluate(()=>{window.__languageSentinel=crypto.randomUUID();window.__stateBeforeSwitch=JSON.stringify(__phase3.latest.state);});const sentinel=await page.evaluate(()=>__languageSentinel);
  for(const lang of ['en','fa','ru','ar','hi','fr','de']){await page.locator('#simab-language select').selectOption(lang);assert.equal(await page.evaluate(()=>__languageSentinel),sentinel);assert.equal(await page.evaluate(()=>SimabI18n.lang),lang);assert.equal(await page.evaluate(()=>JSON.stringify(__phase3.latest.state)),await page.evaluate(()=>__stateBeforeSwitch));assert.equal(await page.locator('.party-head a').innerText(),await page.evaluate(()=>SimabI18n.key('nav.homeGames')));checks++;}
  await page.reload();await page.waitForFunction(()=>SimabI18n.lang==='de');checks++;
  await open('ludo');await page.evaluate(()=>{__phase3.resetRoom();const s=SimabPracticeRules.publicParty(SimabPracticeRules.startParty('ludo',4,0),0);__phase3.accept({version:1,room:{game:'ludo',code:'NAMES',viewer:0,host:true,status:'playing',buyIn:0,members:['خانه','Home','Wallet','<b>Alice</b>'].map((name,i)=>({name,subject:String(i)})),messages:[],signals:[]},state:s});});
  for(const lang of ['en','fa','ru','ar','hi','fr','de']){await page.locator('#simab-language select').selectOption(lang);assert.deepEqual(await page.locator('#roster .seat-name').allTextContents(),['خانه','Home','Wallet','<b>Alice</b>']);assert.equal(await page.locator('#roster b').count(),0);checks++;}
  await open('truth');await state('truth');await page.locator('#controls textarea').fill('خانه — my original question');await page.locator('#simab-language select').selectOption('ar');assert.equal(await page.locator('#controls textarea').inputValue(),'خانه — my original question');checks++;
  for(const n of [2,3,4])for(const width of [320,375,430,768]){await open('hokm','ar',width);await page.evaluate(n=>__phase3.setPractice(SimabPracticeRules.startParty('hokm',n,0)),n);assert.equal(await page.locator('#arena .table-seat').count(),n);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));const count=await page.locator('#arena .table-seat.current').count();assert.equal(count,1);checks++;}
  for(const game of ['ludo','backgammon','mill','truth','snakes','sevens','blackjack','bingo'])for(const width of [320,375,430,768]){await open(game,'de',width);await state(game);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+game+' '+width);assert.ok(await page.locator('#turn-status').innerText());checks++;}
  await page.emulateMedia({reducedMotion:'no-preference'});await open('truth');await state('truth');
  for(const n of [2,3,4,7,12,20])for(const target of [0,n-1]){const angle=target*360/n;await page.evaluate(({n,angle,target})=>{document.getElementById('arena').replaceChildren(__phase3.bottle(n,angle,Array.from({length:n},(_,i)=>'Player '+i),n*100+target+100));},{n,angle,target});await page.waitForTimeout(2300);const rotation=await page.locator('.bottle').evaluate(el=>{const m=new DOMMatrix(getComputedStyle(el).transform);return (Math.atan2(m.b,m.a)*180/Math.PI+360)%360;});assert.ok(Math.abs(((rotation-angle+540)%360)-180)<.2,'bottle endpoint '+n+' '+target+' actual '+rotation+' expected '+angle);checks++;}
  await page.emulateMedia({reducedMotion:'reduce'});
  const observed={};
  for(const lang of ['en','fa','ru','ar','hi','fr','de']){
   observed[lang]={};
   for(const game of ['hokm','ludo','backgammon','mill','truth','snakes','sevens','blackjack','bingo']){await open(game,lang);await state(game);await page.waitForTimeout(40);observed[lang]['room/'+game]=await page.evaluate(()=>SimabI18n.missing);checks++;}
   for(const path of ['index.html?home=1','wallet/index.html','quests/index.html','streak/index.html','games/wheel/index.html','games/tap/index.html','admin/index.html']){
    await page.goto(origin+'/'+path);await page.evaluate(()=>window.SimabI18nReady);await page.waitForTimeout(60);
    assert.equal(await page.locator('html').getAttribute('lang'),lang);observed[lang][path]=await page.evaluate(()=>SimabI18n.missing);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page overflow '+path+' '+lang);
    if(artifacts&&path==='index.html?home=1')await page.screenshot({path:resolve(shotDir,'resume-after-home-'+lang+'.png'),fullPage:true});checks++;
   }
  }
  const coverage=await page.evaluate(()=>SimabI18n.coverage());
  if(artifacts)await writeFile(resolve(root,'docs/SIMAB_V22_PHASE3_I18N_COVERAGE.json'),JSON.stringify({scope:'Keyed schema and retained compatibility inventory; not a complete inventory of all application-owned strings. Observations use isolated UI fixtures, not live accounts.',coverage,observed},null,2)+'\n');
 }
 assert.deepEqual(errors,[]);console.log(`Phase3 ${before?'baseline screenshots':'browser regressions'}: ${checks} checks passed; external traffic blocked.`);
}finally{await browser?.close();await new Promise(r=>server.close(r));}
