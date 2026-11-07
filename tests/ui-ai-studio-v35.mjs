import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
const server=spawn('python3',['-m','http.server','8793','--bind','127.0.0.1'],{cwd:new URL('../',import.meta.url),stdio:'ignore'});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],consoleErrors=[],requestsFailed=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text());});page.on('requestfailed',r=>requestsFailed.push(r.url()+':'+r.failure()?.errorText));
try{
 const tgScript='window.Telegram={WebApp:{initData:"",ready(){},expand(){},BackButton:{show(){},onClick(){}}}};';
 await page.route('https://telegram.org/**',r=>r.fulfill({contentType:'text/javascript',body:tgScript}));
 const walletScript='window.SimabWallet=Object.freeze({ready:Promise.resolve(),read:async action=>action==="ai_studio_state"?{enabled:true,freeMode:true,active:true,archiveReady:false,termsText:"",plans:[],expiresAt:null}:{},mutate:async()=>({}),requestId:()=>crypto.randomUUID()});';
 await page.route('**/assets/js/simab-wallet-client.js*',r=>r.fulfill({contentType:'text/javascript',body:walletScript}));
 const embedHtml=[
  '<!doctype html><html><body><p>Image service test frame</p><script>',
  'const payload=JSON.parse(decodeURIComponent(location.hash.slice(1)));',
  'const canvas=document.createElement("canvas");canvas.width=120;canvas.height=120;',
  'const ctx=canvas.getContext("2d");',
  'for(let i=0;i<120;i++){ctx.fillStyle="rgb("+i+","+(120-i)+","+((i*3)%255)+")";ctx.fillRect(i,0,1,120);}',
  'setTimeout(()=>parent.postMessage({type:"finished",id:payload.id,dataUrl:canvas.toDataURL("image/png")},"*"),100);',
  '</script></body></html>'
 ].join('');
 await page.route('https://image-generation.perchance.org/**',r=>r.fulfill({contentType:'text/html',body:embedHtml}));
 const publicHtml=[
  '<!doctype html><html><body><script>',
  'const params=new URLSearchParams(location.search);',
  'const canvas=document.createElement("canvas");canvas.width=120;canvas.height=120;',
  'const ctx=canvas.getContext("2d");for(let x=0;x<120;x++){ctx.fillStyle="rgb("+x+","+x+","+(120-x)+")";ctx.fillRect(x,0,1,120);}',
  'setTimeout(()=>parent.postMessage({api:"perchance-image-api",result:{id:params.get("id"),ok:true,dataUrl:canvas.toDataURL("image/png")}},"*"),110);',
  '</script></body></html>'
 ].join('');
 await page.route('https://perchance.org/perchance-ai-api?**',r=>r.fulfill({contentType:'text/html',body:publicHtml}));

 await page.goto('http://127.0.0.1:8793/ai/studio/index.html');
 await page.locator('#studio:not([hidden])').waitFor({timeout:12000});
 assert.equal(await page.locator('a[href*="perchance"],a[href*="bigger.pics"]').count(),0);
 assert.equal(await page.locator('#archive-consent').isDisabled(),false);
 assert.equal(await page.locator('#archive-status').isVisible(),false);
 assert.equal((await page.locator('#archive-consent').locator('xpath=..').textContent()).trim(),'با شرایط موافقم');
 await page.locator('#tab-save').click();
 await page.locator('#archive-consent').check();
 await page.locator('#tab-generate').click();
 await page.locator('#idea').fill('A bright watercolor forest');
 await page.locator('#count').selectOption('1');
 await page.locator('#generate-now').click();
 try{await page.locator('#gallery .result img').first().waitFor({timeout:12000,state:'attached'});}catch(e){const debug=await page.evaluate(()=>({status:document.querySelector('#generation-status')?.textContent,fail:document.querySelector('#studio-error')?.textContent,frames:[...document.querySelectorAll('iframe')].map(f=>f.src),gallery:document.querySelector('#gallery')?.innerHTML.slice(0,500)}));throw Error(JSON.stringify({debug,errors,consoleErrors,requestsFailed}));}
 assert.equal(await page.locator('#gallery .result').count(),1);
 assert.equal(await page.locator('#generate-now').isDisabled(),false);
 assert.equal(await page.locator('#gallery .result button').first().textContent(),'💾 دانلود');
 await page.locator('#tab-resize').click();
 assert.equal(await page.locator('#resize-file').isVisible(),true);
 assert.equal(await page.locator('#resize-file').evaluate(el=>getComputedStyle(el).opacity),'1');
 assert.equal(await page.locator('#resize-file').getAttribute('accept'),'image/*');
 await page.locator('#resize-file').setInputFiles({name:'sample.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y+LlGgAAAAASUVORK5CYII=','base64')});
 assert.match(await page.locator('#resize-filename').textContent(),/sample.png/);
 await page.locator('#tab-save').click();
 await page.screenshot({path:'/tmp/simab-ai-v35-gallery.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('AI Studio v37 UI: strict public generator message, visible image file picker, gallery and archive consent verified');
}finally{await browser.close();server.kill();}
