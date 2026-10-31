import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {projectRoot,normalizeSource,stripImports,readSource} from './support/source.mjs';
import {Element,uiHarness} from './support/ui-harness.mjs';
import {startL,moveHumanL,publicL} from '../supabase/functions/simab-central-quests/table-games.ts';

const shared=game=>uiHarness('assets/js/simab-party-v16.js','accept,syncButtons,roll,resetRoom,resultSound',{game});
const legacy=()=>uiHarness('assets/js/simab-table-games-v13.js','accept,ludoBoard,ludoDice,render');
const members=n=>Array.from({length:n},(_,i)=>({subject:String(i),name:'Player '+i,emoji:'x'}));
const room=(game='ludo',n=4)=>({game,code:'TESTROOM23',viewer:0,host:true,status:'playing',maxPlayers:n,buyIn:0,members:members(n),messages:[],signals:[]});
const state=()=>({kind:'ludo',n:4,event:1,current:0,finished:false,winners:[],lastEvent:'shuffle',table:publicL(startL(20))});
const receipt=s=>({sessionId:'legacy',version:1,state:publicL(s)});

test('phase1 portability: LF/CRLF imports and admin extraction behave identically',()=>{
  const input="import {x} from 'x';\nconst result=1;\nimport 'last';";
  for(const ending of ['\n','\r\n']){const source=input.replaceAll('\n',ending);assert.equal(normalizeSource(source),input);assert.equal(stripImports(source),'const result=1;\n');new vm.Script(stripImports(source));}
  const admin=readSource(new URL('../assets/js/simab-central-quests.js',import.meta.url));
  for(const source of [admin,admin.replaceAll('\n','\r\n')]){const normalized=normalizeSource(source),start=normalized.indexOf('  function wireAdminCredit()'),end=normalized.indexOf('  if (isAdmin) {\n    wireAdminCredit();');assert.ok(start>=0&&end>start);new vm.Script(normalized.slice(start,end));}
});

test('phase1 portability: project assets resolve as native paths, including escaped URLs',()=>{
  assert.equal(projectRoot,fileURLToPath(new URL('../',import.meta.url)));
  for(const path of ['package.json','index.html','assets/js/simab-wallet-client.js'])assert.ok(existsSync(resolve(projectRoot,path)));
  const url=new URL('./folder%20name/%D9%85%D9%86%DA%86.js',new URL('../',import.meta.url));
  assert.ok(fileURLToPath(url).includes('folder name'));assert.ok(!fileURLToPath(url).includes('%D9'));
});

test('phase1 Start: selected seats, host, room status, pending requests and polling stay consistent',()=>{
  const h=shared('ludo'),r={...room(),status:'waiting',members:members(2)};
  h.api.accept({room:r,state:null});assert.equal(h.$('start').disabled,true);
  r.members=members(4);h.api.accept({room:r,state:null});assert.equal(h.$('start').disabled,false);
  h.subscriptions.forEach(fn=>fn());assert.equal(h.$('start').disabled,false);
  h.wallet.pending={};h.api.syncButtons();assert.equal(h.$('start').disabled,true);h.wallet.pending=null;
  for(const patch of [{host:false},{status:'playing'},{members:members(3)},{members:members(5)}]){h.api.accept({room:{...r,...patch},state:patch.status==='playing'?state():null});assert.equal(h.$('start').disabled,true);}
  for(const n of [2,3,4]){h.api.accept({room:{...r,maxPlayers:n,members:members(n)},state:null});assert.equal(h.$('start').disabled,false);}
});

test('phase1 legacy dice: six pip/number faces, unknown initial value and older states',()=>{
  const h=legacy(),s=startL(20);
  assert.equal(h.api.ludoDice(publicL(s)).dataset.value,'');
  for(let value=1;value<=6;value++){const dice=h.api.ludoDice({...publicL(s),lastRoll:{player:2,value}});assert.equal(dice.dataset.value,value);assert.equal(dice.querySelectorAll('i').length,value);assert.match(dice.textContent,new RegExp(String(value)));assert.equal(dice.disabled,false);}
  const dice=h.api.ludoDice({...publicL(s),die:6});assert.equal(dice.dataset.value,6);assert.equal(dice.disabled,true);
});

test('phase1 legacy history: blocked rolls, moves and third six retain result without granting a move',()=>{
  const h=legacy(),original=crypto.getRandomValues;
  let version=0;function roll(s,value){crypto.getRandomValues=a=>(a[0]=value-1,a);try{moveHumanL(s,s.current,{type:'roll'});}finally{crypto.getRandomValues=original;}h.api.accept({...receipt(s),version:++version});}
  const s=startL(20);roll(s,3);assert.match(h.$('board').querySelector('.ludo-roll-history').textContent,/3/);assert.equal(h.$('board').querySelector('.legacy-dice').disabled,true);assert.ok(h.$('board').querySelectorAll('.ludo-piece.green').every(p=>p.disabled));
  const t=startL(20);roll(t,6);moveHumanL(t,0,{type:'piece',index:0});h.api.accept({...receipt(t),version:++version});assert.equal(h.$('board').querySelector('.legacy-dice').dataset.value,6);assert.ok(h.$('board').querySelectorAll('.ludo-piece.green').every(p=>p.disabled));
  t.sixes=2;roll(t,6);assert.equal(t.current,1);assert.equal(h.$('board').querySelector('.legacy-dice').dataset.value,6);assert.equal(h.$('board').querySelector('.legacy-dice').disabled,true);
});

test('phase1 legacy pawns: numbers, yard/track/lane/finish mapping, opposite colors and packed cells',()=>{
  const h=legacy(),s=startL(20),board=h.api.ludoBoard(publicL(s)),cells=board.querySelectorAll('.ludo-cell');
  assert.equal(cells.length,225);assert.equal(board.querySelectorAll('.ludo-piece').length,16);
  for(const [i,cell] of [32,34,62,64].entries())assert.equal(cells[cell].querySelector('.ludo-piece').textContent,String(i+1));
  s.pieces[0]=[0,51,56,57];const mapped=h.api.ludoBoard(publicL(s)).querySelectorAll('.ludo-cell');
  for(const [i,cell] of [91,106,111,112].entries())assert.equal(mapped[cell].querySelector('.ludo-piece').textContent,String(i+1));
  s.pieces=s.pieces.map(()=>[57,57,57,57]);const packed=h.api.ludoBoard(publicL(s)).querySelectorAll('.ludo-cell')[112];assert.equal(packed.querySelectorAll('.ludo-piece').length,16);assert.ok(packed.classList.contains('stacked'));assert.equal(packed.style.getPropertyValue('--stack-cols'),'4');
  const two=h.api.ludoBoard(publicL(startL(20,2)));assert.equal(two.querySelectorAll('.ludo-piece.blue').length,4);assert.equal(two.querySelectorAll('.ludo-piece.red').length,0);
});

test('phase1 legacy turns: active seat and countdown identify actual player and clear on finish',()=>{
  const h=legacy(),s=startL(20);s.current=2;s.turnDeadline=Date.now()+10000;h.api.accept(receipt(s));
  assert.equal(h.$('board').querySelectorAll('.current').length,1);assert.equal(h.$('board').querySelector('.current').getAttribute('aria-current'),'true');
  assert.match(h.$('game-status').textContent,/آبی/);h.intervals.forEach(fn=>fn());assert.match(h.$('game-status').textContent,/آبی/);
  s.finished=true;h.api.accept({...receipt(s),version:2});assert.equal(h.$('board').querySelectorAll('.current').length,0);
});

function layout({width=768,height=820,tg={},visual}={}){
  const events={},telegram={},stage=new Element(),window={Telegram:{WebApp:{...tg,onEvent:(k,fn)=>telegram[k]=fn}},dispatchEvent(){},visualViewport:visual?{scale:1,offsetLeft:0,offsetTop:0,...visual,addEventListener:(k,fn)=>events['visual-'+k]=fn}:undefined};
  const context={window,document:{createElement:tag=>new Element(tag)},innerWidth:width,innerHeight:height,screen:{orientation:{lock:async()=>{throw Error('unsupported');},unlock(){}}},Event:class{},addEventListener:(k,fn)=>events[k]=fn};
  vm.runInNewContext(readSource(new URL('../assets/js/simab-game-room-v12.js',import.meta.url)),context);
  return {context,stage,events,telegram,tg:window.Telegram.WebApp,api:window.SimabGameRoom};
}

test('phase1 rotation: near-square rotation, small width and height-only resizes refresh dimensions',async()=>{
  const h=layout();await h.api.open(h.stage);assert.match(h.stage.style.transform,/rotate\(-90deg\)/);
  h.context.innerWidth=820;h.context.innerHeight=768;h.events.resize();assert.ok(!h.stage.style.transform.includes('rotate('));assert.equal(h.stage.style.width,'820px');assert.equal(h.stage.style.height,'768px');
  h.context.innerWidth=800;h.events.resize();assert.equal(h.stage.style.width,'800px');
  h.context.innerHeight=700;h.events.resize();assert.equal(h.stage.style.height,'700px');
  h.context.innerWidth=390;h.context.innerHeight=844;h.events.orientationchange();assert.equal(h.stage.style.width,'844px');
});

test('phase1 insets: safe and content edges, fullscreen reserve, both rotations and video compensation',async()=>{
  const h=layout({width:390,height:844,tg:{safeAreaInset:{top:20,bottom:10,left:4,right:6},contentSafeAreaInset:{top:8,bottom:12,left:3,right:5}}});await h.api.open(h.stage);
  assert.equal(h.stage.style.width,'794px');assert.equal(h.stage.style.height,'372px');assert.equal(h.stage.style.left,'193px');assert.equal(h.stage.style.top,'425px');assert.equal(h.stage.style.getPropertyValue('--simab-video-rotation'),'90deg');
  h.stage.querySelector('button').onclick();assert.match(h.stage.style.transform,/rotate\(90deg\)/);assert.equal(h.stage.style.getPropertyValue('--simab-video-rotation'),'-90deg');
  h.tg.isFullscreen=true;h.telegram.fullscreenChanged();assert.equal(h.stage.style.width,'758px');
  h.context.innerWidth=844;h.context.innerHeight=390;h.events.resize();assert.match(h.stage.style.transform,/rotate\(180deg\)/);assert.equal(h.stage.style.getPropertyValue('--simab-video-rotation'),'-180deg');
  h.stage.querySelector('button').onclick();assert.equal(h.stage.style.getPropertyValue('--simab-video-rotation'),'0deg');
});

test('phase1 viewport: Telegram and visual viewport changes fit bounds without minimum-size overflow',async()=>{
  const h=layout({width:320,height:640,tg:{viewportStableHeight:640,viewportHeight:600},visual:{width:300,height:250,offsetLeft:10,offsetTop:30}});await h.api.open(h.stage);
  assert.equal(h.stage.style.width,'300px');assert.equal(h.stage.style.height,'250px');assert.equal(h.stage.style.left,'160px');assert.equal(h.stage.style.top,'155px');
  h.context.window.visualViewport.height=180;h.events['visual-resize']();assert.equal(h.stage.style.height,'180px');
  h.context.window.visualViewport.height=640;h.tg.viewportHeight=400;h.telegram.viewportChanged();assert.equal(h.stage.style.width,'400px');
  h.api.close();const width=h.stage.style.width;h.context.innerWidth=1000;h.events.resize();assert.equal(h.stage.style.width,width);
});

test('phase1 dice audio: rapid local taps, receipt/poll replay and remote rolls play one sound per event',()=>{
  const h=shared('ludo'),r=room(),s=state();h.api.accept({room:r,version:1,state:s});let calls=0;
  const move=()=>{calls++;s.event++;s.lastEvent='dice';s.table.lastRoll={player:0,value:3};h.api.accept({room:r,version:s.event,state:s});};
  h.api.roll(move);h.api.roll(move);h.api.roll(move);assert.deepEqual(h.sounds,[]);h.flush();assert.equal(calls,1);assert.deepEqual(h.sounds,['dice']);
  h.api.accept({room:r,version:s.event,state:s});assert.deepEqual(h.sounds,['dice']);
  s.event++;h.api.accept({room:r,version:s.event,state:s});assert.deepEqual(h.sounds,['dice','dice']);
});

test('phase1 dice audio: leaving cancels pending roll and failed/unconfirmed rolls play no result',()=>{
  const h=shared('ludo');h.api.accept({room:room(),version:1,state:state()});let moves=0;h.api.roll(()=>moves++);h.api.resetRoom();h.flush();assert.equal(moves,0);assert.deepEqual(h.sounds,[]);
  h.api.accept({room:room(),version:1,state:state()});h.api.roll(()=>{});h.flush();assert.deepEqual(h.sounds,[]);
});

test('phase1 result audio: viewer wins, teammate wins, loss, shared draw and replay are distinct',()=>{
  for(const [winners,viewer,expected] of [[[0],0,'win'],[[1],0,'fold'],[[0,2],2,'win'],[[],0,'draw'],[[0,1,2,3],0,'draw']]){
    const h=shared('ludo'),r={...room(),viewer},s=state();h.api.accept({room:r,version:1,state:s});
    s.event=2;s.finished=true;s.winners=winners;h.api.accept({room:r,version:2,state:s});h.api.accept({room:r,version:2,state:s});assert.deepEqual(h.sounds,[expected]);
  }
});
