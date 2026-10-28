import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {createHmac, webcrypto} from 'node:crypto';
import {stripImports} from './support/source.mjs';
const code=stripTypeScriptTypes(stripImports(readFileSync(new URL('../supabase/functions/simab-central-quests/index.ts',import.meta.url),'utf8')));
const token='123456:test-only';
function signed(id){
 const fields={auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id})};
 const data=Object.entries(fields).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');
 const secret=createHmac('sha256','WebAppData').update(token).digest();
 return new URLSearchParams({...fields,hash:createHmac('sha256',secret).update(data).digest('hex')}).toString();
}
function server(admin){
 let handle,calls=[];
 const db={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:admin?{telegram_subject:'702007470'}:null,error:null})})})}),
  rpc:async(name,p)=>{calls.push({name,p});return {data:{serverWallet:true,targetUserId:p.p_target,amount:p.p_amount,coins:p.p_amount,requestId:p.p_request_id},error:null};}};
 const Deno={serve:f=>{handle=f;},env:{get:k=>({SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'test-only',SIMAB_TELEGRAM_BOT_TOKEN:token})[k]}};
 new Function('Deno','createClient','gameAPI','crypto',code)(Deno,()=>db,()=>{throw Error('unexpected game');},webcrypto);
 return {calls,request:body=>handle(new Request('https://example.invalid/functions/v1/simab-central-quests',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}))};
}
const payload={action:'admin_credit',targetUserId:'123456',amount:50,requestId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'};
test('credit requires valid Telegram signature and database admin membership',async()=>{
 const s=server(true);assert.equal((await s.request({...payload,initData:'invalid'})).status,401);assert.equal(s.calls.length,0);
 const nonadmin=server(false);assert.equal((await nonadmin.request({...payload,initData:signed(123)})).status,403);assert.equal(nonadmin.calls.length,0);
});
test('credit RPC actor comes from signed user, never caller JSON',async()=>{
 const s=server(true),r=await s.request({...payload,adminUserId:'999',initData:signed(702007470)});
 assert.equal(r.status,200);assert.equal(s.calls[0].p.p_admin,'702007470');assert.equal(s.calls[0].p.p_target,'123456');
});
test('invalid amounts, recipient IDs and missing request IDs never reach RPC',async()=>{
 const s=server(true);
 for(const bad of [{amount:0},{amount:1.5},{amount:1000000000001},{targetUserId:'@user'},{targetUserId:'0'},{requestId:''}]){
  assert.equal((await s.request({...payload,...bad,initData:signed(702007470)})).status,400);
 }assert.equal(s.calls.length,0);
});
test('authenticated wallet burst is rate-limited before RPC, independent of forged JSON identity',async()=>{
 const s=server(false),initData=signed(123456);
 for(let i=0;i<120;i++){
  const r=await s.request({action:'wallet',walletAction:'daily',amount:0,requestId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',actorId:String(i),initData});assert.equal(r.status,200);
 }
 const denied=await s.request({action:'wallet',walletAction:'daily',amount:0,requestId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',actorId:'987654',initData});assert.equal(denied.status,429);assert.equal((await denied.json()).error,'rate_limited');assert.equal(s.calls.length,120);
});
