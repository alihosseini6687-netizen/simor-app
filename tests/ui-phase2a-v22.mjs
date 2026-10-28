import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {chromium} from 'playwright';
import {projectRoot} from './support/source.mjs';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp'};
const server=createServer(async(req,res)=>{try{const file=resolve(projectRoot,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(projectRoot.replace(/[\\/]$/,'')+sep))throw Error();const bytes=await readFile(file);res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(bytes);}catch{res.writeHead(404);res.end();}});
let browser;
try{await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({headless:true,...(process.env.SIMAB_TEST_BROWSER?{executablePath:process.env.SIMAB_TEST_BROWSER}:{})});const page=await browser.newPage(),errors=[];await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/tests/ui-phase2a-v22.html');await page.waitForFunction(()=>!!window.__phase2aResults,{},{timeout:30000});const result=await page.evaluate(()=>window.__phase2aResults);assert.deepEqual(errors,[]);assert.equal(result.failed,0,JSON.stringify(result.results.filter(r=>!r.pass),null,2));assert.equal(result.passed,9);console.log(`Phase2A browser regressions: ${result.passed} passed, ${result.failed} failed.`);}finally{await browser?.close();await new Promise(r=>server.close(r));}
