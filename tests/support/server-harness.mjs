import {shopAPI,shopWebhook,tonBalance} from '../../supabase/functions/simab-central-quests/shop.ts';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync,readdirSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {createHmac,webcrypto} from 'node:crypto';
import {pokerRoomAPI} from '../../supabase/functions/simab-central-quests/poker-room-api.ts';
import {gameAPI} from '../../supabase/functions/simab-central-quests/game-api.ts';
export async function harness(){
 const root=new URL('../../',import.meta.url).pathname;const db=new PGlite();await db.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;');
 for(const f of readdirSync(root+'supabase/migrations').sort())await db.exec(readFileSync(root+'supabase/migrations/'+f,'utf8'));
 await db.exec('SET ROLE service_role');
 const client={rpc:async(name,params)=>{try{const keys=Object.keys(params),r=await db.query(`SELECT public.${name}(${keys.map((k,i)=>k+' => $'+(i+1)).join(',')}) as data`,keys.map(k=>params[k]));return{data:r.rows[0].data,error:null};}catch(e){return{data:null,error:{message:e.message}};}},
 from(table){let fields='*',w=[],vals=[],order='',limit='';const q={select(f){fields=f;return q;},eq(k,v){vals.push(v);w.push(k+'=$'+vals.length);return q;},gt(k,v){vals.push(v);w.push(k+'>$'+vals.length);return q;},order(k,o){order=' ORDER BY '+k+(o?.ascending===false?' DESC':' ASC');return q;},limit(n){limit=' LIMIT '+Number(n);return q;},async execute(){try{const r=await db.query(`SELECT ${fields} FROM public.${table}${w.length?' WHERE '+w.join(' AND '):''}${order}${limit}`,vals);return{data:r.rows,error:null};}catch(e){return{data:null,error:{message:e.message}};}},async maybeSingle(){const r=await q.execute();return{...r,data:r.data?.[0]||null};},then(ok,bad){return q.execute().then(ok,bad);}};return q;}};
 let handler;const token='unit-test-only:123456';const Deno={serve:f=>{handler=f;},env:{get:k=>({SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'test-only',SIMAB_TELEGRAM_BOT_TOKEN:token})[k]}};
 const code=stripTypeScriptTypes(readFileSync(root+'supabase/functions/simab-central-quests/index.ts','utf8').replace(/^import .*\n/gm,''));
 new Function('Deno','createClient','gameAPI','pokerRoomAPI','shopAPI','shopWebhook','tonBalance','crypto',code)(Deno,()=>client,gameAPI,pokerRoomAPI,shopAPI,shopWebhook,tonBalance,webcrypto);
 function signed(id){const fields={auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:'تست'})};const data=Object.entries(fields).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');const secret=createHmac('sha256','WebAppData').update(token).digest();return new URLSearchParams({...fields,hash:createHmac('sha256',secret).update(data).digest('hex')}).toString();}
 const post=async(body,id=801000011)=>{const r=await handler(new Request('https://example.invalid/functions/v1/simab-central-quests',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({initData:signed(id),...body})}));return{status:r.status,body:await r.json()};};
 await client.rpc('simab_admin_credit',{p_admin:'702007470',p_target:'801000011',p_amount:1000000,p_request_id:webcrypto.randomUUID()});
 return{db,client,post,signed};
}
