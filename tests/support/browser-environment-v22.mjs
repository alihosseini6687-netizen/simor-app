/* Optional test-only portability/safety adapter. Load with node --import.
 * Existing assertions and synthetic server/DB handlers remain unchanged. */
import childProcess from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {chromium} from 'playwright';

const artifacts=process.env.SIMAB_TEST_ARTIFACTS;
if(!artifacts)throw Error('Set SIMAB_TEST_ARTIFACTS to an approved external artifact directory');
await mkdir(artifacts,{recursive:true});
const spawn=childProcess.spawn.bind(childProcess);
childProcess.spawn=function(command,args=[],options={}){
 if(!['python3','python'].includes(command)||args[0]!=='-m'||args[1]!=='http.server')return spawn(command,args,options);
 const port=Number(args[2]);if(!Number.isInteger(port)||port<1024)throw Error('Invalid test static-server port');
 const code=`const http=require('node:http'),fs=require('node:fs'),path=require('node:path');const root=process.cwd(),types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.json':'application/json'};http.createServer((req,res)=>{let name=decodeURIComponent(new URL(req.url,'http://local').pathname);if(name.endsWith('/'))name+='index.html';const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(error,data)=>{res.writeHead(error?404:200,{'content-type':types[path.extname(file)]||'application/octet-stream'});res.end(error?'Not found':data);});}).listen(${port},'127.0.0.1');process.on('disconnect',()=>process.exit(0));`;
 return spawn(process.execPath,['-e',code],{...options,stdio:['ignore','ignore','ignore','ipc']});
};
syncBuiltinESMExports();

const launch=chromium.launch.bind(chromium),contexts=new WeakSet(),pages=new WeakSet();
async function installPage(page){
 if(pages.has(page))return page;pages.add(page);
 const screenshot=page.screenshot.bind(page);
 page.screenshot=options=>screenshot({...options,...(options?.path&&String(options.path).startsWith('/tmp/')?{path:resolve(artifacts,basename(options.path))}:{})});
 return page;
}
async function installContext(context){
 if(contexts.has(context))return context;contexts.add(context);
 await context.route('**/*',route=>{const url=new URL(route.request().url());return ['127.0.0.1','localhost','[::1]'].includes(url.hostname)?route.continue():route.abort();});
 const newPage=context.newPage.bind(context);context.newPage=async(...args)=>installPage(await newPage(...args));return context;
}
chromium.launch=async options=>{
 const browser=await launch({...options,...(process.env.SIMAB_TEST_BROWSER?{executablePath:process.env.SIMAB_TEST_BROWSER}:{})});
 const newContext=browser.newContext.bind(browser),newPage=browser.newPage.bind(browser);
 browser.newContext=async options=>installContext(await newContext(options));
 browser.newPage=async options=>{const page=await newPage(options);await installContext(page.context());return installPage(page);};
 return browser;
};
const fetch=globalThis.fetch;
globalThis.fetch=(input,...args)=>{
 const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
 if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw Error('External Node HTTP forbidden in browser regressions: '+url.origin);
 return fetch(input,...args);
};
