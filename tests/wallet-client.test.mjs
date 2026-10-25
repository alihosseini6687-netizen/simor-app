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
