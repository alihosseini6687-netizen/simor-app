import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';
import {projectRoot} from './source.mjs';

export async function phase4Browser(){
 const root=resolve(projectRoot),mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'};
 const hook=`window.__phase4={act,render,scheduleBot,resetRoom,get state(){return practiceState;},get latest(){return latest;},get paused(){return practicePaused;},fixture(s){clearTimeout(practiceTimer);botGeneration++;practice=true;practiceWaiting=false;practicePaused=false;practiceState=s;lastEvent=0;paintPractice();},human(){return act('move',SimabPracticeAI.choose(practiceState,SimabPracticeRules));}};`;
 const wallet=`window.Telegram={WebApp:{initData:'',initDataUnsafe:{},ready(){},expand(){},onEvent(){}}};window.__writes=[];window.SimabWallet={state:Object.freeze({coins:0,chips:0,serverWallet:false}),pending:null,ready:Promise.resolve(),subscribe(fn){fn(this.state)},read:async()=>({room:null}),refresh:async()=>{},mutate:async(...args)=>{__writes.push(args);throw Error('No production transport in phase4');}};`;
 const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://local'),file=resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+sep))throw Error();let body=await readFile(file);if(file.endsWith('simab-wallet-client.js'))body=wallet;if(file.endsWith('simab-party-v16.js')){body=body.toString();const i=body.lastIndexOf('})();');body=body.slice(0,i)+hook+body.slice(i);}res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream'});res.end(body);}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.SIMAB_TEST_BROWSER?{executablePath:process.env.SIMAB_TEST_BROWSER}:{})}),context=await browser.newContext({viewport:{width:430,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
 await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());page.on('pageerror',e=>errors.push(e.message));
 return {page,context,origin,errors,async open(game){await page.goto(origin+'/games/room/index.html?game='+game);await page.evaluate(()=>window.SimabI18nReady);},async close(){await browser.close();await new Promise(r=>server.close(r));}};
}
