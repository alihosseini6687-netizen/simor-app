import assert from 'node:assert/strict';
import {phase4Browser} from './support/phase4-browser-v22.mjs';
const h=await phase4Browser(),p=h.page;let checks=0;
try{
 for(const n of [2,3,4]){
  await h.open('hokm');await p.locator('#seats').selectOption(String(n));
  await p.evaluate(()=>{SimabPracticeAI.actionDelay=()=>8;});
  await p.locator('#practice-start').click();await p.locator('#practice-enter').click();await p.locator('#start').click();
  let guard=0;
  while(!(await p.evaluate(()=>__phase4.state.finished))){
   if(++guard>1400)throw Error('Hokm did not reach a playable human round end '+n);
   const before=await p.evaluate(()=>({event:__phase4.state.event,current:__phase4.state.current,phase:__phase4.state.table.phase}));
   if(before.phase==='round_end'){break;}
   if(before.current===0){
    if(before.phase==='trump')await p.locator('#controls button:not([disabled])').first().click();
    else if(['discard','play'].includes(before.phase))await p.locator('#hand button:not([disabled])').first().click();
    else if(before.phase==='draw')await p.locator('#controls button:not([disabled])').first().click();
    else throw Error('No human Hokm control for phase '+before.phase);
   }else{
    await p.waitForFunction(event=>__phase4.state.event!==event||__phase4.state.finished,before.event,{timeout:12000});
   }
   checks++;
  }
  assert.deepEqual(h.errors,[]);
  // Drive the actual rendered round-end control with a deterministic engine state.
  const humanRound=await p.evaluate(n=>{const s=SimabPracticeRules.startParty('hokm',n,0);s.table.phase='round_end';s.table.current=0;s.table.hands[0]=[];s.current=0;const r=s.table.round;__phase4.fixture(s);return r;},n);
  const next=p.locator('#hokm-next-round');assert.equal(await next.count(),1,'human hakem sees one next-round action');
  await next.scrollIntoViewIfNeeded();assert.equal(await next.isVisible(),true);assert.equal(await next.isEnabled(),true);
  assert.match(await p.locator('.hokm-round-action').innerText(),/Hokm round complete|دور حکم|Раунд Хокма|جولة الحكم|होक्म|Manche de Hokm|Hokm-Runde/i);
  await next.click();await p.waitForFunction(round=>__phase4.state.table.round>round,humanRound,{timeout:3000});
  assert.ok(await p.evaluate(()=>__phase4.state.table.phase!=='round_end'));checks+=4;
  // When a bot is the hakem, no human button appears and only the scheduled bot acts.
  const round=await p.evaluate(n=>{const s=SimabPracticeRules.startParty('hokm',n,0);s.table.phase='round_end';s.table.current=1;s.table.hakem=1;s.table.hands[1]=[];s.current=1;const r=s.table.round;__phase4.fixture(s);__phase4.scheduleBot();return r;},n);
  assert.equal(await p.locator('#hokm-next-round').count(),0);
  await p.waitForFunction(round=>__phase4.state.table.round>round,round,{timeout:5000});
  assert.ok(await p.evaluate(()=>__phase4.state.table.round)>round);checks+=2;
  console.log('Hokm actual match/UI progression:',n,'players,',guard,'state steps; human and bot round-end verified');
 }
 // Verify the existing bot-label refresh in the preserved multiplayer bottle.
 await h.open('truth');
 await p.evaluate(()=>{const s=SimabPracticeRules.startParty('truth',4,0,{mode:'bottle'});s.mode='bottle';s.phase='roll';s.current=0;__phase4.fixture(s);});
 const sequences=[['en','fa','en'],['fa','ar','en'],['en','fa','de','en'],['ar','ru','hi','fa'],['en','fa','ru','ar','hi','fr','de','en']];
 for(const sequence of sequences)for(const lang of sequence){
  const before=await p.evaluate(()=>JSON.stringify(__phase4.state));
  await p.evaluate(lang=>SimabI18n.setLanguage(lang),lang);
  const actual=await p.locator('.bottle-name').allTextContents();
  const expected=await p.evaluate(()=>Array.from({length:4},(_,i)=>`${new Intl.NumberFormat(SimabI18n.locale).format(i+1)} · ${i===0?SimabI18n.key('game.you'):SimabI18n.key('game.bot',{number:new Intl.NumberFormat(SimabI18n.locale).format(i)})}`));
  assert.deepEqual(actual,expected,`bottle bot names after switching to ${lang}`);
  assert.equal(await p.evaluate(()=>JSON.stringify(__phase4.state)),before,'language switch preserves bottle/game state');checks++;
 }
 assert.deepEqual(h.errors,[]);assert.deepEqual(await p.evaluate(()=>__writes),[]);
 console.log('Phase4 Hokm/bottle focused browser:',checks,'passed');
}finally{await h.close();}
