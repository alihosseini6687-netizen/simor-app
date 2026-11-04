// Browser-simulated two distinct Telegram accounts: NOT two physical devices.
import {chromium} from 'playwright';
import {harness} from './support/server-harness.mjs';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';

const port=8777,hostId=801000011,guestId=801000012,ids=[hostId,guestId];
const h=await harness();
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{
  cwd:new URL('../',import.meta.url),stdio:'ignore'
});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const pages=[],jsErrors=[];
try{
  for(let attempt=0;attempt<40;attempt++){
    try{if((await fetch('http://127.0.0.1:'+port+'/')).ok)break;}
    catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  for(const id of ids){
    const context=await browser.newContext({viewport:{width:390,height:844}});
    const page=await context.newPage();pages.push(page);
    page.on('dialog',dialog=>dialog.accept());
    page.on('pageerror',err=>jsErrors.push(err.message));
    await page.addInitScript(()=>localStorage.setItem('simab_language_v16','fa'));
    await page.route('https://telegram.org/**',route=>route.fulfill({
      contentType:'text/javascript',
      body:`window.Telegram={WebApp:{initData:${JSON.stringify(h.signed(id))},
      initDataUnsafe:{user:{id:${id},first_name:'آزمایشگر'}},
      ready(){},expand(){},onEvent(){},openTelegramLink(){},
      BackButton:{show(){},onClick(){}}}};`
    }));
    await page.route('https://pwjlyryrrgbaprfnrieq.supabase.co/functions/v1/simab-central-quests',async route=>{
      const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*'};
      if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
      const response=await h.post(route.request().postDataJSON(),id);
      return route.fulfill({status:response.status,headers,contentType:'application/json',body:JSON.stringify(response.body)});
    });
  }
  const [owner,guest]=pages;
  const wallet=async id=>(await h.post({action:'wallet',walletAction:'state'},id)).body;
  const before=await Promise.all(ids.map(wallet));
  await owner.goto('http://127.0.0.1:'+port+'/games/room/index.html?game=hokm');
  await owner.waitForFunction(()=>window.SimabWallet?.state?.serverWallet);
  await owner.locator('#seats').selectOption('2');
  await owner.locator('#amount').fill('0');
  await owner.locator('#create').click();
  await owner.waitForFunction(()=>/^[A-Z2-9]{10}$/.test(document.getElementById('code')?.textContent||''));
  const code=(await owner.locator('#code').textContent()).trim();
  assert.equal(await owner.locator('#start').isDisabled(),true,'a single host cannot start a two-seat table');

  // The invited user starts at the actual published home router, not a manually-filled code field.
  await guest.goto('http://127.0.0.1:'+port+'/?tgWebAppStartParam=g_hokm_'+code);
  await guest.waitForURL(url=>url.pathname.endsWith('/games/room/index.html')&&url.searchParams.get('game')==='hokm'&&url.searchParams.get('code')===code);
  await guest.waitForFunction(()=>window.SimabWallet?.state?.serverWallet);
  await guest.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('دعوت'));
  const preview=await guest.locator('#status').textContent();
  assert.match(preview,/دعوت/);
  assert.match(preview,/از/,'invite shows seats occupied / capacity');
  assert.equal(await guest.locator('#room').isVisible(),false,'deep link must not silently join or debit');

  await guest.locator('#join').click();
  await guest.locator('#room:not([hidden])').waitFor();
  await owner.waitForFunction(()=>document.querySelectorAll('#roster .player').length===2);
  await owner.locator('#start:enabled').waitFor();
  const waiting=(await h.post({action:'game_room',op:'state',game:'hokm',code},hostId)).body;
  assert.equal(waiting.room.members.length,2);
  assert.equal(waiting.room.maxPlayers,2);
  assert.equal(waiting.room.status,'waiting');
  await owner.locator('#start').click();
  for(const page of pages)await page.waitForFunction(()=>document.querySelector('#arena')?.children.length>0&&document.getElementById('room')?.hidden===false);
  const states=await Promise.all(ids.map(id=>h.post({action:'game_room',op:'state',game:'hokm',code},id)));
  for(const result of states){
    assert.equal(result.status,200);
    assert.equal(result.body.room.status,'playing');
    assert.equal(result.body.state.kind,'hokm');
    assert.equal(result.body.state.n,2);
    assert.equal(result.body.state.table.hands,undefined,'private cards must not leak');
  }
  await guest.reload();
  await guest.locator('#room:not([hidden])').waitFor();
  const after=await Promise.all(ids.map(wallet));
  for(let i=0;i<ids.length;i++){
    assert.equal(after[i].chips,before[i].chips,'free practice must not debit chips');
    assert.equal(after[i].coins,before[i].coins,'free practice must not debit coins');
  }
  await owner.screenshot({path:'/tmp/simab-two-seat-hokm-v30.png',fullPage:true});
  assert.deepEqual(jsErrors,[]);
  console.log('PASS: two simulated signed Telegram users, deep link, explicit join, 2/2 start, hidden Hokm cards, reload, unchanged free wallet');
}finally{
  await browser.close();
  await h.db.close();
  server.kill();
}
