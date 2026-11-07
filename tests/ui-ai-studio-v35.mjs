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
 const walletScript='window.SimabWallet=Object.freeze({ready:Promise.resolve(),read:async action=>action==="ai_studio_state"?{enabled:true,freeMode:true,active:true,archiveReady:false,plans:[],expiresAt:null}:{},mutate:async()=>({}),requestId:()=>crypto.randomUUID()});';
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
 await page.goto('http://127.0.0.1:8793/ai/studio/index.html');
 await page.locator('#studio:not([hidden])').waitFor({timeout:12000});
 assert.equal(await page.locator('a[href*="perchance"],a[href*="bigger.pics"]').count(),0);
 assert.equal(await page.locator('#archive-consent').isDisabled(),true);
 await page.locator('#idea').fill('A bright watercolor forest');
 await page.locator('#count').selectOption('1');
 await page.locator('#generate-now').click();
 try{await page.locator('#gallery .result img').first().waitFor({timeout:12000});}catch(e){const debug=await page.evaluate(()=>({status:document.querySelector('#generation-status')?.textContent,fail:document.querySelector('#studio-error')?.textContent,frames:[...document.querySelectorAll('iframe')].map(f=>f.src),gallery:document.querySelector('#gallery')?.innerHTML.slice(0,500)}));throw Error(JSON.stringify({debug,errors,consoleErrors,requestsFailed}));}
 assert.equal(await page.locator('#gallery .result').count(),1);
 assert.equal(await page.locator('#generate-now').isDisabled(),false);
 assert.equal(await page.locator('#gallery .result button').first().textContent(),'💾 دانلود');
 await page.locator('#tab-save').click();
 await page.screenshot({path:'/tmp/simab-ai-v35-gallery.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('AI Studio v35 UI: native form, trusted embed completion, gallery and archive-off default verified');
}finally{await browser.close();server.kill();}
