import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {chromium} from 'playwright';

const root=resolve('.');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 if(!['GET','HEAD'].includes(req.method||'')){res.writeHead(405);return res.end();}
 try{let name=decodeURIComponent(new URL(req.url,'http://local').pathname);if(name.endsWith('/'))name+='index.html';const file=resolve(root,'.'+name);if(!file.startsWith(root+sep))throw Error();const body=await readFile(file);res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream'});res.end(req.method==='HEAD'?undefined:body);}
 catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:process.env.SIMAB_TEST_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage();
const external=[],badResponses=[],errors=[];let checks=0;
await context.route('**/*',route=>{
 const url=new URL(route.request().url());
 if(url.origin===origin)return route.continue();
 if(url.hostname==='telegram.org'&&url.pathname==='/js/telegram-web-app.js')return route.fulfill({contentType:'text/javascript',body:`window.Telegram={WebApp:{initData:'',initDataUnsafe:{},ready(){},expand(){},onEvent(){},offEvent(){},openLink(){},openTelegramLink(){},BackButton:{show(){},hide(){},onClick(){},offClick(){}},MainButton:{setText(){},show(){},hide(){},onClick(){},offClick(){}},HapticFeedback:{impactOccurred(){},notificationOccurred(){},selectionChanged(){}}}};`});
 if(url.hostname==='fonts.googleapis.com'&&url.pathname==='/css2')return route.fulfill({contentType:'text/css',body:''});
 external.push(url.origin+url.pathname);return route.abort();
});
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(new URL(r.url()).origin===origin&&r.status()>=400)badResponses.push({url:r.url(),status:r.status()});});
try{
 const home=await page.goto(origin+'/');assert.equal(home.status(),200);await page.waitForLoadState('load');await page.evaluate(()=>window.SimabI18nReady);checks++;
 await page.locator('#tab-btn-games').click();const cards=page.locator('#games-container a.game-card');await cards.first().waitFor({state:'visible'});const hrefs=await cards.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));assert.equal(hrefs.length,11);checks++;
 const allHtml=await page.locator('html').evaluate(el=>el.getAttribute('dir'));assert.ok(['ltr','rtl'].includes(allHtml));checks++;
 const expected=['games/poker/index.html','games/slot/index.html','game=backgammon','game=hokm','games/blackjack/index.html','game=sevens','game=truth','game=mill','game=bingo','game=ludo','game=snakes'];for(const item of expected)assert.ok(hrefs.some(h=>h.includes(item)),item);checks+=expected.length;
 const routeUrls=[];
 for(const href of hrefs){
  const response=await page.goto(new URL(href,origin+'/').href);assert.equal(response.status(),200,href);await page.waitForLoadState('load');
  await page.evaluate(()=>window.SimabI18nReady);routeUrls.push(new URL(page.url()).pathname+new URL(page.url()).search);
  assert.ok(await page.locator('body').isVisible(),href);checks++;
  if(href.includes('games/room/index.html'))assert.equal(await page.locator('#game-title').count(),1);
 }
 assert.equal(new Set(routeUrls).size,11);checks++;
 // Check the Phase 3/4 styles are actually linked from the real source pages,
 // not merely present as orphan files in the repository.
 for(const [url,styles] of [
  ['/', ['simab-phase3-v22.css']],
  ['/games/room/index.html?game=mill',['simab-phase3-v22.css','simab-phase4-v22.css']],
  ['/games/backgammon/index.html',['simab-phase3-v22.css','simab-phase4-v22.css']],
  ['/games/hokm/index.html',['simab-phase3-v22.css','simab-phase4-v22.css']],
  ['/games/ludo/index.html',['simab-phase3-v22.css','simab-phase4-v22.css']],
  ['/games/blackjack/index.html',['simab-phase3-v22.css','simab-phase4-v22.css']]
 ]){
  await page.goto(origin+url);await page.waitForLoadState('load');
  for(const name of styles){assert.ok(await page.locator(`link[rel="stylesheet"][href*="${name}"]`).count(),url+' missing '+name);assert.ok(!badResponses.some(x=>x.url.includes(name)),url+' failed '+name);checks++;}
 }
 // Actual local Mill practice controls and move rendering; no signed identity,
 // API fixture, wallet mutation or server match is supplied.
 await page.goto(origin+'/games/room/index.html?game=mill');await page.waitForLoadState('load');await page.evaluate(()=>window.SimabI18nReady);
 await page.locator('#practice-start').click();await page.locator('#practice-enter').click();await page.locator('#start').click();await page.locator('.mill-board').waitFor({state:'visible'});
 await page.locator('.mill-cell').nth(4).click();await page.waitForFunction(()=>document.querySelectorAll('.mill-piece').length===2,{},{timeout:5000});checks++;
 await page.goto(origin+'/games/room/index.html?game=truth');await page.waitForLoadState('load');await page.evaluate(()=>window.SimabI18nReady);
 const bottleRequest=page.waitForResponse(r=>r.url().includes('/assets/v22/glass-bottle.svg'));
 await page.locator('#local-bottle').click();await page.locator('#local-name-0').fill('Mina');await page.locator('#local-name-1').fill('Reza');await page.locator('#local-prepare').click();const bottleResponse=await bottleRequest;assert.equal(bottleResponse.status(),200);
 assert.match(await page.locator('.bottle-disc .bottle').evaluate(el=>getComputedStyle(el).backgroundImage),/glass-bottle\.svg/);checks++;
 assert.deepEqual(badResponses,[]);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);checks+=3;
 console.log(JSON.stringify({checks,activeCatalogCards:11,visitedRoutes:routeUrls,phase3Phase4Styles:'linked and loaded on home and relevant game pages',millPractice:'actual local controls and render passed',bottleAsset:'loaded local SVG through Phase 3 CSS',brokenLocalRequests:badResponses,blockedExternalRequests:external,pageErrors:errors,telegram:'SDK stub with empty initData; no authentication or production API requested'},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
