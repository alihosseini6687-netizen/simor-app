import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Each old runner keeps its own fixtures/assertions. Its DB, where used, is a
// disposable in-memory PGlite instance; no production service is accessible.
const artifactRoot=process.env.SIMAB_TEST_ARTIFACTS||resolve(process.env.LOCALAPPDATA||process.env.TEMP||'.','Temp','opencode','simab-browser-'+Date.now());
await mkdir(artifactRoot,{recursive:true});
const available=['ui-dice-board-v22','ui-language-v16','ui-party-v16','ui-private-poker','ui-refresh-v17','ui-room-setup-v19','ui-screenshot-regressions-v21','ui-shop-v15','ui-v13','ui-video-regressions-v20','ui-phase1-v22','ui-phase2a-v22','ui-phase2bc-v22','ui-phase3-v22','ui-i18n-phase3b-v22','ui-sevens-transition-v22'];
const selected=process.argv.slice(2);if(selected.some(name=>!available.includes(name)))throw Error('Unknown browser runner');const tests=selected.length?selected:available;
const results=[];
for(const test of tests){
 const result=await new Promise(resolveResult=>{
  const child=spawn(process.execPath,['--import',new URL('./support/browser-environment-v22.mjs',import.meta.url).href,fileURLToPath(new URL('./'+test+'.mjs',import.meta.url)),...(test==='ui-phase3-v22'?['--no-artifacts']:[])],{env:{...process.env,SIMAB_TEST_ARTIFACTS:artifactRoot},stdio:['ignore','pipe','pipe']});
  let output='',timedOut=false;const timer=setTimeout(()=>{timedOut=true;child.kill();},240000);
  child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>output+=data);
  child.on('error',error=>output+=error.stack);child.on('close',code=>{clearTimeout(timer);resolveResult({test,code,timedOut,output});});
 });
 results.push(result);await writeFile(resolve(artifactRoot,test+'.log'),result.output);console.log(test+': '+(result.code===0?'PASS':'FAIL')+(result.timedOut?' (timeout)':''));
}
await writeFile(resolve(artifactRoot,'results.json'),JSON.stringify(results,null,2)+'\n');
const failed=results.filter(result=>result.code!==0);console.log(`${tests.length-failed.length}/${tests.length} browser runners passed. Logs: ${artifactRoot}`);if(failed.length)process.exitCode=1;
