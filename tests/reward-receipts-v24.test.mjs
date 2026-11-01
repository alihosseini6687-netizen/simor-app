import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,runInNewContext} from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function harness(path,receipt){
  const html=read(path);
  const match=html.match(/<script>([\s\S]*?)<\/script><\/body><\/html>$/);
  assert.ok(match,path+' has a standalone inline controller');
  new Script(match[1],{filename:path});
  const nodes=new Map();
  for(const id of ['claim','reward-wheel','reward-result','reward-sound','streak'])
    nodes.set(id,{id,disabled:false,textContent:'',style:{},onclick:null});
  const days=Array.from({length:7},(_,i)=>({
    dataset:{day:String(i+1)},classList:{toggle(){}}
  }));
  let subscriber=()=>{};
  const calls=[],sounds=[];
  const state={wheelAvailable:true,dailyAvailable:true,streakDay:0};
  const wallet={
    state,
    subscribe(fn){subscriber=fn;fn(state);},
    async mutate(action,payload){
      calls.push({action,payload});
      state[action==='wallet'&&payload.walletAction==='wheel'?'wheelAvailable':'dailyAvailable']=false;
      subscriber(state);
      return receipt;
    }
  };
  const ctx={
    document:{
      getElementById:id=>nodes.get(id),
      querySelectorAll:selector=>selector==='[data-day]'?days:[]
    },
    SimabWallet:wallet,
    SimabSound:{unlock(){},toggle(){},play:name=>sounds.push(name)},
    matchMedia:()=>({matches:true}),
    setTimeout:callback=>{callback();return 1}
  };
  runInNewContext(match[1],ctx);
  return {nodes,state,calls,sounds,wallet};
}
const click=async h=>h.nodes.get('claim').onclick();
test('both wheel entry points use verified server prize, not local randomness',async()=>{
  for(const path of ['games/wheel/index.html','games/tap/index.html']){
    const h=harness(path,{rewardCoins:5,result:{wheelReward:5}});
    await click(h);
    assert.equal(h.calls.length,1,path);
    assert.equal(h.calls[0].payload.walletAction,'wheel',path);
    assert.match(h.nodes.get('reward-wheel').style.transform,/^rotate\(\d+deg\)$/);
    assert.match(h.nodes.get('reward-result').textContent,/۵ سکه/);
    assert.ok(h.sounds.includes('roll'));
    assert.equal(h.nodes.get('claim').disabled,true);
  }
});
test('wheel duplicate, already spun and missing prize never animate or report zero win',async()=>{
 for(const receipt of [{duplicate:true,rewardCoins:10},{result:{alreadySpun:true}},{}]){
  const h=harness('games/wheel/index.html',receipt);
  await click(h);
  assert.equal(h.nodes.get('reward-wheel').style.transform,undefined);
  assert.equal(h.sounds.length,0);
  assert.doesNotMatch(h.nodes.get('reward-result').textContent,/۰ سکه در کیف/);
  assert.ok(h.nodes.get('reward-result').textContent.length>0);
 }
});
test('wheel rotations advance instead of snapping back when daily availability changes',async()=>{
 const h=harness('games/wheel/index.html',{rewardCoins:2,result:{wheelReward:2}});
 await click(h);
 const a=Number(h.nodes.get('reward-wheel').style.transform.match(/\d+/)[0]);
 h.state.wheelAvailable=true;
 h.nodes.get('claim').disabled=false;
 await click(h);
 const b=Number(h.nodes.get('reward-wheel').style.transform.match(/\d+/)[0]);
 assert.ok(b>a);
 assert.equal(a%360,b%360);
});
test('daily streak confirms exactly a permitted server reward, handling duplicates and invalid replies',async()=>{
 const ok=harness('streak/index.html',{rewardCoins:7});
 await click(ok);
 assert.match(ok.nodes.get('reward-result').textContent,/۷ سکه/);
 assert.deepEqual(ok.sounds,['win']);
 const duplicate=harness('streak/index.html',{duplicate:true});
 await click(duplicate);
 assert.equal(duplicate.sounds.length,0);
 assert.match(duplicate.nodes.get('reward-result').textContent,/قبلاً/);
 const invalid=harness('streak/index.html',{});
 await click(invalid);
 assert.equal(invalid.sounds.length,0);
 assert.match(invalid.nodes.get('reward-result').textContent,/معتبر نیست/);
});
