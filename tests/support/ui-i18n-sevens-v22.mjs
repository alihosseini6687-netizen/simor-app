import assert from 'node:assert/strict';

export const sevensLanguages=['en','fa','ru','ar','hi','fr','de'];
export const sevensPenalties=[0,2,4,6,12,20];
export const penaltyPatterns={en:'Draw cards ({number})',fa:'کارت بردار ({number})',ru:'Взять карты ({number})',ar:'اسحب أوراقًا ({number})',hi:'कार्ड उठाएँ ({number})',fr:'Piocher des cartes ({number})',de:'Karten ziehen ({number})'};
export function penaltyText(lang,number){
 const digits=lang==='fa'?'۰۱۲۳۴۵۶۷۸۹':lang==='ar'?'٠١٢٣٤٥٦٧٨٩':'0123456789';
 return penaltyPatterns[lang].replace('{number}',String(number).replace(/\d/g,c=>digits[Number(c)]));
}
// No random start, engine mutation, timer or network is needed to construct
// these repeatable accepted-state fixtures. Production rules remain untouched.
export function sevensFixture(penalty,current=0,direction=1,event=1){
 const hands=[[4,9,12],[17,22,25],[30,35,38],[43,44,48]],discard=[5],used=new Set([...hands.flat(),...discard]);
 return {kind:'sevens',n:4,current,finished:false,winners:[],result:'',event,lastEvent:'card',deadline:0,log:[],
  deck:Array.from({length:52},(_,i)=>i).filter(i=>!used.has(i)),hands,discard,suit:0,direction,penalty,twoTarget:true,twoGift:true};
}

export async function runSevensI18n(page,origin){
 await page.goto(origin+'/games/room/index.html?game=sevens');await page.evaluate(()=>window.SimabI18nReady);
 const languages=Object.fromEntries(sevensLanguages.map(lang=>[lang,{checks:0}]));let checks=0;
 const wallet=await page.evaluate(()=>JSON.stringify(SimabWallet.state));
 for(const penalty of sevensPenalties)for(const [current,direction] of [[0,1],[1,-1]])for(const lang of sevensLanguages){
  const state=sevensFixture(penalty,current,direction),id=penalty?'sevens.drawPenalty':'cards.draw';
  await page.evaluate(state=>__i18nGame.setPractice(state),state);
  const before=await page.evaluate(()=>JSON.stringify({private:__i18nGame.practiceState,public:__i18nGame.latest.state}));
  const expected=penalty?penaltyText(lang,penalty):await page.evaluate(lang=>SimabLocales.catalogs[lang]['cards.draw'],lang);
  // Inspect inside the same browser task as setLanguage: no observer/RAF wait
  // can conceal a label that only updates after the public call returns.
  await page.evaluate(({lang,id,expected,disabled,before})=>{
   SimabI18n.setLanguage(lang);const b=document.querySelector('#controls [data-i18n="'+id+'"]');
   if(!b||b.textContent!==expected)throw Error('Sevens label was not synchronous: '+lang+' '+expected);
   if(b.disabled!==disabled)throw Error('Language switch changed draw availability');
   if(JSON.stringify({private:__i18nGame.practiceState,public:__i18nGame.latest.state})!==before)throw Error('Language switch changed Sevens state');
  },{lang,id,expected,disabled:current!==0,before});checks++;languages[lang].checks++;
  await page.waitForTimeout(20);await page.evaluate(()=>{__i18nGame.render();__i18nGame.render();});
  assert.equal(await page.locator('#controls [data-i18n="'+id+'"]').textContent(),expected);
  assert.equal(await page.evaluate(()=>JSON.stringify({private:__i18nGame.practiceState,public:__i18nGame.latest.state})),before);
  checks++;languages[lang].checks++;
  // A new accepted event must not reuse a cached count, including clearing it.
  const nextPenalty=penalty===20?0:penalty+2,nextState=sevensFixture(nextPenalty,current,direction,2);
  const nextId=nextPenalty?'sevens.drawPenalty':'cards.draw';
  const nextExpected=nextPenalty?penaltyText(lang,nextPenalty):await page.evaluate(lang=>SimabLocales.catalogs[lang]['cards.draw'],lang);
  await page.evaluate(({state,id,expected})=>{__i18nGame.setPractice(state);const b=document.querySelector('#controls [data-i18n="'+id+'"]');if(!b||b.textContent!==expected)throw Error('Accepted render retained stale penalty');},{state:nextState,id:nextId,expected:nextExpected});
  const nextBefore=await page.evaluate(()=>JSON.stringify({private:__i18nGame.practiceState,public:__i18nGame.latest.state}));
  const other=sevensLanguages[(sevensLanguages.indexOf(lang)+1)%sevensLanguages.length];
  await page.evaluate(({other,lang})=>{SimabI18n.setLanguage(other);SimabI18n.setLanguage(lang);__i18nGame.render();},{other,lang});
  assert.equal(await page.locator('#controls [data-i18n="'+nextId+'"]').textContent(),nextExpected);
  assert.equal(await page.evaluate(()=>JSON.stringify({private:__i18nGame.practiceState,public:__i18nGame.latest.state})),nextBefore);
  assert.equal(await page.evaluate(()=>JSON.stringify(SimabWallet.state)),wallet);assert.deepEqual(await page.evaluate(()=>__writes),[]);
  checks++;languages[lang].checks++;
 }
 return {checks,languages,penalties:sevensPenalties,turns:[0,1],directions:[1,-1]};
}
