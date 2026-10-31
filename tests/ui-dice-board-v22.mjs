import {chromium} from 'playwright';import {harness} from './support/server-harness.mjs';import {spawn} from 'node:child_process';import {randomUUID} from 'node:crypto';import assert from 'node:assert/strict';
const h=await harness(),id=801000011,guest=801000012,server=spawn('python3',['-m','http.server','8775','--bind','127.0.0.1'],{cwd:new URL('../',import.meta.url),stdio:'ignore'}),browser=await chromium.launch({headless:true,args:['--no-sandbox']}),context=await browser.newContext({viewport:{width:390,height:854}}),page=await context.newPage(),errors=[],writes=[];
try{page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.addInitScript(()=>localStorage.setItem('simab_language_v16','fa'));await page.route('https://telegram.org/**',r=>r.fulfill({contentType:'text/javascript',body:`window.__shares=[];window.Telegram={WebApp:{initData:${JSON.stringify(h.signed(id))},initDataUnsafe:{user:{id:${id},first_name:'تست'}},ready(){},expand(){},onEvent(){},openTelegramLink(u){window.__shares.push(u)},BackButton:{show(){},onClick(){}}}};`}));await page.route('https://pwjlyryrrgbaprfnrieq.supabase.co/functions/v1/simab-central-quests',async route=>{const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*'};if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});if(route.request().method()==='GET')return route.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify({quests:[],rewardsEnabled:true})});const p=route.request().postDataJSON();if(p.requestId)writes.push(p);const r=await h.post(p,id);return route.fulfill({status:r.status,headers,contentType:'application/json',body:JSON.stringify(r.body)});});
const visit=async path=>{for(let attempt=0;attempt<20;attempt++){try{await fetch('http://127.0.0.1:8775/');break;}catch{await new Promise(r=>setTimeout(r,100));}}await page.goto('http://127.0.0.1:8775/'+path);await page.waitForFunction(()=>window.SimabWallet?.state?.serverWallet);};


for(const game of ['hokm','ludo','snakes','sevens','mill','blackjack','backgammon','bingo','truth']){
 await visit('games/room/index.html?game='+game);
 await page.locator('#practice-start').click();await page.locator('#practice-enter').click();await page.locator('#start').click();
 await page.waitForFunction(()=>document.querySelector('#arena').children.length>0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,game+' horizontal overflow');
 assert.equal(await page.locator('img').evaluateAll(xs=>xs.some(x=>x.complete&&x.naturalWidth===0)),false,game+' broken image');
 if(game==='ludo'){
  assert.equal(await page.locator('.arena-seats .current').count(),1);
  assert.equal(await page.locator('.pawn').count(),16);
  assert.equal(await page.locator('.pawn').first().evaluate(e=>{const r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e;}),true,'yard pawns visible above home art');
  await page.screenshot({path:'/tmp/simab-v22-ludo.png',fullPage:true});
 }
 await page.locator('#leave').click();
}
for(let value=1;value<=6;value++){
 await visit('games/room/index.html?game=ludo');
 await page.evaluate(value=>{const R=SimabPracticeRules,start=R.startParty;R.startParty=(...args)=>{const s=start(...args);s.table.die=value;s.table.lastRoll={player:0,value};return s;};},value);
 await page.locator('#practice-start').click();await page.locator('#practice-enter').click();await page.locator('#start').click();
 assert.equal(await page.locator('.die-result i').count(),value);
 assert.equal(await page.locator('.dice3d').getAttribute('data-value'),String(value));
 assert.ok((await page.locator('.die-number').textContent()).includes(value.toLocaleString('fa-IR')));
 await page.locator('#leave').click();
}
await visit('games/room/index.html?game=snakes');
await page.locator('#practice-start').click();await page.locator('#practice-enter').click();await page.locator('#start').click();
await page.evaluate(()=>{window.__rollCalls=0;const R=SimabPracticeRules,step=R.stepParty;R.stepParty=(...args)=>{if(args[1]===0)window.__rollCalls++;return step(...args);};document.querySelector('.dice3d').click();document.querySelector('.dice3d').click();document.querySelector('.dice3d').click();});
await page.waitForTimeout(900);assert.equal(await page.evaluate(()=>window.__rollCalls),1,'rapid taps produce one roll');
await page.screenshot({path:'/tmp/simab-v22-snakes.png',fullPage:true});
await page.locator('#leave').click();
await page.goto('http://127.0.0.1:8775/games/poker/index.html');
await page.evaluate(async()=>{const stage=document.createElement('div');stage.id='orientation-test';stage.style.position='fixed';stage.style.zIndex='40';document.body.append(stage);await SimabGameRoom.open(stage);});
assert.ok((await page.locator('#orientation-test').getAttribute('style')).includes('rotate(-90deg)'));assert.equal(await page.locator('#orientation-test').evaluate(e=>e.style.getPropertyValue('--simab-video-rotation')),'90deg');
await page.locator('.room-rotate').click();assert.ok((await page.locator('#orientation-test').getAttribute('style')).includes('rotate(90deg)'));
await page.setViewportSize({width:844,height:390});await page.waitForTimeout(100);
assert.ok((await page.locator('#orientation-test').getAttribute('style')).includes('rotate(180deg)'));
await page.locator('.room-rotate').click();assert.ok(!(await page.locator('#orientation-test').getAttribute('style')).includes('rotate('));
assert.deepEqual(errors,[]);console.log('V22 UI passed: all nine practices, six dice faces/numbers, visible numbered pawns, active seat, single rapid-tap roll, portrait/landscape direction control.');
}finally{await browser.close();await h.db.close();server.kill();}
