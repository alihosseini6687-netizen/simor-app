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
   assert.match(html,/simab-(?:v8-core|common)\.css\?v=(?:8|10)/);
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
 assert.doesNotMatch(html,/v8-card-enhanced/);
 assert.doesNotMatch(html,/class="v3-featured-grid"/);
 assert.equal((html.match(/class="v8-hero-focus"/g)||[]).length,1);
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
test("poker has a landscape table, real server actions and no local coin inventory",()=>{
 const html=read('games/poker/index.html'),js=read('assets/js/simab-poker-v10.js'),css=read('assets/css/simab-poker-v10.css');
 assert.match(css,/rotate\(90deg\)/);assert.match(css,/orientation:portrait/);assert.match(css,/overflow:hidden/);
 assert.match(js,/SimabWallet\.mutate\('game'/);assert.match(js,/sessionId:session.sessionId,version:session.version/);
 assert.doesNotMatch(html,/STORAGE_KEY_CHIPS|deductChipsFromInventory/);
});
test("backgammon submits server-validated moves and has explicit bear-off and bar controls",()=>{
 const html=read('games/backgammon/index.html'),js=read('assets/js/simab-backgammon-v10.js');
 assert.match(html,/id="bg-off"/);assert.match(html,/id="bg-bar"/);assert.match(js,/move:|from:target.from/);
 assert.match(js,/SimabWallet\.mutate\('game'/);
});
test("roll keeps real reel spin and native sound, with new game visuals",()=>{
 const p=read("games/slot/index.html");
 assert.match(p,/async function spinSlot\(\)/);
 assert.match(p,/function toggleAudio\(\)/);
 assert.match(p,/simab-slot-v8\.css\?v=8/);
 const css=read("assets/css/simab-slot-v8.css");
 assert.match(css,/\.reels-container/);
 assert.match(css,/\.reel-window/);
});
