import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const port=8791,server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:new URL('../',import.meta.url),stdio:'ignore'});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(let i=0;i<40;i++){try{if((await fetch('http://127.0.0.1:'+port+'/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://telegram.org/**',r=>r.fulfill({contentType:'text/javascript',body:'window.Telegram={WebApp:{initData:"",initDataUnsafe:{},ready(){},expand(){},BackButton:{hide(){}}}};'}));
 await page.route('https://pwjlyryrrgbaprfnrieq.supabase.co/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{"error":"telegram_auth_failed"}'}));
 await page.goto('http://127.0.0.1:'+port+'/index.html?home=1');
 await page.locator('#mango-featured-games .mango-feature').first().waitFor();
 assert.equal(await page.locator('#mango-featured-games .mango-feature').count(),3);
 const logo=await page.locator('.mango-title-lockup img').evaluate(img=>({loaded:img.complete&&img.naturalWidth>0,src:img.currentSrc}));
 assert.equal(logo.loaded,true,'real Mango image / SVG fallback must load');
 // The compact derivative of the approved user logo is expected to be available in the branch.
 assert.ok(logo.src.endsWith('/assets/brand/mango-game-icon.jpg')||logo.src.endsWith('/assets/brand/mango-game-mark.svg'));
 assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(18, 20, 23)');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'mobile screen must not overflow');
 for(const slug of ['game=hokm','games/poker/index.html','game=backgammon']){
   assert.ok((await page.locator('#mango-featured-games').innerHTML()).includes(slug));
 }
 await page.screenshot({path:'/tmp/simab-mango-home-v1.png',fullPage:true});
 await page.locator('.mango-section-head button').click();
 await page.locator('#tab-games-content:visible').waitFor();
 assert.ok(await page.locator('#games-container .game-card').count()>3,'original games must remain in full catalog');
 await page.locator('#tab-btn-home').click();await page.locator('#tab-home-content:visible').waitFor();
 assert.deepEqual(errors,[],'no runtime browser exceptions');
 console.log('Mango Game screenshot home, all featured actions, unchanged Games tab and image load verified');
}finally{await browser.close();server.kill();}
