import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {phase4Browser} from './support/phase4-browser-v22.mjs';
const h=await phase4Browser(),p=h.page,langs=['en','fa','ru','ar','hi','fr','de'],shots='docs/screenshots/phase4';let checks=0;
try{
 await mkdir(shots,{recursive:true});
 for(const n of [2,3,5,7,10,12,20]){
  await h.open('truth');await p.locator('#local-bottle').click();await p.locator('#local-count').fill(String(n));await p.locator('#local-count').dispatchEvent('change');
  const names=Array.from({length:n},(_,i)=>i%2?'خانه نام بسیار بلند '+i:'Home Long participant '+i);
  for(const [i,name] of names.entries())await p.locator('#local-name-'+i).fill(name);
  await p.locator('#local-prepare').click();assert.equal(await p.locator('.bottle-name').count(),n);
  for(const width of [320,375,430,768]){await p.setViewportSize({width,height:1000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'manual overflow '+n+' '+width);checks++;}
  await p.locator('#local-spin').click();const selected=await p.locator('.bottle-disc').getAttribute('data-selected');assert.ok(Number(selected)>=0&&Number(selected)<n);
  assert.equal(await p.locator('.bottle-name.selected').getAttribute('title'),names[Number(selected)]);checks++;
  const angle=await p.locator('.bottle').evaluate(el=>Number(el.style.transform.match(/rotate\(([-.\d]+)/)[1])%360);assert.ok(Math.abs(angle-Number(selected)*360/n)<.01);checks++;
  for(const lang of [...langs,...langs]){await p.evaluate(lang=>SimabI18n.setLanguage(lang),lang);assert.deepEqual(await p.locator('.bottle-name').evaluateAll(nodes=>nodes.map(n=>n.title)),names);assert.equal(await p.locator('html').getAttribute('dir'),['fa','ar'].includes(lang)?'rtl':'ltr');checks++;}
  await p.setViewportSize({width:430,height:1000});if([5,10].includes(n))await p.locator('#local-panel').screenshot({path:shots+'/bottle-'+n+'.png'});
  assert.equal(await p.locator('[data-i18n="truth.skip"]').count(),0);checks++;
 }
 // Draw/hand transfer is an actual UI action; only actor cards are visible.
 await h.open('sevens');await p.evaluate(()=>{const s=SimabPracticeRules.startParty('sevens',3,0);s.hands=[[0,4,8,9],[13],[26]];s.discard=[1];s.suit=0;s.current=0;__phase4.fixture(s);});
 await p.locator('#controls select[multiple]').selectOption(['4','8']);await p.locator('#hand button').first().click();
 assert.deepEqual(await p.evaluate(()=>__phase4.state.hands[0]),[9]);assert.deepEqual(await p.evaluate(()=>__phase4.state.hands[1]),[13,4,8]);checks++;
 // Repeated switches while a hand is active cannot change hidden state.
 for(const sequence of [['en','fa','en'],['fa','ar','en'],['en','fa','de','en'],['ar','ru','hi','fa'],[...langs,...langs,...langs]])for(const lang of sequence){
  await p.evaluate(lang=>{const before=JSON.stringify(__phase4.state);SimabI18n.setLanguage(lang);if(JSON.stringify(__phase4.state)!==before)throw Error('Locale mutated live game');const b=document.querySelector('#controls [data-i18n="sevens.drawPenalty"],#controls [data-i18n="cards.draw"]');if(b.textContent!==SimabI18n.key(__phase4.state.penalty?'sevens.drawPenalty':'cards.draw',{number:__phase4.state.penalty}))throw Error('Stale draw label');},lang);checks++;
 }
 await h.open('ludo');await p.evaluate(()=>__phase4.fixture(SimabPracticeRules.startParty('ludo',4,0)));
 for(const width of [320,375,430,768]){await p.setViewportSize({width,height:1000});assert.equal(await p.locator('.ludo-grid .pawn').count(),16);assert.ok(await p.evaluate(()=>[...document.querySelectorAll('.ludo-grid .pawn')].every(p=>{const a=p.getBoundingClientRect(),b=p.parentElement.getBoundingClientRect();return Math.abs((a.left+a.right-b.left-b.right)/2)<2&&Math.abs((a.top+a.bottom-b.top-b.bottom)/2)<2;})),'pawn alignment '+width);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));checks++;}
 await p.locator('#arena').screenshot({path:shots+'/ludo.png'});assert.equal(await p.locator('.die-result[data-unrolled=true]').count(),1);checks++;
 assert.deepEqual(h.errors,[]);assert.deepEqual(await p.evaluate(()=>__writes),[]);console.log('Phase4 focused browser:',checks,'passed');
 await writeFile('docs/SIMAB_V22_PHASE4_BROWSER.json',JSON.stringify({checks,errors:h.errors,manualPlayers:[2,3,5,7,10,12,20],widths:[320,375,430,768],scope:'Real rendering with local synthetic fixtures; no device or subjective audio certification.'},null,2)+'\n');
}finally{await h.close();}
