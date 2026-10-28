import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {chromium} from 'playwright';
import {projectRoot} from './support/source.mjs';

// No PostgreSQL, Telegram, wallet credentials or screenshot files are needed.
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
const server=createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=resolve(projectRoot,'.'+path);if(!file.startsWith(projectRoot.replace(/[\\/]$/,'')+sep))throw Error('invalid_path');const bytes=await readFile(file);res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(bytes);}catch{res.writeHead(404);res.end('Not found');}});
let browser;
try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];
  await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/tests/ui-phase1-v22.html');
  await page.waitForFunction(()=>!!window.__phase1Results,{},{timeout:30000});
  const result=await page.evaluate(()=>window.__phase1Results);
  assert.deepEqual(errors,[]);assert.equal(result.failed,0,JSON.stringify(result.results.filter(r=>!r.pass),null,2));assert.equal(result.passed,10);
  console.log(`Phase1 browser regressions: ${result.passed} passed, ${result.failed} failed.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
