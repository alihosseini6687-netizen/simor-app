import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {projectRoot} from './support/source.mjs';
const {chromium}=await import(process.env.SIMAB_TEST_PLAYWRIGHT_MODULE||'playwright');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
const server=createServer(async(req,res)=>{try{const file=resolve(projectRoot,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(projectRoot.replace(/[\\/]$/,'')+sep))throw Error();res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
const wallet=`window.SimabWallet={state:{coins:0,chips:0,serverWallet:true},pending:null,busy:false,ready:Promise.resolve(),subscribe(fn){fn(this.state)},integer:Number,read:async()=>({}),refresh:async()=>({}),mutate:async()=>{throw Error('Financial mutations forbidden in UI fixture')},recover:async()=>({})};`;
let browser,checks=0;
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,...(process.env.SIMAB_TEST_BROWSER?{executablePath:process.env.SIMAB_TEST_BROWSER}:{})});
 for(const viewport of [{width:390,height:844},{width:844,height:390}])for(const game of ['slot','poker','backgammon','hokm','ludo','blackjack']){
  const page=await browser.newPage({viewport}),errors=[],missing=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith(origin)&&r.status()>=400)missing.push(r.url());});
  await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==origin){if(url.hostname==='telegram.org')return route.fulfill({contentType:'text/javascript',body:'window.Telegram={WebApp:{initData:"",ready(){},expand(){},onEvent(){},BackButton:{show(){},onClick(){}}}};'});return route.abort();}if(url.pathname.endsWith('/simab-wallet-client.js'))return route.fulfill({contentType:'text/javascript',body:wallet});return route.continue();});
  await page.goto(`${origin}/games/${game}/index.html`,{waitUntil:'networkidle'});
  if(game==='ludo'){
   await page.evaluate(()=>{SimabWallet.read=async()=>({sessionId:'fixture-ludo',version:1,state:{kind:'ludo',pieces:Array.from({length:4},()=>[-1,-1,-1,-1]),current:0,die:6,legal:[0,1,2,3],lastRoll:{player:0,value:6},log:[],finished:false}});document.dispatchEvent(new Event('visibilitychange'));});
   await page.waitForFunction(()=>document.querySelector('#amount').disabled);await page.click('#start');
   assert.equal(await page.locator('.legacy-die-result i').count(),6);
   assert.equal(await page.locator('.ludo-piece').count(),16);
   assert.equal(await page.locator('.legacy-die-result').evaluate(n=>getComputedStyle(n).display),'grid');
  }
  assert.deepEqual(errors,[],`${game} runtime`);assert.deepEqual(missing,[],`${game} assets`);
  const metrics=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));assert.ok(metrics.scroll<=metrics.width+2,`${game} horizontal overflow ${JSON.stringify(metrics)}`);
  checks++;await page.close();
 }
 console.log(`Independent pages: ${checks} portrait/landscape route checks passed; real wallet and external networking blocked.`);
}finally{await browser?.close();await new Promise(r=>server.close(r));}
