import {chromium} from 'playwright';import {harness} from './support/server-harness.mjs';import {spawn} from 'node:child_process';import assert from 'node:assert/strict';
const h=await harness(),server=spawn('python3',['-m','http.server','8770','--bind','127.0.0.1'],{cwd:new URL('../',import.meta.url),stdio:'ignore'}),browser=await chromium.launch({headless:true,args:['--no-sandbox']}),context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.route('https://telegram.org/**',r=>r.fulfill({contentType:'text/javascript',body:`window.Telegram={WebApp:{initData:${JSON.stringify(h.signed(801000099))},initDataUnsafe:{user:{id:801000099,first_name:'Alex'}},safeAreaInset:{top:24,bottom:16},contentSafeAreaInset:{top:58},isFullscreen:true,ready(){},expand(){},onEvent(){},BackButton:{show(){},onClick(){}}}};`}));
 await page.route('https://pwjlyryrrgbaprfnrieq.supabase.co/functions/v1/simab-central-quests',async route=>{const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*'};if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});if(route.request().method()==='GET')return route.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify({quests:[],rewardsEnabled:true})});const r=await h.post(route.request().postDataJSON(),801000099);return route.fulfill({status:r.status,headers,contentType:'application/json',body:JSON.stringify(r.body)});});
 await page.goto('http://127.0.0.1:8770/games/room/index.html?game=truth');
 await page.getByRole('button',{name:'Create table & get code',exact:true}).waitFor();
 assert.equal(await page.locator('html').getAttribute('lang'),'en');assert.equal(await page.locator('html').getAttribute('dir'),'ltr');
 await page.getByRole('button',{name:'Play in person with one phone',exact:true}).click();
 const names=page.locator('#local-panel textarea');await names.fill('Alex\nSam');
 await page.getByRole('button',{name:'Set up players',exact:true}).click();
 await page.getByRole('button',{name:'Random prompt',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#local-panel .q-card').textContent.includes('What')||/Who|Which|How/.test(document.querySelector('#local-panel .q-card').textContent));
 assert.ok(!/[\u0600-\u06ff]/.test(await page.locator('#local-panel .q-card').textContent()));
 await page.screenshot({path:'/tmp/simab-english-v16.png',fullPage:true});
 await page.evaluate(()=>{window.__languageTestSentinel='active-bottle';});
 await page.locator('#simab-language select').selectOption('fa');
 // Live switching now preserves the current bottle screen instead of reloading
 // into the lobby. The original translation assertion remains on the lobby DOM.
 await page.waitForFunction(()=>document.getElementById('create').textContent==='ساخت میز و دریافت کد');
 assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
 assert.equal(await page.evaluate(()=>__languageTestSentinel),'active-bottle');
 assert.equal(await page.locator('#local-panel').isVisible(),true);assert.equal(await names.inputValue(),'Alex\nSam');
 await page.goto('http://127.0.0.1:8770/index.html');await page.waitForFunction(()=>typeof window.switchNavTab==='function');
 assert.equal(await page.locator('html').getAttribute('lang'),'fa');
 await page.locator('#simab-language select').selectOption('en');
 await page.waitForFunction(()=>document.documentElement.lang==='en'&&typeof window.switchNavTab==='function');
 await page.evaluate(()=>switchNavTab('games'));await page.locator('#games-container .game-card').filter({hasText:'Hokm'}).waitFor();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 console.log('English default, prompts, live bottle preservation, persistent Persian and English catalogue passed');
}finally{await context.close();await browser.close();await h.db.close();server.kill();}
