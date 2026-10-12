import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {Script,runInNewContext} from 'node:vm';
const root=new URL('../',import.meta.url).pathname;
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const games=[
 'index.html','swap/index.html','games/poker/index.html',
 'games/backgammon/index.html','games/slot/index.html',
 'games/tap/index.html','games/wheel/index.html',
 'games/horoscope/index.html','games/cards/index.html',
 'streak/index.html','friends/index.html'
];
test('all V6 game pages have valid inline JavaScript and shared guard loads',()=>{
 for(const p of games){
  const html=read(p);
  for(const [,script] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))
   new Script(script,{filename:p});
  const src=html.match(/<script src="([^"]*simab-legacy-guard\.js\?v=1)"\s*><\/script>/);
  assert.ok(src,'missing guard in '+p);
  const file=resolve(root,dirname(p),src[1].split('?')[0]);
  assert.ok(existsSync(file),'broken script path in '+p);
 }
});
test('pages cannot default to admin account outside Telegram',()=>{
 for(const path of ['games/poker/index.html','games/slot/index.html','games/backgammon/index.html','swap/index.html']){
  assert.match(read(path),/let uid = "guest"/);
  assert.doesNotMatch(read(path),/let uid = "702007470"/);
 }
});
test('no shared user_balance wallet is read/written by independent pages',()=>{
 for(const path of ['swap/index.html','games/tap/index.html','games/backgammon/index.html','games/cards/index.html']){
  assert.doesNotMatch(read(path),/localStorage\.(?:getItem|setItem)\(\s*['"]user_balance['"]/);
 }
});
test('gift cards use separate demo-only credits',()=>{
 const html=read('games/cards/index.html');
 assert.match(html,/CARD_DEMO_STORAGE_KEY/);
 assert.match(html,/simab_cards_demo_/);
 assert.match(html,/S \(آزمایشی\)/);
 assert.match(html,/صدور کارت آزمایشی/);
});
test('helper prevents invalid, negative, Infinity and malformed inventory',()=>{
 const values=new Map();
 const context={window:{},localStorage:{getItem:(k)=>values.has(k)?values.get(k):null,setItem:(k,v)=>values.set(k,v)}};
 runInNewContext(read('assets/js/simab-legacy-guard.js'),context);
 const api=context.window.SimabLegacy;
 assert.equal(api.safeAmount(-5,50),50);
 assert.equal(api.safeAmount(Infinity,50),50);
 assert.equal(api.safeAmount(Number.NaN,50),50);
 assert.equal(api.safeAmount(500),500);
 assert.equal(api.readAmount('missing',50),50);
 values.set('coins','Infinity'); assert.equal(api.readAmount('coins',50),50);
 values.set('coins','-999'); assert.equal(api.readAmount('coins',50),50);
 values.set('coins','125.25'); assert.equal(api.readAmount('coins',50),125.25);
 values.set('inv','{"c1":4,"c5":-7,"c25":"Infinity","c100":3.5,"c500":2}');
 const inv=api.readInventory('inv');
 assert.equal(inv.c1,4); assert.equal(inv.c5,0);
 assert.equal(inv.c25,0); assert.equal(inv.c100,0);
 assert.equal(inv.c500,2);
});
test('relative page navigation resolves to existing files',()=>{
 for(const p of games){
  const html=read(p);
  for(const hit of html.matchAll(/(?:href\s*=|window\.location\.href\s*=|window\.location\.assign\()\s*['"]([^'"]+)['"]/g)){
   const link=hit[1];
   if (/^(https?:|#|tel:|mailto:|javascript:|data:)/.test(link)||link.includes('$'+'{'))continue;
   const target=resolve(root,dirname(p),link.split('?')[0].split('#')[0]);
   assert.ok(existsSync(target),'broken route '+p+' -> '+link);
  }
 }
});
test('server reward ledger stays separate from unverified game chips',()=>{
 const sql=read('supabase/migrations/20261012_verified_quest_rewards.sql');
 const client=read('assets/js/simab-central-quests.js');
 assert.match(sql,/UNIQUE\(telegram_subject,quest_id\)/);
 assert.match(client,/سکه‌های قدیمی مرورگر یکی نیستند|سکه‌های قدیمی بازی جدا هستند/);
 assert.match(read('supabase/functions/simab-central-quests/index.ts'),/spendableInGames:false/);
});
