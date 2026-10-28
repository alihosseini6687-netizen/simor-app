import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {readSource} from './support/source.mjs';
import {uiHarness,Element} from './support/ui-harness.mjs';

const html=readSource(new URL('../games/slot/index.html',import.meta.url));
const tick=()=>new Promise(setImmediate);
const engine=readSource(new URL('../supabase/functions/simab-central-quests/games.ts',import.meta.url));
// Execute the unchanged production payout function with deterministic test-only
// reel input. No production RNG or server source is replaced on disk.
const spinSource=stripTypeScriptTypes(engine.slice(engine.indexOf('export function spinSlot('),engine.indexOf('// Shared tables')).replace('export ',''));
function expected(reels,bet,m){
  const counts=Array(9).fill(0);reels.forEach(i=>counts[i]++);
  const triple=counts.indexOf(3);
  if(triple>=0)return triple===4?20*m:bet*[50,30,20,10,0,5,0,0,0][triple];
  return counts.slice(0,6).includes(2)?bet*2:0;
}
for(let a=0;a<9;a++)for(let b=0;b<9;b++)for(let c=0;c<9;c++)test(`slot paytable reels ${a},${b},${c}`,()=>{
  const reels=[a,b,c];let cursor=0;
  const context=vm.createContext({randomInt:n=>{assert.equal(n,9);return reels[cursor++%3];},fail:code=>{throw Error(code);}});
  vm.runInContext(spinSource,context);
  for(const base of [2,5,25,100,500])for(let m=1;m<=50;m++){
    const r=vm.runInContext(`spinSlot(${base*m},${m})`,context);
    assert.equal(r.payout,expected(reels,base*m,m));assert.equal(r.bet,base*m);
  }
});
test('paytable explains gross/net, excluded pairs and base-independent energy',()=>{
  const rows=[...html.matchAll(/<span class="payout-name">([^<]+)<\/span>\s*<span class="payout-reward"[^>]*>([^<]+)<\/span>/g)].map(m=>[m[1],m[2]]);
  for(const [name,factor] of [['صندوق',50],['الماس',30],['هفت',20],['سکه',10],['ژتون شانس',5]])assert.match(rows.find(([label])=>label.includes(name))[1],new RegExp('x'+factor+'(?: |$)'));
  assert.match(rows.find(([label])=>label.includes('۲ نماد'))[1],/^x2$/);
  assert.match(rows.find(([label])=>label.includes('شلوار'))[1],/x0/);
  assert.match(rows.find(([label])=>label.includes('بمب'))[1],/بدون کسر اضافه/);
  assert.match(html,/۲۰ × ضریب ژتون/);assert.match(html,/جفت شلوار، جمجمه یا بمب جایزه ندارد/);
  assert.match(html,/شرط ۲۰۰ و جایزهٔ انرژی ۴۰/);assert.match(html,/خالص = جایزه منهای شرط/);
});

function slot({realAnimation=false,reduced=false}={}){
  const nodes=new Map(),timers=new Map(),events={},sounds=[];let seq=0;
  class Node extends Element{appendChild(n){this.append(n);}set innerHTML(s){this._html=s;this.children=[];}get innerHTML(){return this._html;}set innerText(s){this.textContent=s;}get innerText(){return this.textContent;}}
  const $=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};
  const document={getElementById:$,createElement:()=>new Node(),querySelectorAll:()=>[],visibilityState:'visible',addEventListener:(k,fn)=>events[k]=fn};
  const wallet={pending:null,busy:false,subscribe(){},mutate:async()=>receipt()};
   const window={addEventListener:(k,fn)=>events[k]=fn,matchMedia:()=>({matches:reduced})};
  const context=vm.createContext({window,document,SimabWallet:wallet,localStorage:{setItem(){}},setTimeout:(fn,ms)=>{timers.set(++seq,{fn,ms});return seq;},clearTimeout:id=>timers.delete(id),console});
  vm.runInContext(html.match(/<script>\s*\/\/ ================= ۱\.[\s\S]*?<\/script>/)[0].replace(/^<script>|<\/script>$/g,''),context);
   vm.runInContext('playWinSound=()=>sounds.push("win");playBombSound=()=>sounds.push("loss");playTone=()=>sounds.push("draw");'+(realAnimation?'':'animateReel=(id,s,d,done)=>{if(done)setTimeout(done,1610);}'),Object.assign(context,{sounds}));
  return {context,wallet,timers,events,sounds,$,run:s=>vm.runInContext(s,context),flush:async()=>{const tasks=[...timers.values()];timers.clear();for(const t of tasks)t.fn();await tick();}};
}
const receipt=(version=1,payout=0,bet=2)=>({sessionId:'slot-test',version,state:{kind:'slot',reels:[0,1,2],bet,payout,finished:true}});
test('Auto Stop clears inter-spin timer and invalidates an already-queued callback',async()=>{
  const h=slot();let calls=0;h.wallet.mutate=async()=>{calls++;return receipt(calls);};
  h.run('toggleAutoSpin()');await tick();await h.flush();
  const queued=[...h.timers.values()][0].fn;
  h.run('toggleAutoSpin()');assert.equal(h.timers.size,0);queued();await tick();assert.equal(calls,1);
});
test('Stop during submitted wager retains result, prevents next wager and blocks rapid taps',async()=>{
  const h=slot();let resolve,calls=0;h.wallet.mutate=()=>{calls++;return new Promise(r=>resolve=r);};
  h.run('toggleAutoSpin();spinSlot();spinSlot()');await tick();h.run('toggleAutoSpin()');assert.equal(calls,1);
  resolve(receipt());await tick();await h.flush();assert.equal(h.timers.size,0);assert.match(h.$('win-display').textContent,/خالص/);
});
test('Stop before wallet readiness prevents an unsubmitted automatic wager',async()=>{
  const h=slot();let ready,calls=0;h.wallet.ready=new Promise(r=>ready=r);h.wallet.mutate=async()=>{calls++;return receipt();};
  h.run('toggleAutoSpin();toggleAutoSpin()');ready();await tick();assert.equal(calls,0);assert.equal(h.run('isSpinning'),false);
});
test('manual spin during Auto gap cancels old timer; stop/re-enable does not duplicate wager',async()=>{
  const h=slot();let calls=0;h.wallet.mutate=async()=>receipt(++calls);
  h.run('toggleAutoSpin()');await tick();await h.flush();const old=[...h.timers.values()][0].fn;
  h.run('spinSlot();toggleAutoSpin();toggleAutoSpin()');old();await tick();assert.equal(calls,2);await h.flush();assert.equal(h.timers.size,1);
});
test('uncertain wager stops Auto, leaves pending recovery intact and deduplicates receipt sounds',async()=>{
  const h=slot();const pending={requestId:'original'};h.wallet.mutate=async()=>{h.wallet.pending=pending;throw Error('timeout');};
  h.run('toggleAutoSpin()');await tick();assert.equal(h.run('autoSpinActive'),false);assert.equal(h.wallet.pending,pending);
  let calls=0;h.wallet.mutate=async()=>{calls++;};await h.run('spinSlot()');assert.equal(calls,0);
  h.wallet.pending=null;h.events['simab-receipt']({detail:receipt()});h.events['simab-receipt']({detail:receipt()});assert.deepEqual(h.sounds,['loss']);
});
test('slot sounds classify net loss, draw and win only after accepted results',()=>{
  const h=slot();for(const r of [receipt(1,20,100),receipt(2,20,20),receipt(3,40,20)])h.events['simab-receipt']({detail:r});
  assert.deepEqual(h.sounds,['loss','draw','draw','win']);
});
test('hidden/pagehide disables future Auto but not submitted work',async()=>{
  for(const event of ['visibilitychange','pagehide']){const h=slot();h.run('toggleAutoSpin()');await tick();await h.flush();h.run('document.visibilityState="hidden"');h.events[event]();assert.equal(h.run('autoSpinActive'),false);assert.equal(h.timers.size,0);}
});
test('slot real animation callbacks cancel on page exit, including callbacks already queued',async()=>{
 const h=slot({realAnimation:true});await h.run('spinSlot()');assert.equal(h.run('isSpinning'),true);
 const queued=[...h.timers.values()].map(t=>t.fn);h.events.pagehide();assert.equal(h.timers.size,0);assert.equal(h.run('isSpinning'),false);
 queued.forEach(fn=>fn());assert.equal(h.timers.size,0);assert.deepEqual(h.sounds,[]);assert.match(h.$('win-display').textContent,/خالص/);
});
test('slot reduced motion settles immediately without reel timers or duplicate sounds',async()=>{
 const h=slot({realAnimation:true,reduced:true});await h.run('spinSlot()');assert.equal(h.run('isSpinning'),false);assert.equal(h.timers.size,0);assert.deepEqual(h.sounds,['loss']);
 h.events['simab-receipt']({detail:receipt()});assert.deepEqual(h.sounds,['loss']);
});
test('slot response after page exit presents accepted result silently and never starts animation',async()=>{
 const h=slot({realAnimation:true});let resolve;h.wallet.mutate=()=>new Promise(r=>resolve=r);const spin=h.run('spinSlot()');await tick();h.events.pagehide();resolve(receipt());await spin;
 assert.equal(h.timers.size,0);assert.equal(h.run('isSpinning'),false);assert.deepEqual(h.sounds,[]);assert.match(h.$('win-display').textContent,/خالص/);
});

const bgState=()=>({kind:'backgammon',points:Array(24).fill(0),bar:[0,0],off:[0,0],dice:[1,6],turn:0,moves:[],log:[],finished:false,winner:-1});
function bg(){return uiHarness('assets/js/simab-backgammon-v10.js','accept,animate,send,choose',{globals:{SimabGameRoom:{open(){},fit(){},close(){},delay:async()=>{}}}});}
test('legacy backgammon displays all six numeric dice with matching pip counts',()=>{
  const h=bg();for(let d=1;d<=6;d++){h.api.accept({sessionId:'bg',version:d,state:{...bgState(),dice:[d]}});const b=h.$('bg-dice').children[0];assert.equal(b.querySelector('.bg-die-number').textContent,String(d));assert.equal(b.querySelectorAll('.pip').length,d);}
});
test('backgammon checker animation does not replay dice; new turn rolls sound once',async()=>{
  const h=bg(),s=bgState();h.api.accept({sessionId:'bg',version:1,state:s});
  const frame={...s,dice:[6]},r={sessionId:'bg',version:2,state:{...frame,timeline:[frame,frame]}};await h.api.animate(r);assert.deepEqual(h.sounds,['chip']);
  const roll={sessionId:'bg',version:3,state:{...s,turn:1,timeline:[{...s,turn:1},{...s,turn:1,dice:[6]},s]}};await h.api.animate(roll);await h.api.animate(roll);assert.deepEqual(h.sounds,['chip','dice','chip']);
});
test('backgammon failed moves are silent, turn validation retained and terminal sounds deduplicate',async()=>{
  const h=bg(),s=bgState();h.api.accept({sessionId:'bg',version:1,state:s});h.wallet.mutate=async()=>{throw Error('invalid_move');};await h.api.send('move',{from:1,die:6});assert.deepEqual(h.sounds,[]);
  for(const [i,winner] of [1,-1,0].entries()){const r={sessionId:'bg',version:i+2,state:{...s,finished:true,winner}};h.api.accept(r);h.api.accept(r);}assert.deepEqual(h.sounds,['fold','tap','win']);
});
test('legacy table rejected roll is silent; accepted roll and duplicate receipt sound once',async()=>{
  const h=uiHarness('assets/js/simab-table-games-v13.js','accept,send');const s={kind:'ludo',pieces:Array.from({length:4},()=>[-1,-1,-1,-1]),current:0,die:0,legal:[],log:[],finished:false};
  h.api.accept({sessionId:'l',version:1,state:s});h.wallet.mutate=async()=>{throw Error('rejected');};await h.api.send('move',{type:'roll'});assert.deepEqual(h.sounds,[]);
  h.wallet.mutate=async()=>({sessionId:'l',version:2,state:{...s,die:3}});await h.api.send('move',{type:'roll'});await h.api.send('move',{type:'roll'});assert.deepEqual(h.sounds,['dice']);
});
test('legacy blackjack results distinguish net loss, push and win and deduplicate',()=>{
  const h=uiHarness('assets/js/simab-table-games-v13.js','accept',{game:'blackjack'});
  for(const [i,payout] of [0,10,20].entries()){const r={sessionId:'bj',version:i+1,state:{kind:'blackjack',finished:true,payout,dealer:[],dealerTotal:0,hands:[{bet:10,cards:[],total:0}],log:[]}};h.api.accept(r);h.api.accept(r);}
  assert.deepEqual(h.sounds,['fold','tap','win']);
});
