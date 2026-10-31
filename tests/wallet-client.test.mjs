import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {runInNewContext} from 'node:vm';import {webcrypto} from 'node:crypto';
const source=readFileSync(new URL('../assets/js/simab-wallet-client.js',import.meta.url),'utf8');
function client(fetch,storage=new Map(),features={}){
 const nodes=new Map(),events=new Map();const node=()=>({textContent:'',style:{},append(){},hidden:true});
 const document={readyState:'loading',visibilityState:'visible',querySelectorAll:()=>[],getElementById:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},createElement:node,body:{append(){}},addEventListener:(e,fn)=>events.set(e,fn)};
 const window={Telegram:{WebApp:{initData:new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),hash:'unit-test-signature',user:JSON.stringify({id:123456})}).toString()}},addEventListener(){},dispatchEvent(){}};
 const context={document,window,URLSearchParams,Date,AbortSignal,AbortController,setTimeout,clearTimeout,crypto:webcrypto,fetch,console,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},sessionStorage:{getItem:()=>null}};
 Object.assign(context,features);runInNewContext(source,context);events.get('DOMContentLoaded')();return{api:window.SimabWallet,storage,window};
}
const response=(body,status=200)=>({ok:status<400,status,json:async()=>body});
test('lost wallet response and reload retry reuse one ID and apply one conversion',async()=>{
 const stored=new Map([['simor_coins_123456','99999999']]);let coins=1000,chips=0,first=true;const seen=new Map(),ids=[];
 const fetch=async(_,options)=>{const p=JSON.parse(options.body);if(p.walletAction==='state')return response({serverWallet:true,coins,chips});ids.push(p.requestId);
  if(!seen.has(p.requestId)){coins-=p.amount;chips+=p.amount;seen.set(p.requestId,true);}if(first){first=false;throw Error('lost response');}
  return response({serverWallet:true,coins,chips,duplicate:true});};
 const a=client(fetch,stored);await a.api.ready;await assert.rejects(a.api.mutate('wallet',{walletAction:'exchange_to_chips',amount:100}),/lost response/);assert.ok(a.api.pending);
 const b=client(fetch,stored);await b.api.ready;assert.equal(b.api.state.coins,900);assert.equal(b.api.state.chips,100);assert.equal(b.api.pending,null);assert.equal(new Set(ids).size,1);assert.equal(stored.get('simor_coins_123456'),'99999999');
});
test('malformed successful response keeps original request available for recovery',async()=>{
 const c=client(async(_,o)=>response(JSON.parse(o.body).walletAction==='state'?{serverWallet:true,coins:100,chips:0}:{}));await c.api.ready;
 await assert.rejects(c.api.mutate('wallet',{walletAction:'exchange_to_chips',amount:5}),/پاسخ موجودی/);assert.ok(c.api.pending);
});
test('account change cannot replay the old account financial request',async()=>{
 let sends=0;const c=client(async(_,o)=>{const p=JSON.parse(o.body);if(p.walletAction==='state')return response({serverWallet:true,coins:100,chips:0});sends++;throw Error('offline');});await c.api.ready;
 await assert.rejects(c.api.mutate('wallet',{walletAction:'exchange_to_chips',amount:5}));
 c.window.Telegram.WebApp.initData=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),hash:'test',user:JSON.stringify({id:654321})}).toString();
 await assert.rejects(c.api.recover(),/همان حساب/);assert.equal(sends,1);
});
test('amount parsing accepts Persian and Arabic digits but rejects truncation',async()=>{
 const c=client(async()=>response({serverWallet:true,coins:0,chips:0}));await c.api.ready;
 assert.equal(c.api.integer('۱۰۰۰'),1000);assert.equal(c.api.integer('١٢'),12);for(const v of ['3.5','12abc','-1','Infinity','0'])assert.throws(()=>c.api.integer(v));
});


test('older iOS without AbortSignal.timeout or crypto.randomUUID can read balances and purchase chips',async()=>{
 const requests=[];const legacyCrypto={getRandomValues:array=>webcrypto.getRandomValues(array)};
 const c=client(async(_,options)=>{const p=JSON.parse(options.body);requests.push(p);return response({serverWallet:true,coins:p.walletAction==='state'?1000:900,chips:p.walletAction==='state'?0:100});},new Map(),{AbortSignal:{},crypto:legacyCrypto});
 await c.api.ready;assert.equal(c.api.state.coins,1000);
 await c.api.mutate('wallet',{walletAction:'exchange_to_chips',amount:100});
 assert.equal(c.api.state.coins,900);assert.equal(c.api.state.chips,100);
 const id=requests.at(-1).requestId;assert.match(id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
 assert.notEqual(c.api.requestId(),c.api.requestId());
});
test('request timeout fallback also works if AbortController is unavailable',async()=>{
 const c=client(async(_,options)=>{assert.equal(options.signal,undefined);return response({serverWallet:true,coins:123,chips:45});},new Map(),{AbortSignal:undefined,AbortController:undefined});
 await c.api.ready;assert.equal(c.api.state.coins,123);assert.equal(c.api.state.chips,45);
});

test('lost private room response survives reload and recovers the same escrow request',async()=>{
 const storage=new Map();let first=true,chips=500;const ids=[];let applied=false;
 const fetch=async(_,options)=>{const p=JSON.parse(options.body);if(p.walletAction==='state')return response({serverWallet:true,coins:0,chips});ids.push(p.requestId);if(!applied){chips-=100;applied=true;}if(first){first=false;throw Error('lost room response');}return response({room:{code:'ABCDEFGH23',status:'waiting'},version:1,state:null,wallet:{serverWallet:true,coins:0,chips},duplicate:true});};
 const a=client(fetch,storage);await a.api.ready;await assert.rejects(a.api.mutate('room',{op:'create',amount:100,maxPlayers:2}));assert.ok(a.api.pending);
 const b=client(fetch,storage);await b.api.ready;assert.equal(b.api.state.chips,400);assert.equal(b.api.pending,null);assert.equal(new Set(ids).size,1);
});
test('malformed private room receipt preserves recovery even when the wallet is valid',async()=>{
 const c=client(async(_,options)=>{const p=JSON.parse(options.body);return response(p.walletAction==='state'?{serverWallet:true,coins:0,chips:500}:{wallet:{serverWallet:true,coins:0,chips:400}});});await c.api.ready;await assert.rejects(c.api.mutate('room',{op:'create',amount:100,maxPlayers:2}),/پاسخ میز/);assert.ok(c.api.pending);
});
test('overlapping reads cannot roll wallet display backwards',async()=>{
 const c=client(async()=>response({serverWallet:true,coins:100,chips:0}));await c.api.ready;
 let older,newer;const queue=[];
 // A fresh client keeps controllable network responses without application hooks.
 const h=client(async(_,o)=>{const p=JSON.parse(o.body);if(p.walletAction==='state')return response({serverWallet:true,coins:100,chips:0});return new Promise(r=>queue.push(r));});await h.api.ready;
 older=h.api.read('room',{op:'state'});newer=h.api.read('room',{op:'state'});
 queue[1](response({wallet:{serverWallet:true,coins:80,chips:20}}));await newer;
 queue[0](response({wallet:{serverWallet:true,coins:100,chips:0}}));await older;
 assert.equal(h.api.state.chips,20);
});
test('refresh begun during settlement cannot overwrite its accepted balance',async()=>{
 let settle,refresh,reads=0;
 const c=client(async(_,o)=>{const p=JSON.parse(o.body);if(p.walletAction==='state'){if(++reads===1)return response({serverWallet:true,coins:100,chips:0});return new Promise(r=>refresh=r);}return new Promise(r=>settle=r);});await c.api.ready;
 const wager=c.api.mutate('wallet',{walletAction:'exchange_to_chips',amount:20});await new Promise(setImmediate);
 const stale=c.api.refresh();settle(response({serverWallet:true,coins:80,chips:20}));await wager;
 refresh(response({serverWallet:true,coins:100,chips:0}));await stale;assert.equal(c.api.state.chips,20);
});
test('rate-limited recovery retains immutable request ID; rapid duplicate submits do not send',async()=>{
 let sends=0;const ids=[];const c=client(async(_,o)=>{const p=JSON.parse(o.body);if(p.walletAction==='state')return response({serverWallet:true,coins:100,chips:0});sends++;ids.push(p.requestId);return sends===1?response({error:'rate_limited'},429):response({serverWallet:true,coins:95,chips:5});});await c.api.ready;
 const one=c.api.mutate('wallet',{walletAction:'exchange_to_chips',amount:5});const two=c.api.mutate('wallet',{walletAction:'exchange_to_chips',amount:5});
 const results=await Promise.allSettled([one,two]);assert.ok(results.every(r=>r.status==='rejected'));assert.equal(sends,1);assert.ok(c.api.pending);
 await c.api.recover();assert.equal(new Set(ids).size,1);assert.equal(c.api.state.coins+c.api.state.chips,100);
});
test('negative server balances are rejected without losing financial recovery',async()=>{
 const c=client(async(_,o)=>response(JSON.parse(o.body).walletAction==='state'?{serverWallet:true,coins:100,chips:0}:{serverWallet:true,coins:-1,chips:5}));await c.api.ready;
 await assert.rejects(c.api.mutate('wallet',{walletAction:'exchange_to_chips',amount:5}));assert.ok(c.api.pending);assert.equal(c.api.state.coins,100);
});
