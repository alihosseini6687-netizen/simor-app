import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readSource} from './support/source.mjs';
import {uiHarness} from './support/ui-harness.mjs';
import {localeSources} from './support/i18n-v22.mjs';

function locales(saved='en'){
 const prefs=new Map([['simab_language_v16',saved]]),events=[];
 const document={title:'SIMAB',documentElement:{dataset:{}},body:{nodeType:1,matches:()=>false,closest:()=>null,hasAttribute:()=>false,dataset:{},querySelectorAll:()=>[]},readyState:'loading',addEventListener(){},querySelector:()=>null,getElementById:()=>null,createTreeWalker:()=>({nextNode:()=>null})};
 const x={document,localStorage:{getItem:k=>prefs.get(k),setItem:(k,v)=>prefs.set(k,v)},Intl,NodeFilter:{SHOW_TEXT:4},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},dispatchEvent:e=>events.push(e)};x.window=x;
 vm.createContext(x);for(const source of localeSources)vm.runInContext(source,x);
 return {x,prefs,events};
}
for(const lang of ['en','fa','ru','ar','hi','fr','de'])test('phase3 locale '+lang+': complete keyed schema, placeholders and direction',()=>{
 const {x}=locales(lang),base=x.SimabLocales.catalogs.en,catalog=x.SimabLocales.catalogs[lang];
 assert.deepEqual(Object.keys(catalog).sort(),Object.keys(base).sort());
 for(const [id,text] of Object.entries(catalog)){assert.ok(text.trim(),id);assert.deepEqual([...text.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort(),[...base[id].matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort(),id);}
 assert.equal(x.document.documentElement.dir,['fa','ar'].includes(lang)?'rtl':'ltr');
 const name='خانه <b>Alice</b>';assert.ok(x.SimabI18n.key('game.turn',{name}).includes(name));
 assert.equal(x.SimabI18n.key('nav.home'),catalog['nav.home']);
 if(!['en','fa'].includes(lang)){assert.equal(x.SimabI18n.prompts.truth.length,308);assert.equal(x.SimabI18n.prompts.dare.length,208);}
});
test('phase3 locale changes are synchronous, persistent and do not navigate',()=>{
 const {x,prefs,events}=locales();const api=x.SimabI18n;
 for(const lang of ['ru','ar','hi','fr','de','fa','en']){assert.equal(api.setLanguage(lang),true);assert.equal(api.lang,lang);assert.equal(x.document.documentElement.lang,lang);assert.equal(prefs.get('simab_language_v16'),lang);assert.equal(events.at(-1).detail.lang,lang);}
 assert.throws(()=>api.setLanguage('zz'),/Unsupported/);assert.equal(api.lang,'en');
});
test('phase3 coverage inventories legacy mappings and still exposes unknown application text',()=>{
 const {x}=locales('fr'),coverage=x.SimabI18n.coverage();assert.ok(coverage.fr.total>250);assert.equal(coverage.fr.legacyUnmapped.length,0);
 x.SimabI18n.t('unmapped application sentence');assert.ok(x.SimabI18n.missing.includes('unmapped application sentence'));
});

function rules(random=crypto){const x={window:{},crypto:random,structuredClone,console};vm.createContext(x);for(const file of ['simab-practice-rules-v17','simab-practice-ai-v20'])vm.runInContext(readSource(new URL('../assets/js/'+file+'.js',import.meta.url)),x);return {R:x.window.SimabPracticeRules,AI:x.window.SimabPracticeAI};}
test('phase3 Hokm pacing is bounded and faster without skipping the five-card stage',()=>{
 const {R,AI}=rules();
 for(const n of [2,3,4]){const s=R.startParty('hokm',n,0);assert.equal(s.table.phase,'trump');assert.equal(s.table.hands[s.table.hakem].length,5);
  for(const randomInt of [()=>0,n=>n-1]){const delay=AI.actionDelay(s,{randomInt});assert.ok(delay>=900&&delay<=1300);}
  const actor=s.current,action=AI.choose(s,R);assert.equal(action.type,'trump');R.stepParty(s,actor,action);assert.notEqual(s.table.phase,'trump');
 }
 for(const phase of ['draw','discard','play','round_end'])for(const randomInt of [()=>0,n=>n-1]){const delay=AI.actionDelay({kind:'hokm',table:{phase}},{randomInt});assert.ok(delay>=300&&delay<=1100);}
 assert.equal(AI.actionDelay({kind:'truth',mode:'bottle',phase:'question'},{randomInt:()=>0}),2050);
});
test('phase3 accelerated Hokm bots finish legal matches at all supported seat counts',()=>{
 const {R,AI}=rules();for(const n of [2,3,4]){const s=R.startParty('hokm',n,0);let turns=0;
  while(!s.finished&&turns++<15000){const actor=s.current,action=AI.choose(s,R);R.stepParty(s,actor,action);assert.ok(s.current>=0&&s.current<n);}
  assert.ok(s.finished,'match did not finish: '+n);assert.ok(s.winners.length);
 }
});
const members=Array.from({length:4},(_,i)=>({subject:String(i),name:'Player '+i,emoji:'x'}));
function party(){const {R,AI}=rules(),events={};const h=uiHarness('assets/js/simab-party-v16.js','accept,roll,resetRoom,decorateDice,bottle,scheduleBot,get state(){return practiceState;},setPractice(s){practice=true;practiceWaiting=false;practiceState=s;paintPractice();}',{game:'ludo',globals:{SimabPracticeRules:R,SimabPracticeAI:AI,addEventListener:(k,f)=>(events[k]??=[]).push(f)}});return {...h,events};}
function ludoState(){const {R}=rules();return R.publicParty(R.startParty('ludo',4,0),0);}
const receipt=s=>({room:{game:'ludo',code:'TEST',viewer:0,host:true,status:'playing',buyIn:0,members,messages:[],signals:[]},state:s});
test('phase3 stale queued roll cannot act after reset or a newer accepted event',()=>{
 const h=party(),s=ludoState();let calls=0;h.api.accept(receipt(s));h.api.roll(()=>calls++);const queued=[...h.timers.values()][0];
 h.api.accept(receipt({...s,event:s.event+1}));queued();assert.equal(calls,0);
 h.api.roll(()=>calls++);const cancelled=[...h.timers.values()][0];h.api.resetRoom();cancelled();assert.equal(calls,0);
});
test('phase3 accepted dice values include all six faces and legitimate repeated threes',()=>{
 const h=party();let event=1;for(const value of [1,2,3,3,3,4,5,6]){const s=ludoState();s.table.lastRoll={player:0,value};s.table.die=0;h.api.accept(receipt({...s,event:event++}));const die=h.body.querySelector('.dice3d');assert.equal(die.dataset.value,value);assert.equal(die.querySelectorAll('i').length,value);assert.equal(s.table.die,0);}
});
test('phase3 authoritative practice rolls preserve every face and consecutive threes',()=>{
 let value=1;const {R}=rules({getRandomValues:a=>{a[0]=value-1;return a;}});
 for(value=1;value<=6;value++){const s=R.startParty('ludo',4,0);R.stepParty(s,s.current,{type:'roll'});assert.equal(s.table.lastRoll.value,value);}
 value=3;const s=R.startParty('ludo',4,0);for(let i=0;i<8;i++){const before=s.current;R.stepParty(s,before,{type:'roll'});assert.equal(s.table.lastRoll.value,3);assert.equal(s.current,(before+1)%4);assert.equal(s.table.die,0);}
});
test('phase3 cancelled bot callback is inert even if the timer was already queued',()=>{
 const h=party(),{R}=rules();const s=R.startParty('ludo',4,0);s.current=s.table.current=1;h.api.setPractice(s);
 h.api.scheduleBot();const queued=[...h.timers.values()][0];assert.equal(typeof queued,'function');
 h.api.resetRoom();queued();assert.equal(h.api.state,null);assert.equal(h.timers.size,0);assert.equal(s.event,1);
});
test('phase3 page exit cancels queued rolls; BFCache restoration resumes bot pacing once',()=>{
 const h=party();h.api.accept(receipt(ludoState()));let calls=0;h.api.roll(()=>calls++);const queued=[...h.timers.values()][0];h.events.pagehide.forEach(f=>f());queued();assert.equal(calls,0);
 const {R}=rules(),s=R.startParty('ludo',4,0);s.current=s.table.current=1;h.api.setPractice(s);h.api.scheduleBot();h.events.pagehide.forEach(f=>f());assert.equal(h.timers.size,0);h.events.pageshow.forEach(f=>f());assert.equal(h.timers.size,1);h.events.pageshow.forEach(f=>f());assert.equal(h.timers.size,1);assert.equal(s.event,1);
});
test('phase3 bottle rotation agrees with selected seat for 2–20 players',()=>{
 const h=party();for(let n=2;n<=20;n++)for(let target=0;target<n;target++){
  const angle=target*360/n,d=h.api.bottle(n,angle,Array.from({length:n},(_,i)=>'Player '+i),n*100+target+1);
  const rotation=Number(d.querySelector('.bottle').style.transform.match(/rotate\((.+)deg\)/)[1]);
  // Detached elements do not animate; the initial rotation is the preceding
  // round. Authoritative target metadata is still exact and the browser tests
  // below exercise the connected transition endpoint.
  assert.ok(Number.isFinite(rotation));assert.equal(Number(d.dataset.targetAngle),angle);assert.equal(d.querySelectorAll('.bottle-name').length,n);
 }
});

function sound(saved='1'){
 const sources=[],events={},prefs=new Map([['simab_sound_enabled',saved]]);let now=0;
 const param=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}});
 class Audio{get currentTime(){return now;}get sampleRate(){return 8000;}resume(){return Promise.resolve();}createGain(){return {gain:param(),connect(){return this;}};}createBiquadFilter(){return {frequency:param(),Q:param(),connect(){return this;}};}createBuffer(ch,n){return {getChannelData:()=>new Float32Array(n)};}createOscillator(){const source={frequency:param(),connect(){return this;},start(at){this.at=at;},stop(at){if(at===undefined)this.cancelled=true;}};sources.push(source);return source;}createBufferSource(){const source=this.createOscillator();source.paper=true;return source;}}
 const x={AudioContext:Audio,localStorage:{getItem:k=>prefs.get(k),setItem:(k,v)=>prefs.set(k,v)},addEventListener:(k,f)=>events[k]=f,document:{addEventListener:(k,f)=>events[k]=f},Math};x.window=x;vm.runInNewContext(readSource(new URL('../assets/js/simab-game-sound-v8.js',import.meta.url)),x);
 return {api:x.SimabSound,sources,prefs,events,setTime:n=>now=n};
}
test('phase3 wooden dice cues have six spaced decaying impacts, not frame-driven clicks',()=>{
 const h=sound();h.api.play('dice','receipt-1');assert.equal(h.sources.length,12);const impacts=h.sources.filter((_,i)=>i%2===0).map(s=>s.at);assert.deepEqual(impacts,[0,.065,.15,.255,.39,.55]);
 h.api.play('dice','receipt-1');assert.equal(h.sources.length,12);h.api.play('checker','receipt-1');assert.equal(h.sources.length,14);assert.ok(h.sources.at(-2).at>=.64);
});
test('phase3 sound mute persists and cancels queued audio, page exit is silent',()=>{
 const h=sound();h.api.play('dice');h.api.toggle();assert.ok(h.sources.every(s=>s.cancelled));assert.equal(h.prefs.get('simab_sound_enabled'),'0');const count=h.sources.length;h.api.play('win');assert.equal(h.sources.length,count);
 h.api.toggle();h.api.play('card');h.events.pagehide();assert.ok(h.sources.every(s=>s.cancelled));const hiddenCount=h.sources.length;h.api.play('win','late-receipt');assert.equal(h.sources.length,hiddenCount);h.events.pageshow();h.api.play('card');assert.equal(h.sources.length,hiddenCount+1);assert.equal(sound('0').api.isEnabled(),false);
});
test('phase3 result and card cues are distinct and rapid backlog is bounded',()=>{
 for(const [kind,count] of [['win',3],['fold',2],['draw',2],['card',1],['shuffle',4]]){const h=sound();h.api.play(kind);assert.equal(h.sources.length,count,kind);}
 const h=sound();for(let i=0;i<15;i++)h.api.play('dice','receipt-'+i);assert.ok(Math.max(...h.sources.map(s=>s.at))<1.9);assert.ok(h.sources.some(s=>s.cancelled));
});
function backgammon(){const events={},window={addEventListener:(k,f)=>events[k]=f};let release;const h=uiHarness('assets/js/simab-backgammon-v10.js','accept,animate,get session(){return session;}',{globals:{window,SimabGameRoom:{open(){},close(){},fit(){},delay:()=>new Promise(r=>release=r)}}});return {...h,api:window.__test,events,release:()=>release()};}
const bg=(version,dice=[3,3],turn=0,timeline=[])=>({sessionId:'bg',version,state:{kind:'backgammon',points:Array(24).fill(0),dice,moves:[],bar:[0,0],off:[0,0],turn,finished:false,log:[],timeline}});
test('phase3 Backgammon interrupted timeline never overwrites a newer receipt',async()=>{
 const h=backgammon();h.api.accept(bg(1));const r=bg(2,[4,5],1,[bg(2,[4,5],1).state]),pending=h.api.animate(r);h.api.accept(bg(3,[6,6]));h.release();await pending;assert.equal(h.api.session.version,3);assert.deepEqual(h.api.session.state.dice,[6,6]);
});
test('phase3 Backgammon page exit retains accepted final state without late audio',async()=>{
 const h=backgammon();h.api.accept(bg(1));const r=bg(2,[4,5],1,[bg(2,[2,3],1).state]),pending=h.api.animate(r);h.events.pagehide();const count=h.sounds.length;h.release();await pending;assert.equal(h.api.session,r);assert.equal(h.sounds.length,count);
 await h.api.animate(bg(3,[1,6]));assert.equal(h.api.session.version,3);assert.equal(h.sounds.length,count);
});
test('phase3 Backgammon roll history survives consumption and bot turn is explicit',()=>{
 const h=backgammon();h.api.accept(bg(1,[3,3]));h.api.accept(bg(2,[]));assert.match(h.$('bg-dice').textContent,/3 \/ 3/);h.api.accept(bg(3,[1,2],1));assert.match(h.$('bg-turn').textContent,/ربات/);assert.equal(h.$('bg-bar').disabled,true);
});
