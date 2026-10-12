import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {Script,runInNewContext} from "node:vm";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const root=fileURLToPath(new URL("../",import.meta.url));
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const screens=["index.html","games/poker/index.html","games/backgammon/index.html","games/slot/index.html","wallet/index.html"];
test("V8 core CSS scrolled container and all active mobile pages",()=>{
 const css=read("assets/css/simab-v8-core.css");
 assert.match(css,/overflow-y:auto!important/);
 assert.match(css,/touch-action:pan-y pinch-zoom!important/);
 assert.doesNotMatch(css,/body\s*\{[^}]*overflow-y:hidden/);
 for(const p of screens){
   const html=read(p);
   assert.match(html,/simab-v8-core\.css\?v=8/);
   const hrefs=[...html.matchAll(/<(?:link|script)[^>]+(?:href|src)="([^"]+)"/g)].map(m=>m[1]);
   for(const h of hrefs){
     if(/^(https?:|\/\/)/.test(h))continue;
     const file=resolve(root,dirname(p),h.split("?")[0]);
     assert.ok(existsSync(file),"missing asset "+p+" -> "+h);
   }
   for(const [,src] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new Script(src,{filename:p});
 }
});
test("home has one popular cards section with hero navigation but no duplicate quick access",()=>{
 const html=read("index.html");
 assert.match(html,/v8-hero-focus/);
 assert.match(html,/v8-card-enhanced/);
 assert.equal((html.match(/v8-card-enhanced/g)||[]).length,3);
 assert.doesNotMatch(html,/⚡ دسترسی سریع/);
 assert.doesNotMatch(html,/class="v4-pulse-banner"/);
});
test("all financial labels explicitly call virtual credits not real money",()=>{
 for(const p of ["wallet/index.html","games/poker/index.html","games/backgammon/index.html","games/slot/index.html"]){
  assert.match(read(p),/مجازی/);
  assert.match(read(p),/برداشت نقدی/);
 }
 const wallet=read("wallet/index.html");
 assert.match(wallet,/تراکنش‌ها در سرور/);
 assert.match(wallet,/هر ۱ سکه = ۱ ژتون/);
});
test("poker strategies vary among bots and never mirror an all-in every hand",()=>{
 const ctx={window:{}};
 runInNewContext(read("assets/js/simab-poker-ai-v8.js"),ctx);
 const api=ctx.window.SimabPokerAI;
 assert.equal(Object.keys(api.profiles).length,5);
 assert.equal(new Set(Object.values(api.profiles).map(p=>p.opening)).size,5);
 assert.equal(new Set(Object.values(api.profiles).map(p=>p.aggression)).size,5);
 const actions=[];
 for(const [id,profile] of Object.entries(api.profiles)){
  const d=api.choose({id,difficulty:"hard",strength:.74,toCall:3,stack:profile.opening,pot:15,rand:.17});
  assert.ok(["check","fold","call","raise"].includes(d.type));
  assert.ok((d.amount||0)<=profile.opening);
  if(d.type==="raise")assert.ok(d.amount<=Math.ceil(profile.opening*.45));
  actions.push([id,d.type,d.amount]);
 }
 assert.ok(new Set(actions.map(x=>x[1]+":"+x[2])).size>1,"Bots all make identical moves");
 const easy=api.choose({id:"bot3",difficulty:"easy",strength:.19,toCall:110,stack:20,pot:5,rand:.75});
 assert.equal(easy.type,"fold");
});
test("poker uses per-bot bankroll, per-round betting, street responses and side-pots",()=>{
 const p=read("games/poker/index.html");
 assert.match(p,/SimabPokerAI\.choose\(/);
 assert.match(p,/pHero\.roundBet=0/);
 assert.match(p,/bot\.roundBet=0/);
 assert.match(p,/pHero\.roundBet<currentHighestBet/);
 assert.match(p,/const tiers=\[\.\.\.new Set\(players\.map\(p=>p\.bet\)/);
 assert.match(p,/const share=Math\.floor\(sidePot\/winners\.length\)/);
 assert.match(p,/SimabSound\.toggle\(this\)/);
});
test("backgammon has real selectable bear-off, blocks ghost pieces and refuses exploitative cube",()=>{
 const html=read("games/backgammon/index.html");
 assert.match(html,/function bearOffSelected\(\)/);
 assert.match(html,/id="v8-bear-off"/);
 assert.match(html,/board\[from\]\.color!==color/);
 assert.match(html,/barWhite>0&&from!=="bar"/);
 assert.match(html,/turnToken!==matchTurnVersion/);
 assert.match(html,/دابل تا تکمیل قبول یا رد توسط حریف غیرفعال است/);
 assert.match(html,/SimabSound\.toggle\(this\)/);
});
test("roll keeps real reel spin and native sound, with new game visuals",()=>{
 const p=read("games/slot/index.html");
 assert.match(p,/function spinSlot\(\)/);
 assert.match(p,/function toggleAudio\(\)/);
 assert.match(p,/simab-slot-v8\.css\?v=8/);
 const css=read("assets/css/simab-slot-v8.css");
 assert.match(css,/\.reels-container/);
 assert.match(css,/\.reel-window/);
});
